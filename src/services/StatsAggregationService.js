const { UserHourlyStats, UserDailyStats } = require('../models/UserAggregatedStats');
const UserActivity = require('../models/UserActivity');

class StatsAggregationService {
    static async aggregateToHourly(guildId, userId, date) {
        const startOfHour = new Date(date);
        startOfHour.setMinutes(0, 0, 0);
        const endOfHour = new Date(startOfHour);
        endOfHour.setHours(startOfHour.getHours() + 1);

        // Récupérer toutes les activités de l'heure
        const activities = await UserActivity.find({
            guildId,
            userId,
            timestamp: {
                $gte: startOfHour,
                $lt: endOfHour
            }
        });

        if (activities.length === 0) return null;

        // Préparer les structures pour l'agrégation
        const voiceChannels = new Map();
        const messageChannels = new Map();
        const voiceInteractions = new Map();
        const presenceStats = { online: 0, offline: 0, idle: 0, dnd: 0 };
        const activityStats = new Map();

        // Agréger les données
        activities.forEach(activity => {
            // Compter les minutes de présence
            presenceStats[activity.status]++;

            // Vocal
            if (activity.currentVoiceChannel) {
                const channel = activity.currentVoiceChannel;
                const current = voiceChannels.get(channel.channelId) || { 
                    friendlyName: channel.friendlyName, 
                    minutes: 0 
                };
                current.minutes++;
                voiceChannels.set(channel.channelId, current);

                // Interactions vocales
                activity.voiceInteractions.forEach(interaction => {
                    const current = voiceInteractions.get(interaction.userId) || {
                        friendlyName: interaction.friendlyName,
                        minutes: 0
                    };
                    current.minutes++;
                    voiceInteractions.set(interaction.userId, current);
                });
            }

            // Messages
            activity.messageChannels?.forEach(channel => {
                const current = messageChannels.get(channel.channelId) || {
                    friendlyName: channel.friendlyName,
                    count: 0
                };
                current.count += channel.count;
                messageChannels.set(channel.channelId, current);
            });

            // Activités
            if (activity.activity?.name) {
                const current = activityStats.get(activity.activity.name) || 0;
                activityStats.set(activity.activity.name, current + 1);
            }
        });

        // Créer l'agrégation horaire
        const hourKey = startOfHour.toISOString().slice(0, 13).replace(/[-:]/g, '-');
        
        return await UserHourlyStats.findOneAndUpdate(
            {
                guildId,
                userId,
                hourKey
            },
            {
                $set: {
                    friendlyName: activities[0].friendlyName,
                    date: startOfHour,
                    'voiceTime.total': Array.from(voiceChannels.values()).reduce((sum, ch) => sum + ch.minutes, 0),
                    'voiceTime.byChannel': Array.from(voiceChannels.entries()).map(([id, data]) => ({
                        channelId: id,
                        friendlyName: data.friendlyName,
                        minutes: data.minutes
                    })),
                    'messages.total': Array.from(messageChannels.values()).reduce((sum, ch) => sum + ch.count, 0),
                    'messages.byChannel': Array.from(messageChannels.entries()).map(([id, data]) => ({
                        channelId: id,
                        friendlyName: data.friendlyName,
                        count: data.count
                    })),
                    voiceInteractions: Array.from(voiceInteractions.entries()).map(([id, data]) => ({
                        userId: id,
                        friendlyName: data.friendlyName,
                        minutes: data.minutes
                    })),
                    presence: presenceStats,
                    activities: Array.from(activityStats.entries()).map(([name, minutes]) => ({
                        name,
                        minutes
                    }))
                }
            },
            { upsert: true, new: true }
        );
    }

    static async aggregateToDaily(guildId, userId, date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(startOfDay.getDate() + 1);

        // Récupérer toutes les stats horaires de la journée
        const hourlyStats = await UserHourlyStats.find({
            guildId,
            userId,
            date: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        });

        if (hourlyStats.length === 0) return null;

        // Préparer les distributions horaires
        const voiceDistribution = Array(24).fill(0);
        const messageDistribution = Array(24).fill(0);

        // Structures pour l'agrégation
        const voiceChannels = new Map();
        const messageChannels = new Map();
        const voiceInteractions = new Map();
        const presenceStats = { online: 0, offline: 0, idle: 0, dnd: 0 };
        const activityStats = new Map();

        // Agréger les données horaires
        hourlyStats.forEach(hourStat => {
            const hour = new Date(hourStat.date).getHours();

            // Distribution horaire
            voiceDistribution[hour] = hourStat.voiceTime.total || 0;
            messageDistribution[hour] = hourStat.messages.total || 0;

            // Vocal par canal
            hourStat.voiceTime.byChannel?.forEach(channel => {
                const current = voiceChannels.get(channel.channelId) || {
                    friendlyName: channel.friendlyName,
                    minutes: 0
                };
                current.minutes += channel.minutes;
                voiceChannels.set(channel.channelId, current);
            });

            // Messages par canal
            hourStat.messages.byChannel?.forEach(channel => {
                const current = messageChannels.get(channel.channelId) || {
                    friendlyName: channel.friendlyName,
                    count: 0
                };
                current.count += channel.count;
                messageChannels.set(channel.channelId, current);
            });

            // Interactions vocales
            hourStat.voiceInteractions?.forEach(interaction => {
                const current = voiceInteractions.get(interaction.userId) || {
                    friendlyName: interaction.friendlyName,
                    minutes: 0
                };
                current.minutes += interaction.minutes;
                voiceInteractions.set(interaction.userId, current);
            });

            // Présence
            Object.entries(hourStat.presence).forEach(([status, minutes]) => {
                presenceStats[status] += minutes;
            });

            // Activités
            hourStat.activities?.forEach(activity => {
                const current = activityStats.get(activity.name) || 0;
                activityStats.set(activity.name, current + activity.minutes);
            });
        });

        const dateKey = startOfDay.toISOString().slice(0, 10);

        // Créer l'agrégation journalière
        return await UserDailyStats.findOneAndUpdate(
            {
                guildId,
                userId,
                dateKey
            },
            {
                $set: {
                    friendlyName: hourlyStats[0].friendlyName,
                    date: startOfDay,
                    'voiceTime.total': Array.from(voiceChannels.values()).reduce((sum, ch) => sum + ch.minutes, 0),
                    'voiceTime.byChannel': Array.from(voiceChannels.entries()).map(([id, data]) => ({
                        channelId: id,
                        friendlyName: data.friendlyName,
                        minutes: data.minutes
                    })),
                    'voiceTime.hourlyDistribution': voiceDistribution,
                    'messages.total': Array.from(messageChannels.values()).reduce((sum, ch) => sum + ch.count, 0),
                    'messages.byChannel': Array.from(messageChannels.entries()).map(([id, data]) => ({
                        channelId: id,
                        friendlyName: data.friendlyName,
                        count: data.count
                    })),
                    'messages.hourlyDistribution': messageDistribution,
                    // Top 10 des interactions
                    topInteractions: Array.from(voiceInteractions.entries())
                        .map(([id, data]) => ({
                            userId: id,
                            friendlyName: data.friendlyName,
                            minutes: data.minutes
                        }))
                        .sort((a, b) => b.minutes - a.minutes)
                        .slice(0, 10),
                    presence: presenceStats,
                    // Top 5 des activités
                    topActivities: Array.from(activityStats.entries())
                        .map(([name, minutes]) => ({ name, minutes }))
                        .sort((a, b) => b.minutes - a.minutes)
                        .slice(0, 5)
                }
            },
            { upsert: true, new: true }
        );
    }

    // Fonction pour déclencher l'agrégation horaire
    static async aggregateLastHour(guildId) {
        const lastHour = new Date();
        lastHour.setHours(lastHour.getHours() - 1);

        const users = await UserActivity.distinct('userId', {
            guildId,
            timestamp: {
                $gte: lastHour
            }
        });

        for (const userId of users) {
            await this.aggregateToHourly(guildId, userId, lastHour);
        }
    }

    // Fonction pour déclencher l'agrégation journalière
    static async aggregateLastDay(guildId) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const users = await UserHourlyStats.distinct('userId', {
            guildId,
            date: {
                $gte: yesterday
            }
        });

        for (const userId of users) {
            await this.aggregateToDaily(guildId, userId, yesterday);
        }
    }
}

module.exports = StatsAggregationService;
