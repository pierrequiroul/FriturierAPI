const mongoose = require('mongoose');

const statSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
  },
  channelId: {
    type: String,
    required: false, // Optionnel car peut être null pour les stats de guild
  },
  userId: {
    type: String,
    required: true,
  },
  messageCount: {
    type: Number,
    default: 0,
  },
  voiceTimeTotal: {
    type: Number, // Temps total en secondes
    default: 0,
  },
  joinDate: {
    type: Date,
    default: null,
  },
  leaveDate: {
    type: Date,
    default: null,
  },
  voiceJoinDate: {
    type: Date,
    default: null,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true,
});

// Index pour optimiser les requêtes
statSchema.index({ guildId: 1, channelId: 1, userId: 1 });

module.exports = mongoose.model('Stat', statSchema);
