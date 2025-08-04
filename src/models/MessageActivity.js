const mongoose = require('mongoose');

const messageActivitySchema = new mongoose.Schema({
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
    userId: {
        type: String,
        required: true,
        index: true
    },
    username: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        required: true,
        index: true
    }
}, {
    timestamps: true
});

// Index composés
messageActivitySchema.index({ guildId: 1, channelId: 1, timestamp: -1 });
messageActivitySchema.index({ guildId: 1, userId: 1, timestamp: -1 });

// TTL index pour 30 jours
messageActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('MessageActivity', messageActivitySchema);
