const mongoose = require('mongoose');

const userActivitySchema = new mongoose.Schema({
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
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  friendlyName: {
    type: String,
    required: true
  },
  // Le salon vocal actuel (null si pas en vocal)
  currentVoiceChannel: {
    channelId: String,
    friendlyName: String,
    joinTime: Date
  },
  // Autres membres présents dans le même salon
  voiceInteractions: [{
    userId: String,
    friendlyName: String
  }],
  // Nombre de messages envoyés dans la dernière minute
  messageCount: {
    type: Number,
    default: 0
  },
  // Canaux où des messages ont été envoyés
  messageChannels: [{
    channelId: String,
    friendlyName: String,
    count: Number
  }],
  // État de l'utilisateur
  status: {
    type: String,
    enum: ['online', 'offline', 'idle', 'dnd'],
    required: true
  },
  // Activité en cours (jeu, musique, etc.)
  activity: {
    name: String,
    type: String,  // PLAYING, STREAMING, LISTENING, WATCHING, CUSTOM, COMPETING
    startTime: Date
  }
}, {
  timestamps: true
});

// Index composés pour les requêtes courantes
userActivitySchema.index({ guildId: 1, userId: 1, timestamp: -1 });
userActivitySchema.index({ guildId: 1, timestamp: -1 });
userActivitySchema.index({ 'currentVoiceChannel.channelId': 1, timestamp: -1 });

// TTL index pour supprimer automatiquement les données après X jours (ici 30 jours)
userActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('UserActivity', userActivitySchema);
