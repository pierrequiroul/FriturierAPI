const GuildVoice = require('../models/GuildVoice');
const client = require('../services/discordClient');
const statsService = require('../services/statsService');
const UserStats = require('../models/UserStats');


// Helper to calculate the overlap in milliseconds between two time ranges
function calculateOverlap(sessionStart, sessionEnd, rangeStart, rangeEnd) {
    const overlapStart = Math.max(sessionStart, rangeStart);
    const overlapEnd = Math.min(sessionEnd, rangeEnd);
    return Math.max(0, overlapEnd - overlapStart);
}

exports.recordUserStats = async (req, res) => {
    try {
        const { guildId, userId } = req.params;

        const now = new Date();
        const ranges = {
            '24h': { start: new Date(now.getTime() - 24 * 3600 * 1000), end: now },
            '7d': { start: new Date(now.getTime() - 7 * 24 * 3600 * 1000), end: now },
            '30d': { start: new Date(now.getTime() - 30 * 24 * 3600 * 1000), end: now },
        };

        const stats = {
            totalTime: { '24h': 0, '7d': 0, '30d': 0, allTime: 0 },
            soloTime: { '24h': 0, '7d': 0, '30d': 0, allTime: 0 },
        };
        const commonTime = new Map();

        const userSessions = await GuildVoice.find({ guildId, 'channels.members.userId': userId });

        for (const record of userSessions) {
            const sessionStart = record.sessionStart.getTime();
            const sessionEnd = (record.sessionEnd || now).getTime();
            const duration = sessionEnd - sessionStart;

            const userChannel = record.channels.find(c => c.members.some(m => m.userId === userId));
            if (!userChannel) continue;

            // Calculate total time
            stats.totalTime.allTime += duration;
            for (const key in ranges) {
                stats.totalTime[key] += calculateOverlap(sessionStart, sessionEnd, ranges[key].start.getTime(), ranges[key].end.getTime());
            }

            // Calculate solo time
            if (userChannel.members.length === 1) {
                stats.soloTime.allTime += duration;
                for (const key in ranges) {
                    stats.soloTime[key] += calculateOverlap(sessionStart, sessionEnd, ranges[key].start.getTime(), ranges[key].end.getTime());
                }
            }

            // Calculate common time with friends
            if (userChannel.members.length > 1) {
                for (const member of userChannel.members) {
                    if (member.userId !== userId) {
                        const currentCommonTime = commonTime.get(member.userId) || 0;
                        commonTime.set(member.userId, currentCommonTime + duration);
                    }
                }
            }
        }

        // Process top friends
        const sortedFriends = Array.from(commonTime.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const topFriends = [];
        if (sortedFriends.length > 0) {
            const guild = await client.guilds.fetch(guildId);
            const friendIds = sortedFriends.map(f => f[0]);
            
            const memberPromises = friendIds.map(id => guild.members.fetch(id).catch(() => null));
            const friendMembersResolved = await Promise.all(memberPromises);
            const friendMembers = new Map(friendMembersResolved.filter(m => m).map(m => [m.id, m]));

            for (const [friendId, time] of sortedFriends) {
                const member = friendMembers.get(friendId);
                topFriends.push({
                    id: friendId,
                    name: member ? (member.nickname || member.user.username) : `Utilisateur Inconnu`,
                    avatar: member ? member.user.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png',
                    commonTime: time,
                });
            }
        }

        res.json({ ...stats, topFriends });

    } catch (error) {
        console.error(`Erreur lors du calcul des stats pour l'utilisateur ${req.params.userId}:`, error);
        res.status(500).json({ message: 'Erreur lors du calcul des statistiques.' });
    }
};
/**
 * Récupère les statistiques pré-calculées d'un utilisateur.
 */
exports.getUserStats = async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        const userStats = await UserStats.findOne({ guildId, userId });
        if (!userStats) {
            return res.status(404).json({ message: 'Aucune statistique trouvée pour cet utilisateur.' });
        }
        res.json(userStats);
    } catch (error) {
        console.error(`Erreur lors de la récupération des stats pour l'utilisateur ${req.params.userId}:`, error);
        res.status(500).json({ message: 'Erreur lors de la récupération des statistiques.' });
    }
};

/**
 * Calcule et met à jour les statistiques pour tous les utilisateurs d'une guilde.
 * C'est une opération potentiellement longue.
 */
exports.updateAllUserStats = async (req, res) => {
    try {
        const { guildId } = req.params;
        
        // Délègue le calcul au service. On n'attend pas la fin pour répondre rapidement.
        statsService.updateAllUserStats(guildId);
        
        res.status(202).json({ message: `La mise à jour des statistiques pour la guilde ${guildId} a été lancée en arrière-plan.` });
    } catch (error) {
        console.error(`Erreur lors de la mise à jour des statistiques pour la guilde ${req.params.guildId}:`, error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour des statistiques.' });
    }
};
