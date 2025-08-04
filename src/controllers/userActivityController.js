const UserActivity = require('../models/UserActivity');

// Fonction utilitaire pour arrondir une date à la minute
function roundToMinute(date) {
    const d = new Date(date);
    d.setSeconds(0, 0);
    return d;
}

exports.recordUserActivity = async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        const {
            username,
            status,
            currentVoiceChannel,
            voiceInteractions,
            messageChannels,
            activity,
            messageCount
        } = req.body;

        const now = roundToMinute(new Date());

        const userActivity = await UserActivity.create({
            guildId,
            userId,
            timestamp: now,
            friendlyName: username,
            status,
            currentVoiceChannel,
            voiceInteractions,
            messageChannels,
            messageCount,
            activity
        });

        res.json(userActivity);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getUserActivity = async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        const { start, end } = req.query;

        const startDate = new Date(start);
        const endDate = new Date(end);

        const activities = await UserActivity.find({
            guildId,
            userId,
            timestamp: {
                $gte: startDate,
                $lte: endDate
            }
        }).sort({ timestamp: 1 });

        res.json(activities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getUserStats = async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        const { start, end } = req.query;

        const startDate = new Date(start);
        const endDate = new Date(end);

        const stats = await UserActivity.aggregate([
            {
                $match: {
                    guildId,
                    userId,
                    timestamp: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    // Temps total en vocal
                    totalVoiceTime: {
                        $sum: {
                            $cond: [
                                { $ne: ["$currentVoiceChannel", null] },
                                1, // Compte 1 minute si en vocal
                                0
                            ]
                        }
                    },
                    // Total des messages
                    totalMessages: { $sum: "$messageCount" },
                    // Canaux vocaux utilisés
                    voiceChannels: {
                        $addToSet: "$currentVoiceChannel.channelId"
                    },
                    // Interactions uniques
                    uniqueInteractions: {
                        $addToSet: "$voiceInteractions.userId"
                    },
                    // Statuts
                    statusCounts: {
                        $push: "$status"
                    },
                    // Activités
                    activities: {
                        $addToSet: "$activity.name"
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalVoiceMinutes: "$totalVoiceTime",
                    totalMessages: 1,
                    uniqueVoiceChannels: { $size: "$voiceChannels" },
                    uniqueInteractions: { $size: "$uniqueInteractions" },
                    statusStats: {
                        $map: {
                            input: ["online", "offline", "idle", "dnd"],
                            as: "status",
                            in: {
                                status: "$$status",
                                count: {
                                    $size: {
                                        $filter: {
                                            input: "$statusCounts",
                                            cond: { $eq: ["$$this", "$$status"] }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    activities: 1
                }
            }
        ]);

        res.json(stats[0] || {
            totalVoiceMinutes: 0,
            totalMessages: 0,
            uniqueVoiceChannels: 0,
            uniqueInteractions: 0,
            statusStats: [],
            activities: []
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getUserPeakHours = async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        const { start, end } = req.query;

        const startDate = new Date(start);
        const endDate = new Date(end);

        const peakHours = await UserActivity.aggregate([
            {
                $match: {
                    guildId,
                    userId,
                    timestamp: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: {
                        hour: { $hour: "$timestamp" },
                        dayOfWeek: { $dayOfWeek: "$timestamp" }
                    },
                    voiceMinutes: {
                        $sum: {
                            $cond: [
                                { $ne: ["$currentVoiceChannel", null] },
                                1,
                                0
                            ]
                        }
                    },
                    messageCount: { $sum: "$messageCount" },
                    samples: { $sum: 1 }
                }
            },
            {
                $sort: {
                    "voiceMinutes": -1,
                    "messageCount": -1
                }
            }
        ]);

        res.json(peakHours);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getMostInteractedWith = async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        const { start, end } = req.query;

        const startDate = new Date(start);
        const endDate = new Date(end);

        const interactions = await UserActivity.aggregate([
            {
                $match: {
                    guildId,
                    userId,
                    timestamp: {
                        $gte: startDate,
                        $lte: endDate
                    },
                    voiceInteractions: { $ne: [] }
                }
            },
            {
                $unwind: "$voiceInteractions"
            },
            {
                $group: {
                    _id: "$voiceInteractions.userId",
                    friendlyName: { $last: "$voiceInteractions.friendlyName" },
                    minutesTogether: { $sum: 1 },
                    lastInteraction: { $max: "$timestamp" }
                }
            },
            {
                $sort: {
                    minutesTogether: -1
                }
            }
        ]);

        res.json(interactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
