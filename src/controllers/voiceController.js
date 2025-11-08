const GuildVoice = require('../models/GuildVoice');
const statsService = require('../services/statsService');

// Fonction utilitaire pour arrondir une date à la minute
function roundToMinute(date) {
    const d = new Date(date);
    d.setSeconds(0, 0);
    return d;
}

/**
 * Crée une "signature" canonique et unique de l'état des canaux vocaux.
 * Cette signature peut être utilisée pour comparer deux états et voir s'ils sont identiques.
 * @param {Array} channels - Un tableau d'objets de canaux.
 * @returns {string} Une chaîne JSON représentant l'état normalisé.
 */
function createStateSignature(channels) {
    // S'assurer que l'entrée est un tableau
    if (!Array.isArray(channels) || channels.length === 0) {
        return '[]';
    }

    // 1. Filtrer les canaux sans membres.
    const activeChannels = channels.filter(c => c.members && c.members.length > 0);

    // 2. Normaliser et trier les canaux et leurs membres.
    const normalizedChannels = activeChannels.map(channel => {
        // Trier les membres par userId pour une comparaison cohérente
        const sortedMembers = [...channel.members].sort((a, b) => a.userId.localeCompare(b.userId));
        return {
            channelId: channel.channelId,
            // On ne garde que l'ID pour la signature, c'est suffisant pour détecter un changement.
            members: sortedMembers.map(m => ({ userId: m.userId })) 
        };
    });

    // Trier les canaux par channelId pour une comparaison globale cohérente
    normalizedChannels.sort((a, b) => a.channelId.localeCompare(b.channelId));

    // 3. Retourner la signature sous forme de chaîne JSON. C'est rapide et fiable.
    return JSON.stringify(normalizedChannels);
}
// Obtenir la liste des serveurs et leurs salons vocaux actifs

exports.getGuildsAndChannels = async (req, res) => {
    try {
        // Agrégation pour obtenir tous les canaux distincts par guilde
        const guilds = await GuildVoice.aggregate([
            { $unwind: "$channels" },
            {
                $group: {
                    _id: { guildId: "$guildId", channelId: "$channels.channelId" },
                    channelName: { $last: "$channels.channelName" }
                }
            },
            {
                $group: {
                    _id: "$_id.guildId",
                    channels: {
                        $push: {
                            channelId: "$_id.channelId",
                            name: "$channelName"
                        }
                    }
                }
            }
        ]);
        // Format de sortie
        res.json(guilds.map(g => ({
            _id: g._id,
            channels: g.channels
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Enregistrer l'activité d'un salon vocal
exports.recordGuildActivity = async (req, res) => {
    try {
        const { guildId } = req.params;
        const { channels } = req.body;
        const now = roundToMinute(new Date());

        // Debug logging: incoming request summary (do not log secrets)
        try {
            const hasApiKey = !!(req.headers['x-api-key'] || req.headers['X-API-KEY']);
            const expectedKey = process.env.STATS_API_KEY;
            const apiKeyMatches = hasApiKey && expectedKey && (req.headers['x-api-key'] === expectedKey || req.headers['X-API-KEY'] === expectedKey);
            // Utiliser req.originalUrl uniquement à titre informatif, ne jamais influencer la logique.
            // Si originalUrl est anormalement vide, on reconstruit un affichage basique.
            const urlDisplay = req.originalUrl && typeof req.originalUrl === 'string'
                ? req.originalUrl
                : `/api/voice/${guildId}`;
            console.log(`[voice] ${req.method} ${urlDisplay} channels=${Array.isArray(channels)?channels.length:0} apiKeyPresent=${hasApiKey} apiKeyMatches=${apiKeyMatches}`);
        } catch (err) {
            console.log('[voice] Failed to log request headers', err);
        }
        // Vérifier que channels est un array
        if (!Array.isArray(channels)) {
            return res.status(400).json({ error: 'Le champ "channels" doit être un tableau.' });
        }

        // Préparer les données des canaux
        const newChannelsData = channels.map(channel => ({
            channelId: channel.channelId,
            channelName: channel.channelName || null,
            members: channel.members.map(member => ({
                userId: member.memberId, // Le client envoie memberId, on le mappe en userId pour le schéma
                username: member.username || `User ${member.memberId}`
            }))
        }));

        const newSignature = createStateSignature(newChannelsData);
        const lastRecord = await GuildVoice.findOne({ guildId }).sort({ sessionStart: -1, createdAt: -1 });

        // Cas 1 : Il n'y a aucun enregistrement précédent pour ce serveur.
        if (!lastRecord) {
            const activeChannels = newChannelsData.filter(c => c.members.length > 0);
            if (activeChannels.length > 0) {
                // Déclencher la mise à jour des stats pour tous les utilisateurs actuellement présents
                const presentUserIds = [...new Set(activeChannels.flatMap(c => c.members.map(m => m.userId)))];
                if (presentUserIds.length > 0) {
                    try {
                        // Pas d'attente: traitement en arrière-plan
                        statsService.calculateAndSaveStatsForUsers(guildId, presentUserIds);
                    } catch (err) {
                        console.warn(`[${guildId}] Échec déclenchement update stats (premier enregistrement):`, err);
                    }
                }

                const newRecord = await GuildVoice.create({ guildId, sessionStart: now, channels: activeChannels });
                console.log(`[${guildId}] Première session créée: ${newRecord._id}`);
                return res.status(201).json(newRecord);
            } else {
                return res.status(200).json({ message: 'État initial vide, aucun enregistrement créé.' });
            }
        }

        // Cas 2 : Un enregistrement précédent existe, on compare les états.
        const lastSignature = createStateSignature(lastRecord.channels);

        // Si l'état n'a pas changé, on met tout de même à jour les stats des utilisateurs présents
        if (newSignature === lastSignature) {
            try {
                const presentUserIds = [...new Set(newChannelsData.flatMap(c => c.members.map(m => m.userId)))];
                if (presentUserIds.length > 0) {
                    // Mise à jour en arrière-plan (les sessions en cours seront comptées jusqu'à "now")
                    statsService.calculateAndSaveStatsForUsers(guildId, presentUserIds);
                    console.log(`[${guildId}] État inchangé. Stats mises à jour pour ${presentUserIds.length} utilisateur(s).`);
                } else {
                    console.log(`[${guildId}] État inchangé. Aucun utilisateur présent, pas de mise à jour des stats.`);
                }
            } catch (err) {
                console.warn(`[${guildId}] Échec mise à jour des stats (état inchangé):`, err);
            }
            return res.status(200).json({ message: 'État inchangé, stats mises à jour.', record: lastRecord });
        }

        // L'état a changé. Une connexion ou une déconnexion a eu lieu.
        console.log(`[${guildId}] Changement d'état détecté.`);

        // --- DÉCLENCHEMENT DE LA MISE À JOUR DES STATS ---
        // On identifie tous les utilisateurs qui étaient dans l'état précédent OU dans le nouvel état.
        const oldUserIds = lastRecord.channels.flatMap(c => c.members.map(m => m.userId));
        const newUserIds = newChannelsData.flatMap(c => c.members.map(m => m.userId));
        // On utilise un Set pour avoir une liste unique d'utilisateurs affectés.
        const affectedUserIds = [...new Set([...oldUserIds, ...newUserIds])];

        if (affectedUserIds.length > 0) {
            console.log(`[${guildId}] Déclenchement de la mise à jour des stats pour ${affectedUserIds.length} utilisateur(s) affecté(s).`);
            // On ne met PAS 'await' ici. La mise à jour se fait en arrière-plan pour ne pas bloquer la réponse.
            statsService.calculateAndSaveStatsForUsers(guildId, affectedUserIds);
        }

        // On clôture la session précédente car son état est maintenant terminé.
        if (!lastRecord.sessionEnd) {
            lastRecord.sessionEnd = now;
            await lastRecord.save();
            console.log(`[${guildId}] Session précédente ${lastRecord._id} fermée à ${now.toISOString()}`);
        }

        // On vérifie s'il reste une activité pour décider de créer une nouvelle session.
        const activeChannels = newChannelsData.filter(c => c.members.length > 0);

        if (activeChannels.length > 0) {
            // Règle 1 & 2 : Il y a encore des membres, on crée un nouveau document pour le nouvel état.
            const newRecord = await GuildVoice.create({ guildId, sessionStart: now, channels: activeChannels });
            console.log(`[${guildId}] Nouvelle session créée pour le nouvel état: ${newRecord._id}`);
            return res.status(201).json(newRecord);
        } else {
            // Règle 3 : Plus personne n'est connecté. La clôture de la session précédente est suffisante.
            console.log(`[${guildId}] Tous les canaux sont vides. Aucune nouvelle session créée.`);
            return res.status(200).json({ message: 'Tous les canaux sont vides, la session précédente a été fermée.' });
        }
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement de l\'activité:', error);
        res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
};

// Obtenir l'activité d'un salon vocal
exports.getGuildActivity = async (req, res) => {
    try {
        const { guildId } = req.params;
        const { start, end } = req.query;

        const filter = { guildId };

        // Appliquer le filtre de date seulement si start et end sont fournis
        if (start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                return res.status(400).json({ error: 'Format de date invalide' });
            }
            filter.sessionStart = { $gte: startDate, $lte: endDate };
        }

        const docs = await GuildVoice.find(filter).sort({ sessionStart: 1 });

        res.json(docs);
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'activité de la guilde:', error);
        res.status(500).json({ error: error.message });
    }
};