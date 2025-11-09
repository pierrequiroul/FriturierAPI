const GuildVoice = require('../models/GuildVoice');
const UserStats = require('../models/UserStats');
const client = require('./discordClient');
const { calculateOverlap } = require('../utils/timeUtils');

/**
 * Calcule et sauvegarde les statistiques pour une liste spécifique d'utilisateurs.
 * @param {string} guildId L'ID de la guilde.
 * @param {string[]} userIds Un tableau d'IDs d'utilisateurs à mettre à jour.
 */
async function calculateAndSaveStatsForUsers(guildId, userIds) {
    if (!userIds || userIds.length === 0) {
        return;
    }
    console.log(`[StatsService] Début de la mise à jour des stats pour ${userIds.length} utilisateur(s) dans la guilde ${guildId}.`);

    try {
        // Vérifier que le client Discord est prêt
        if (!client.isReady()) {
            console.error(`[StatsService] Client Discord non connecté. Stats non calculées.`);
            throw new Error('Client Discord non connecté');
        }
        
        const guild = await client.guilds.fetch(guildId);

        for (const userId of userIds) {
            const now = new Date();
            const ranges = {
                '24h': { start: new Date(now.getTime() - 24 * 3600 * 1000), end: now },
                '7d': { start: new Date(now.getTime() - 7 * 24 * 3600 * 1000), end: now },
                '30d': { start: new Date(now.getTime() - 30 * 24 * 3600 * 1000), end: now },
            };

            const stats = {
                '24h': { timeSpent: 0, timeSpentAlone: 0, timeAfk: 0, bestFriends: new Map() },
                '7d': { timeSpent: 0, timeSpentAlone: 0, timeAfk: 0, bestFriends: new Map() },
                '30d': { timeSpent: 0, timeSpentAlone: 0, timeAfk: 0, bestFriends: new Map() },
                allTime: { timeSpent: 0, timeSpentAlone: 0, timeAfk: 0, bestFriends: new Map() },
            };

            // ID du salon AFK à exclure (à configurer selon votre serveur)
            const AFK_CHANNEL_ID = process.env.AFK_CHANNEL_ID || null;

            const userSessions = await GuildVoice.find({ guildId, 'channels.members.userId': userId });
            
            console.log(`[StatsService] Trouvé ${userSessions.length} session(s) pour userId=${userId}`);
            
            if (userSessions.length === 0) {
                console.warn(`[StatsService] Aucune session trouvée pour userId=${userId}, skip`);
                continue;
            }

            for (const record of userSessions) {
                const sessionStart = record.sessionStart.getTime();
                const sessionEnd = (record.sessionEnd || now).getTime();
                const duration = sessionEnd - sessionStart;

                const userChannel = record.channels.find(c => c.members.some(m => m.userId === userId));
                if (!userChannel) continue;

                // Exclure le temps passé dans le salon AFK
                const isAfk = AFK_CHANNEL_ID && userChannel.channelId === AFK_CHANNEL_ID;
                if (isAfk) {
                    stats.allTime.timeAfk += duration;
                } else {
                    stats.allTime.timeSpent += duration;
                    if (userChannel.members.length === 1) stats.allTime.timeSpentAlone += duration;
                    userChannel.members.forEach(m => {
                        if (m.userId !== userId) stats.allTime.bestFriends.set(m.userId, (stats.allTime.bestFriends.get(m.userId) || 0) + duration);
                    });
                }

                for (const key in ranges) {
                    const overlap = calculateOverlap(sessionStart, sessionEnd, ranges[key].start.getTime(), ranges[key].end.getTime());
                    if (overlap > 0) {
                        if (isAfk) {
                            stats[key].timeAfk += overlap;
                        } else {
                            stats[key].timeSpent += overlap;
                            if (userChannel.members.length === 1) stats[key].timeSpentAlone += overlap;
                            userChannel.members.forEach(m => {
                                if (m.userId !== userId) stats[key].bestFriends.set(m.userId, (stats[key].bestFriends.get(m.userId) || 0) + overlap);
                            });
                        }
                    }
                }
            }

            const finalStats = {};
            const allFriendIds = new Set();
            Object.values(stats).forEach(periodStat => periodStat.bestFriends.forEach((_, friendId) => allFriendIds.add(friendId)));

            const friendMembers = new Map();
            if (allFriendIds.size > 0) {
                const resolvedFriends = await Promise.all(
                    Array.from(allFriendIds).map(id => guild.members.fetch(id).catch(() => null))
                );
                resolvedFriends.filter(m => m).forEach(m => friendMembers.set(m.id, m));
            }

            for (const key in stats) {
                // Exclure les bots du classement best friends
                const sortedFriends = Array.from(stats[key].bestFriends.entries())
                    .filter(([friendId]) => {
                        const member = friendMembers.get(friendId);
                        return member && !member.user.bot;
                    })
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10);

                // Calcul du temps moyen par session (hors AFK)
                let sessionCount = 0;
                let totalSessionTime = 0;
                for (const record of userSessions) {
                    const sessionStart = record.sessionStart.getTime();
                    const sessionEnd = (record.sessionEnd || now).getTime();
                    const userChannel = record.channels.find(c => c.members.some(m => m.userId === userId));
                    if (!userChannel) continue;
                    const isAfk = AFK_CHANNEL_ID && userChannel.channelId === AFK_CHANNEL_ID;
                    
                    // On ne compte que les sessions hors AFK
                    if (!isAfk) {
                        // Pour allTime, on compte toute la durée
                        // Pour les autres périodes, on ne compte que l'overlap
                        if (key === 'allTime') {
                            sessionCount++;
                            totalSessionTime += (sessionEnd - sessionStart);
                        } else if (ranges[key]) {
                            const overlap = calculateOverlap(sessionStart, sessionEnd, ranges[key].start.getTime(), ranges[key].end.getTime());
                            if (overlap > 0) {
                                sessionCount++;
                                totalSessionTime += overlap;
                            }
                        }
                    }
                }
                const averageTime = sessionCount > 0 ? Math.round(totalSessionTime / sessionCount) : 0;

                finalStats[key] = {
                    timeSpent: stats[key].timeSpent,
                    timeSpentAlone: stats[key].timeSpentAlone,
                    timeAfk: stats[key].timeAfk,
                    averageTime,
                    bestFriends: sortedFriends.map(([friendId, time]) => {
                        const friendMember = friendMembers.get(friendId);
                        return {
                            userId: friendId,
                            username: friendMember ? friendMember.user.username : 'Utilisateur Inconnu',
                            avatar: friendMember ? friendMember.user.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png',
                            timeSpentTogether: time
                        };
                    })
                };
            }

            // Transformer les clés courtes en clés schema UserStats (last24h, last7d, last30d, allTime)
            const schemaStats = {
                last24h: finalStats['24h'],
                last7d: finalStats['7d'],
                last30d: finalStats['30d'],
                allTime: finalStats.allTime
            };

            const member = await guild.members.fetch(userId).catch(() => null);
            
            if (member) {
                console.log(`[StatsService] Membre Discord trouvé pour ${userId}, sauvegarde avec infos complètes`);
                await UserStats.findOneAndUpdate({ guildId, userId }, {
                    username: member.user.username, 
                    nickname: member.nickname, 
                    discriminator: member.user.discriminator,
                    avatar: member.user.displayAvatarURL(), 
                    avatarDecoration: member.user.avatarDecorationURL({ size: 128 }),
                    isBot: member.user.bot, 
                    stats: schemaStats, 
                    lastUpdatedAt: new Date()
                }, { upsert: true, new: true });
            } else {
                // Si le membre ne peut pas être récupéré (a quitté le serveur), on sauvegarde quand même les stats
                console.log(`[StatsService] Membre Discord non trouvé pour ${userId}, sauvegarde avec infos minimales`);
                await UserStats.findOneAndUpdate({ guildId, userId }, {
                    username: `Utilisateur ${userId}`, 
                    nickname: null, 
                    discriminator: '0',
                    avatar: 'https://cdn.discordapp.com/embed/avatars/0.png', 
                    avatarDecoration: null,
                    isBot: false, 
                    stats: schemaStats, 
                    lastUpdatedAt: new Date()
                }, { upsert: true, new: true });
            }
        }
        console.log(`[StatsService] Mise à jour des stats terminée pour ${userIds.length} utilisateur(s) dans la guilde ${guildId}.`);
    } catch (error) {
        console.error(`[StatsService] Erreur lors de la mise à jour des stats pour la guilde ${guildId}:`, error);
    }
}

/**
 * Calcule et met à jour les statistiques pour tous les utilisateurs d'une guilde.
 * @param {string} guildId L'ID de la guilde.
 */
async function updateAllUserStats(guildId) {
    const allUserIds = await GuildVoice.distinct('channels.members.userId', { guildId });
    await calculateAndSaveStatsForUsers(guildId, allUserIds);
}

module.exports = {
    calculateAndSaveStatsForUsers,
    updateAllUserStats,
};