const mongoose = require('mongoose');

const userHourlyStatsSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  friendlyName: {
    type: String,
    required: true
  },
  // Année-Mois-Jour-Heure (2025-08-04-15)
  hourKey: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  // Temps passé en vocal (en minutes)
  voiceTime: {
    total: Number,
    byChannel: [{
      channelId: String,
      friendlyName: String,
      minutes: Number
    }]
  },
  // Messages
  messages: {
    total: Number,
    byChannel: [{
      channelId: String,
      friendlyName: String,
      count: Number
    }]
  },
  // Interactions vocales
  voiceInteractions: [{
    userId: String,
    friendlyName: String,
    minutes: Number
  }],
  // Statistiques de présence
  presence: {
    online: Number,    // minutes
    offline: Number,
    idle: Number,
    dnd: Number
  },
  // Activités (jeux, etc.)
  activities: [{
    name: String,
    minutes: Number
  }]
}, {
  timestamps: true
});

// Index composés
userHourlyStatsSchema.index({ guildId: 1, userId: 1, date: 1 });
// TTL index pour 6 mois
userHourlyStatsSchema.index({ date: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

const userDailyStatsSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  friendlyName: {
    type: String,
    required: true
  },
  // Année-Mois-Jour (2025-08-04)
  dateKey: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  // Temps total en vocal (en minutes)
  voiceTime: {
    total: Number,
    byChannel: [{
      channelId: String,
      friendlyName: String,
      minutes: Number
    }],
    // Distribution par heure
    hourlyDistribution: {
      type: [Number],  // 24 valeurs, une par heure
      default: Array(24).fill(0)
    }
  },
  // Messages
  messages: {
    total: Number,
    byChannel: [{
      channelId: String,
      friendlyName: String,
      count: Number
    }],
    // Distribution par heure
    hourlyDistribution: {
      type: [Number],
      default: Array(24).fill(0)
    }
  },
  // Top 10 des interactions vocales
  topInteractions: [{
    userId: String,
    friendlyName: String,
    minutes: Number
  }],
  // Temps moyen par session vocale (en minutes)
  averageSessionDuration: Number,
  // Nombre de sessions vocales
  sessionCount: Number,
  // Présence (en minutes)
  presence: {
    online: Number,
    offline: Number,
    idle: Number,
    dnd: Number
  },
  // Top 5 des activités
  topActivities: [{
    name: String,
    minutes: Number
  }]
}, {
  timestamps: true
});

// Index composés
userDailyStatsSchema.index({ guildId: 1, userId: 1, date: 1 });
// TTL index pour 5 ans
userDailyStatsSchema.index({ date: 1 }, { expireAfterSeconds: 5 * 365 * 24 * 60 * 60 });

module.exports = {
  UserHourlyStats: mongoose.model('UserHourlyStats', userHourlyStatsSchema),
  UserDailyStats: mongoose.model('UserDailyStats', userDailyStatsSchema)
};
