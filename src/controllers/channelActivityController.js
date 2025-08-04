const VoiceActivity = require('../models/VoiceActivity');
const MessageActivity = require('../models/MessageActivity');

// Fonction utilitaire pour arrondir une date à la minute
function roundToMinute(date) {
    const d = new Date(date);
    d.setSeconds(0, 0);
    return d;
}

// Enregistrer l'activité vocale (appelé toutes les minutes)
exports.recordVoiceActivity = async (req, res) => {
    try {
        const { guildId, channelId } = req.params;
        const { members } = req.body;
        const now = roundToMinute(new Date());

        const activity = await VoiceActivity.create({
            guildId,
            channelId,
            timestamp: now,
            memberCount: members.length,
            members: members.map(m => ({
                userId: m.userId,
                username: m.username,
                joinedAt: m.joinedAt,
                status: m.status,
                activity: m.activity
            }))
        });

        res.json(activity);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Enregistrer une activité de message (appelé à chaque message)
exports.recordMessageActivity = async (req, res) => {
    try {
        const { guildId, channelId, userId } = req.params;
        const { username } = req.body;

        const activity = await MessageActivity.create({
            guildId,
            channelId,
            userId,
            username,
            timestamp: new Date()
        });

        res.json(activity);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getChannelActivity = async (req, res) => {
    try {
        const { guildId, channelId } = req.params;
        const { start, end } = req.query;

        const startDate = new Date(start);
        const endDate = new Date(end);

        // Vérification de la validité des dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        const activities = await ChannelActivity.aggregate([
            {
                $match: {
                    guildId,
                    channelId,
                    timestamp: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $sort: {
                    timestamp: 1
                }
            }
        ]);

        res.json(activities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getChannelActivityStats = async (req, res) => {
    try {
        const { guildId, channelId } = req.params;
        const { start, end } = req.query;

        const startDate = new Date(start);
        const endDate = new Date(end);

        // Vérification de la validité des dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        const stats = await ChannelActivity.aggregate([
            {
                $match: {
                    guildId,
                    channelId,
                    timestamp: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgMembers: { $avg: '$memberCount' },
                    maxMembers: { $max: '$memberCount' },
                    totalSamples: { $sum: 1 },
                    uniqueMembers: { 
                        $addToSet: '$members.userId'
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    avgMembers: 1,
                    maxMembers: 1,
                    totalSamples: 1,
                    uniqueMemberCount: { $size: '$uniqueMembers' }
                }
            }
        ]);

        res.json(stats[0] || {
            avgMembers: 0,
            maxMembers: 0,
            totalSamples: 0,
            uniqueMemberCount: 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Obtenir les heures les plus actives
exports.getChannelPeakHours = async (req, res) => {
    try {
        const { guildId, channelId } = req.params;
        const { start, end } = req.query;

        const startDate = new Date(start);
        const endDate = new Date(end);

        const peakHours = await ChannelActivity.aggregate([
            {
                $match: {
                    guildId,
                    channelId,
                    timestamp: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: {
                        hour: { $hour: '$timestamp' },
                        dayOfWeek: { $dayOfWeek: '$timestamp' }
                    },
                    avgMembers: { $avg: '$memberCount' },
                    maxMembers: { $max: '$memberCount' },
                    samples: { $sum: 1 }
                }
            },
            {
                $sort: {
                    'avgMembers': -1
                }
            }
        ]);

        res.json(peakHours);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
