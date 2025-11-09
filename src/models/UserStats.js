const mongoose = require('mongoose');

const friendSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    timeSpentTogether: { type: Number, default: 0 }
}, { _id: false });

const periodStatsSchema = new mongoose.Schema({
    timeSpent: { type: Number, default: 0 },
    timeSpentAlone: { type: Number, default: 0 },
    timeAfk: { type: Number, default: 0 },
    averageTime: { type: Number, default: 0 },
    bestFriends: [friendSchema]
}, { _id: false });

const userStatsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    nickname: { type: String },
    discriminator: { type: String },
    avatar: { type: String },
    avatarDecoration: { type: String },
    isBot: { type: Boolean, default: false },
    stats: {
        last24h: periodStatsSchema,
        last7d: periodStatsSchema,
        last30d: periodStatsSchema,
        allTime: periodStatsSchema
    },
    lastUpdatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

userStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

const UserStats = mongoose.model('UserStats', userStatsSchema);

module.exports = UserStats;