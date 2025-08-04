const GuildVoice = require('../models/GuildVoice');

// Fonction utilitaire pour arrondir une date à la minute
function roundToMinute(date) {
    const d = new Date(date);
    d.setSeconds(0, 0);
    return d;
}

// Fonction utilitaire pour normaliser un canal pour la comparaison
function normalizeChannelForComparison(channel) {
    if (!channel) return null;
    return {
        channelId: channel.channelId,
        members: channel.members?.map(m => ({
            userId: m.userId,
            username: m.username
        })).sort((a, b) => a.userId.localeCompare(b.userId)) || []
    };
}

// Fonction utilitaire pour normaliser un enregistrement complet
function normalizeRecordForComparison(record) {
    if (!record) return null;
    return {
        guildId: record.guildId,
        channels: record.channels
            .map(normalizeChannelForComparison)
            .filter(ch => ch.members.length > 0) // Ne garder que les canaux avec des membres
            .sort((a, b) => a.channelId.localeCompare(b.channelId))
    };
}



// Fonction pour vérifier si un enregistrement est un doublon
async function isDuplicateRecord(guildId, newChannels, sessionStart) {
    try {
        // Récupérer le dernier enregistrement pour ce serveur
        const lastRecord = await GuildVoice.findOne({
            guildId,
            sessionStart: { $lt: sessionStart }
        }).sort({ sessionStart: -1 });

        if (!lastRecord) {
            return false; // Pas de doublon possible
        }

        // Filtrer les canaux avec des membres
        const newChannelsWithMembers = newChannels.filter(ch => ch.members.length > 0);
        const lastChannelsWithMembers = lastRecord.channels.filter(ch => ch.members.length > 0);
        
        // Trier les canaux par channelId pour une comparaison fiable
        const sortedNewChannels = newChannelsWithMembers.sort((a, b) => a.channelId.localeCompare(b.channelId));
        const sortedLastChannels = lastChannelsWithMembers.sort((a, b) => a.channelId.localeCompare(b.channelId));

        console.log(`Comparaison pour guildId: ${guildId}`);
        console.log(`Canaux actuels: ${sortedNewChannels.map(ch => `${ch.channelId}(${ch.members.length})`).join(', ')}`);
        console.log(`Canaux précédents: ${sortedLastChannels.map(ch => `${ch.channelId}(${ch.members.length})`).join(', ')}`);

        // Étape 1: Vérifier le nombre de canaux avec des membres
        if (sortedNewChannels.length === sortedLastChannels.length) {
            console.log(`✅ Même nombre de canaux: ${sortedNewChannels.length}`);
            
            // Étape 2: Vérifier que les mêmes canaux sont actifs
            let sameChannels = true;
            for (let i = 0; i < sortedNewChannels.length; i++) {
                if (sortedNewChannels[i].channelId !== sortedLastChannels[i].channelId) {
                    console.log(`❌ Canaux différents: ${sortedNewChannels[i].channelId} vs ${sortedLastChannels[i].channelId}`);
                    sameChannels = false;
                    break;
                }
            }
            
            if (sameChannels) {
                console.log(`✅ Mêmes canaux actifs`);
                
                // Étape 3: Vérifier le nombre de membres dans chaque canal
                let sameMemberCounts = true;
                for (let i = 0; i < sortedNewChannels.length; i++) {
                    const newChannel = sortedNewChannels[i];
                    const lastChannel = sortedLastChannels[i];
                    
                    if (newChannel.members.length !== lastChannel.members.length) {
                        console.log(`❌ Nombre de membres différent dans le canal ${newChannel.channelId}: ${newChannel.members.length} vs ${lastChannel.members.length}`);
                        sameMemberCounts = false;
                        break;
                    }
                }
                
                if (sameMemberCounts) {
                    console.log(`✅ Même nombre de membres par canal`);
                    
                    // Étape 4: Vérifier les memberIds dans chaque canal
                    let sameMembers = true;
                    for (let i = 0; i < sortedNewChannels.length; i++) {
                        const newChannel = sortedNewChannels[i];
                        const lastChannel = sortedLastChannels[i];
                        
                        // Trier les memberIds pour une comparaison fiable
                        const newMemberIds = newChannel.members.map(m => m.userId).sort();
                        const lastMemberIds = lastChannel.members.map(m => m.userId).sort();
                        
                        console.log(`Canal ${newChannel.channelId} - Membres actuels: ${newMemberIds.join(', ')}`);
                        console.log(`Canal ${lastChannel.channelId} - Membres précédents: ${lastMemberIds.join(', ')}`);
                        
                        // Comparer les arrays de memberIds
                        if (JSON.stringify(newMemberIds) !== JSON.stringify(lastMemberIds)) {
                            console.log(`❌ MemberIds différents dans le canal ${newChannel.channelId}`);
                            sameMembers = false;
                            break;
                        }
                    }
                    
                    if (sameMembers) {
                        console.log(`✅ Mêmes membres dans tous les canaux`);
                        console.log(`🎯 Doublon détecté pour guildId: ${guildId}`);
                        return true; // C'est un doublon
                    } else {
                        console.log(`❌ Membres différents détectés`);
                        return false; // Pas un doublon
                    }
                } else {
                    console.log(`❌ Nombre de membres différent détecté`);
                    return false; // Pas un doublon
                }
            } else {
                console.log(`❌ Canaux différents détectés`);
                return false; // Pas un doublon
            }
        } else {
            console.log(`❌ Nombre de canaux différent: ${sortedNewChannels.length} vs ${sortedLastChannels.length}`);
            return false; // Pas un doublon
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des doublons:', error);
        return false;
    }
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
exports.recordActivity = async (req, res) => {
    try {
        const { guildId } = req.params;
        const { channels } = req.body;
        const now = roundToMinute(new Date());

        // Vérifier que channels est un array
        if (!Array.isArray(channels)) {
            return res.status(400).json({ error: 'channels doit être un array' });
        }

        // Préparer les données des canaux
        const newChannels = channels.map(channel => ({
            channelId: channel.channelId,
            channelName: channel.channelName || null,
            members: channel.members.map(member => ({
                userId: member.memberId,
                username: member.username || `User ${member.memberId}`
            }))
        }));

        // Vérifier si c'est un doublon AVANT l'insertion
        const isDuplicate = await isDuplicateRecord(guildId, newChannels, now);
        if (isDuplicate) {
            console.log(`Doublon détecté pour guildId: ${guildId}, sessionStart: ${now}`);
            // Retourner le dernier enregistrement existant
            const lastRecord = await GuildVoice.findOne({
                guildId,
                sessionStart: { $lt: now }
            }).sort({ sessionStart: -1 });
            
            return res.json(lastRecord);
        }

        // Chercher l'enregistrement existant pour ce sessionStart
        let currentRecord = await GuildVoice.findOne({
            guildId,
            sessionStart: now
        });

        if (currentRecord) {
            // Fusionner avec l'enregistrement existant
            for (const newChannel of newChannels) {
                const existingChannelIndex = currentRecord.channels.findIndex(
                    ch => ch.channelId === newChannel.channelId
                );

                if (existingChannelIndex !== -1) {
                    // Mettre à jour le canal existant
                    currentRecord.channels[existingChannelIndex] = newChannel;
                } else {
                    // Ajouter le nouveau canal
                    currentRecord.channels.push(newChannel);
                }
            }

            // Sauvegarder les modifications
            await currentRecord.save();
        } else {
            // Récupérer les canaux actifs du dernier enregistrement
            const lastRecord = await GuildVoice.findOne({
                guildId,
                sessionStart: { $lt: now }
            }).sort({ sessionStart: -1 });

            const activeChannels = [];
            if (lastRecord) {
                for (const channel of lastRecord.channels) {
                    // Vérifier si le canal est dans la nouvelle requête
                    const isInNewChannels = newChannels.some(newCh => newCh.channelId === channel.channelId);
                    
                    if (isInNewChannels) {
                        // Le canal est dans la nouvelle requête, il sera ajouté par newChannels
                        continue;
                    } else {
                        // Le canal n'est PAS dans la nouvelle requête = il a été vidé
                        // Ne pas l'ajouter du tout
                        console.log(`Canal vidé détecté: ${channel.channelId} (${channel.members.length} membres)`);
                    }
                }
            }

            // Créer un nouveau document avec tous les canaux actifs
            currentRecord = await GuildVoice.create({
                guildId,
                sessionStart: now,
                channels: [...activeChannels, ...newChannels]
            });

            // Fermer le document précédent en mettant à jour sa propriété sessionEnd
            if (lastRecord && !lastRecord.sessionEnd) {
                await GuildVoice.findByIdAndUpdate(
                    lastRecord._id,
                    { $set: { sessionEnd: now } }
                );
            }
        }

        res.json(currentRecord);
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement de l\'activité:', error);
        res.status(500).json({ error: error.message });
    }
};



// Obtenir l'activité d'un salon vocal
exports.getActivity = async (req, res) => {
    try {
        const { guildId } = req.params;
        const { start, end } = req.query;

        const startDate = new Date(start);
        const endDate = new Date(end);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Format de date invalide' });
        }

        const docs = await GuildVoice.find({
            guildId,
            sessionStart: { $gte: startDate, $lte: endDate }
        }).sort({ sessionStart: 1 });

        res.json(docs);
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'activité de la guilde:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtenir les statistiques d'un salon vocal
exports.getStats = async (req, res) => {
    try {
        const { guildId, channelId } = req.params;
        const { start, end } = req.query;

        const startDate = new Date(start);
        const endDate = new Date(end);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Format de date invalide' });
        }

        const stats = await GuildVoice.aggregate([
            {
                $match: {
                    guildId,
                    sessionStart: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $unwind: '$channels'
            },
            {
                $match: {
                    'channels.channelId': channelId
                }
            },
            {
                $group: {
                    _id: null,
                    channelName: { $first: '$channels.channelName' },
                    avgMembers: { $avg: '$channels.memberCount' },
                    maxMembers: { $max: '$channels.memberCount' },
                    totalSamples: { $sum: 1 },
                    uniqueMembers: { $addToSet: '$channels.members.userId' },
                    peakHours: {
                        $push: {
                            hour: { $hour: '$sessionStart' },
                            memberCount: '$channels.memberCount'
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    channelName: 1,
                    avgMembers: { $round: ['$avgMembers', 1] },
                    maxMembers: 1,
                    totalSamples: 1,
                    uniqueMemberCount: { $size: '$uniqueMembers' },
                    peakHours: 1
                }
            }
        ]);

        // Calculer les heures de pointe
        if (stats.length > 0) {
            const hourlyAverages = Array(24).fill(0).map((_, hour) => {
                const samples = stats[0].peakHours.filter(p => p.hour === hour);
                return {
                    hour,
                    avgMembers: samples.length > 0
                        ? Math.round(samples.reduce((sum, s) => sum + s.memberCount, 0) / samples.length * 10) / 10
                        : 0
                };
            });

            stats[0].peakHours = hourlyAverages.sort((a, b) => b.avgMembers - a.avgMembers);
            stats[0].topHours = stats[0].peakHours.slice(0, 5);
            delete stats[0].peakHours;
        }

        res.json(stats[0] || {
            channelName: '',
            avgMembers: 0,
            maxMembers: 0,
            totalSamples: 0,
            uniqueMemberCount: 0,
            topHours: []
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
        res.status(500).json({ error: error.message });
    }
};
