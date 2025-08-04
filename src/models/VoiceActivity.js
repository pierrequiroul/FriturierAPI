const mongoose = require('mongoose');

const voiceActivitySchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    channelId: {
        type: String,
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        required: true,
        index: true
    },
    // État du salon vocal
    memberCount: {
        type: Number,
        required: true
    },
    members: [{
        userId: {
            type: String,
            required: true
        },
        username: {
            type: String,
            required: true
        },
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
}, {
    timestamps: true
});

// Index composés
voiceActivitySchema.index({ guildId: 1, channelId: 1, timestamp: -1 });
voiceActivitySchema.index({ guildId: 1, 'members.userId': 1, timestamp: -1 });

// TTL index pour 30 jours
voiceActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('VoiceActivity', voiceActivitySchema);
