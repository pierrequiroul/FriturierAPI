const mongoose = require('mongoose');

// Un seul modèle pour toutes les activités en temps réel (à la minute)
const realtimeActivitySchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        required: true,
        index: true
    },
    // Snapshot de l'état du salon
    channel: {
        id: String,
        name: String,
        memberCount: Number,
        members: [{
            userId: String,
            username: String,
            joinedAt: Date,
            status: {
                type: String,
                enum: ['online', 'offline', 'idle', 'dnd']
            },
            activity: {
                name: String,
                type: String
            }
        }]
    },
    // Messages envoyés pendant cette minute
    messages: [{
        userId: String,
        username: String,
        channelId: String,
        channelName: String
    }]
}, {
    timestamps: true
});

// Index composés
realtimeActivitySchema.index({ guildId: 1, timestamp: -1 });
realtimeActivitySchema.index({ guildId: 1, 'channel.id': 1, timestamp: -1 });
realtimeActivitySchema.index({ guildId: 1, 'messages.userId': 1, timestamp: -1 });

// TTL index pour 30 jours
realtimeActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = {
    RealtimeActivity: mongoose.model('RealtimeActivity', realtimeActivitySchema)
};
