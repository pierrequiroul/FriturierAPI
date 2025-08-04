const mongoose = require('mongoose');

const channelActivitySchema = new mongoose.Schema({
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
  // Nombre de personnes présentes dans le salon
  memberCount: {
    type: Number,
    required: true,
    default: 0
  },
  // Liste des membres présents avec leur nom
  members: [{
    userId: String,
    friendlyName: String
  }]
}, {
  timestamps: true
});

// Index composé pour les requêtes courantes
channelActivitySchema.index({ guildId: 1, channelId: 1, timestamp: -1 });

// TTL index pour supprimer automatiquement les données après X jours (ici 30 jours)
channelActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('ChannelActivity', channelActivitySchema);
