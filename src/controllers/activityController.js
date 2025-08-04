const { RealtimeActivity } = require('../models/RealtimeActivity');
const { UserHourlyStats, UserDailyStats } = require('../models/UserAggregatedStats');

function roundToMinute(date) {
    const d = new Date(date);
    d.setSeconds(0, 0);
    return d;
}

exports.recordActivity = async (req, res) => {
    try {
        const { guildId } = req.params;
        const {
            channelId,
            channelName,
            members,
            messages
        } = req.body;
        
        const now = roundToMinute(new Date());

        const activity = await RealtimeActivity.create({
            guildId,
            timestamp: now,
            channel: channelId ? {
                id: channelId,
                name: channelName,
                memberCount: members.length,
                members: members.map(m => ({
                    userId: m.userId,
                    username: m.username,
                    joinedAt: m.joinedAt,
                    status: m.status,
                    activity: m.activity
                }))
            } : null,
            messages: messages || []
        });

        res.json(activity);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getChannelActivity = async (req, res) => {
    try {
        const { guildId, channelId } = req.params;
        const { start, end, interval = 'minute' } = req.query;

        const startDate = new Date(start);
        const endDate = new Date(end);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        // Choisir la source de données en fonction de l'intervalle et de la période
        let Model;
        let groupByFormat;
        let additionalMatch = {};

        if (interval === 'minute' && endDate - startDate <= 30 * 24 * 60 * 60 * 1000) {
            // Données à la minute pour les 30 derniers jours
            Model = RealtimeActivity;
            groupByFormat = {
                year: { $year: '$timestamp' },
                month: { $month: '$timestamp' },
                day: { $dayOfMonth: '$timestamp' },
                hour: { $hour: '$timestamp' },
                minute: { $minute: '$timestamp' }
            };
            additionalMatch = { 'channel.id': channelId };
        } else if (interval === 'hour' && endDate - startDate <= 180 * 24 * 60 * 60 * 1000) {
            // Données horaires pour les 6 derniers mois
            Model = UserHourlyStats;
            groupByFormat = {
                year: { $year: '$date' },
                month: { $month: '$date' },
                day: { $dayOfMonth: '$date' },
                hour: { $hour: '$date' }
            };
        } else {
            // Données journalières pour le reste
            Model = UserDailyStats;
            groupByFormat = {
                year: { $year: '$date' },
                month: { $month: '$date' },
                day: { $dayOfMonth: '$date' }
            };
        }

        const activities = await Model.aggregate([
            {
                $match: {
                    guildId,
                    timestamp: { $gte: startDate, $lte: endDate },
                    ...additionalMatch
                }
            },
            {
                $group: {
                    _id: groupByFormat,
                    memberCount: { $avg: interval === 'minute' ? '$channel.memberCount' : '$memberCount' },
                    uniqueMembers: {
                        $addToSet: interval === 'minute' ? '$channel.members.userId' : '$uniqueMembers'
                    }
                }
            },
            {
                $sort: {
                    '_id.year': 1,
                    '_id.month': 1,
                    '_id.day': 1,
                    '_id.hour': 1,
                    '_id.minute': 1
                }
            }
        ]);

        res.json(activities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getUserActivity = async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        const { start, end, interval = 'minute' } = req.query;

        const startDate = new Date(start);
        const endDate = new Date(end);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        let Model;
        if (interval === 'minute' && endDate - startDate <= 30 * 24 * 60 * 60 * 1000) {
            Model = RealtimeActivity;
        } else if (interval === 'hour' && endDate - startDate <= 180 * 24 * 60 * 60 * 1000) {
            Model = UserHourlyStats;
        } else {
            Model = UserDailyStats;
        }

        const pipeline = [
            {
                $match: {
                    guildId,
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            }
        ];

        if (Model === RealtimeActivity) {
            // Pour les données en temps réel
            pipeline.push(
                {
                    $match: {
                        $or: [
                            { 'channel.members.userId': userId },
                            { 'messages.userId': userId }
                        ]
                    }
                }
            );
        } else {
            // Pour les données agrégées
            pipeline.push(
                {
                    $match: { userId }
                }
            );
        }

        const activities = await Model.aggregate(pipeline);
        res.json(activities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Autres endpoints pour les statistiques spécifiques...
