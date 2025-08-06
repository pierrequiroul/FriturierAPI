const GuildVoice = require('../models/GuildVoice');

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

        // Créer la signature du nouvel état pour le comparer à l'ancien
        const newSignature = createStateSignature(newChannelsData);

        // Récupérer le tout dernier enregistrement pour cette guilde pour la comparaison
        const lastRecord = await GuildVoice.findOne({ guildId }).sort({ sessionStart: -1 });

        // Si un enregistrement précédent existe, on compare les signatures
        if (lastRecord) {
            const lastSignature = createStateSignature(lastRecord.channels);
            if (newSignature === lastSignature) {
                console.log(`[${guildId}] État inchangé. Pas d'enregistrement.`);
                return res.status(200).json({ message: 'État inchangé, enregistrement ignoré.', record: lastRecord });
            }

            // Un changement a été détecté. La session de l'état précédent se termine maintenant.
            // On met à jour sessionEnd uniquement s'il n'est pas déjà défini, par sécurité.
            if (!lastRecord.sessionEnd) {
                lastRecord.sessionEnd = now;
                await lastRecord.save();
                console.log(`[${guildId}] Session précédente ${lastRecord._id} fermée à ${now.toISOString()}`);
            }
        }

        // On ne crée une nouvelle session que si le nouvel état n'est pas vide.
        const activeChannels = newChannelsData.filter(c => c.members.length > 0);
        if (activeChannels.length > 0) {
            // Si l'état est nouveau (pas de lastRecord ou signatures différentes), on crée un nouvel enregistrement.
            const newRecord = await GuildVoice.create({
                guildId,
                sessionStart: now,
                channels: activeChannels
            });

            console.log(`[${guildId}] Nouvel état détecté. Enregistrement créé: ${newRecord._id}`);
            res.status(201).json(newRecord);
        } else {
            // Tous les canaux sont maintenant vides. La fin de la session précédente suffit.
            console.log(`[${guildId}] Tous les canaux sont vides. Aucune nouvelle session créée.`);
            res.status(200).json({ message: 'Tous les canaux sont vides, la session précédente a été fermée.' });
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