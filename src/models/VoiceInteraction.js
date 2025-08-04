const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  channelId: {
    type: String,
    required: true
  },
  friendlyName: {
    type: String,
    required: true
  },
  timeSpent: {
    type: Number,
    default: 0    // Temps total passé dans le canal en secondes
  },
  lastJoin: {
    type: Date,
    default: null
  }
});

const interactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  friendlyName: {
    type: String,
    required: true
  },
  timeSpentTogether: {
    type: Number,
    default: 0    // Temps total passé ensemble en secondes
  },
  lastVoiceInteraction: {
    type: Date,
    default: null
  },
  lastMessageInteraction: {
    type: Date,
    default: null
  },
  currentSession: {
    channelId: String,
    startTime: Date
  }
});

const voiceInteractionSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  friendlyName: {
    type: String,
    required: true
  },
  channels: [channelSchema],
  interactions: [interactionSchema]
}, {
  timestamps: true
});

// Index pour optimiser les requêtes
voiceInteractionSchema.index({ guildId: 1, userId: 1 });
voiceInteractionSchema.index({ 'channels.channelId': 1 });
voiceInteractionSchema.index({ 'interactions.userId': 1 });

module.exports = mongoose.model('VoiceInteraction', voiceInteractionSchema);
