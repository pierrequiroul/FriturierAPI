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
 * Si les stats n'existent pas, déclenche leur calcul et réessaye.
 */
exports.getUserStats = async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        
        // Log d'entrée très visible
        console.log('\n========================================');
        console.log(`📊 [getUserStats] START`);
        console.log(`   Guild: ${guildId}`);
        console.log(`   User:  ${userId}`);
        console.log('========================================\n');
        
        let userStats = await UserStats.findOne({ guildId, userId });
        
        if (!userStats) {
            console.log(`⚠️  [getUserStats] Stats non trouvées pour userId=${userId} dans guildId=${guildId}. Vérification de l'activité...`);
            
            // Vérifier si l'utilisateur a au moins une session enregistrée dans GuildVoice
            // On cherche dans le tableau channels, puis dans le sous-tableau members
            const activityCheck = await GuildVoice.findOne({ 
                guildId, 
                'channels.members.userId': userId 
            });
            
            console.log(`🔍 [getUserStats] Activité trouvée: ${activityCheck ? '✅ OUI' : '❌ NON'}`);
            
            if (!activityCheck) {
                // Double vérification avec une requête plus permissive
                const anyActivity = await GuildVoice.countDocuments({ 
                    guildId, 
                    'channels.members.userId': userId 
                });
                
                console.log(`🔍 [getUserStats] Double check - Nombre de sessions trouvées: ${anyActivity}`);
                
                if (anyActivity === 0) {
                    console.log(`❌ [getUserStats] AUCUNE ACTIVITÉ - Retour 404\n`);
                    return res.status(404).json({ 
                        message: 'Aucune activité vocale enregistrée pour cet utilisateur.' 
                    });
                }
            }
            
            // L'utilisateur a de l'activité, on calcule ses stats
            console.log(`🚀 [getUserStats] Lancement du calcul des stats pour ${userId}...`);
            
            try {
                await statsService.calculateAndSaveStatsForUsers(guildId, [userId]);
                console.log(`✅ [getUserStats] Stats calculées avec succès pour ${userId}`);
                
                // Réessayer de récupérer les stats
                userStats = await UserStats.findOne({ guildId, userId });
                
                if (!userStats) {
                    console.error(`❌ [getUserStats] ERREUR: Stats toujours non trouvées après calcul pour ${userId}`);
                    return res.status(500).json({ 
                        message: 'Erreur lors du calcul des statistiques. Les données ont été générées mais ne peuvent pas être récupérées.' 
                    });
                }
                
                console.log(`✅ [getUserStats] Stats récupérées avec succès après calcul pour ${userId}`);
            } catch (calcError) {
                console.error(`❌ [getUserStats] Erreur lors du calcul des stats pour ${userId}:`, calcError);
                return res.status(500).json({ 
                    message: `Erreur lors du calcul des statistiques: ${calcError.message}` 
                });
            }
        } else {
            console.log(`✅ [getUserStats] Stats trouvées en cache pour ${userId}`);
        }
        
        console.log(`\n🎉 [getUserStats] SUCCESS - Envoi des stats\n`);
        res.json(userStats);
    } catch (error) {
        console.error(`\n❌❌❌ [getUserStats] ERREUR GÉNÉRALE pour l'utilisateur ${req.params.userId}:`);
        console.error(error);
        console.error(`❌❌❌\n`);
        res.status(500).json({ message: `Erreur lors de la récupération des statistiques: ${error.message}` });
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

/**
 * Déclenche une mise à jour asynchrone des statistiques UNIQUEMENT pour un utilisateur donné.
 * Fournit un retour 202 immédiat pour ne pas bloquer l'UI.
 */
exports.updateUserStatsById = async (req, res) => {
    try {
        const { guildId, userId } = req.params;

        console.log(`⚙️  [updateUserStatsById] Déclenche mise à jour des stats pour user=${userId} guild=${guildId}`);
        // Fire & forget
        statsService.calculateAndSaveStatsForUsers(guildId, [userId])
            .then(() => console.log(`✅ [updateUserStatsById] Terminé pour ${userId}`))
            .catch(err => console.error(`❌ [updateUserStatsById] Échec pour ${userId}:`, err));

        return res.status(202).json({ message: `Calcul des statistiques lancé pour userId=${userId}` });
    } catch (error) {
        console.error(`Erreur lors du déclenchement de la mise à jour pour ${req.params.userId}:`, error);
        return res.status(500).json({ message: 'Erreur lors du déclenchement de la mise à jour des statistiques utilisateur.' });
    }
};

/**
 * Force le recalcul complet de toutes les statistiques pour une guilde.
 * Supprime toutes les stats existantes et les recalcule depuis zéro.
 * Retourne immédiatement (202) et effectue le calcul en arrière-plan.
 */
exports.forceRecalculateAllStats = async (req, res) => {
    try {
        const { guildId } = req.params;
        
        console.log(`🔄 [forceRecalculateAllStats] Début du recalcul forcé pour la guilde ${guildId}`);
        
        // Lancer le processus en arrière-plan
        (async () => {
            try {
                console.log(`🗑️  [forceRecalculateAllStats] Suppression des anciennes stats pour guild=${guildId}`);
                
                // Supprimer toutes les stats existantes pour cette guilde
                const deleteResult = await UserStats.deleteMany({ guildId });
                console.log(`✅ [forceRecalculateAllStats] ${deleteResult.deletedCount} entrées supprimées`);
                
                // Récupérer tous les utilisateurs uniques qui ont une activité
                const allUserIds = await GuildVoice.distinct('channels.members.userId', { guildId });
                console.log(`👥 [forceRecalculateAllStats] ${allUserIds.length} utilisateurs trouvés`);
                
                // Recalculer les stats pour tous les utilisateurs
                await statsService.calculateAndSaveStatsForUsers(guildId, allUserIds);
                
                console.log(`✅ [forceRecalculateAllStats] Recalcul complet terminé pour la guilde ${guildId}`);
            } catch (error) {
                console.error(`❌ [forceRecalculateAllStats] Erreur lors du recalcul pour guild=${guildId}:`, error);
            }
        })();
        
        return res.status(202).json({ 
            message: `Recalcul forcé des statistiques lancé pour la guilde ${guildId}. Les anciennes données seront supprimées et recalculées.` 
        });
    } catch (error) {
        console.error(`Erreur lors du déclenchement du recalcul forcé pour ${req.params.guildId}:`, error);
        return res.status(500).json({ message: 'Erreur lors du déclenchement du recalcul forcé des statistiques.' });
    }
};
