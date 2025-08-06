const mongoose = require('mongoose');

const guildVoiceSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    sessionStart: {
        type: Date,
        required: true
    },
    sessionEnd: {
        type: Date,
        default: null
    },
    channels: [{
        channelId: {
            type: String,
            required: true
        },
        channelName: {
            type: String,
            default: function() {
                return `Canal ${this.channelId}`;
            }
        },
        members: [{
            userId: {
                type: String,
                required: true
            },
            username: {
                type: String,
                required: true
            }
        }]
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual pour memberCount
guildVoiceSchema.virtual('channels.memberCount').get(function() {
    return this.members ? this.members.length : 0;
});

// Virtual pour duration (en secondes)
guildVoiceSchema.virtual('duration').get(function() {
    if (!this.sessionEnd) return null;
    return Math.round((this.sessionEnd - this.sessionStart) / 1000);
});

// Méthode pour obtenir le memberCount d'un canal
guildVoiceSchema.methods.getChannelMemberCount = function(channelId) {
    const channel = this.channels.find(ch => ch.channelId === channelId);
    return channel ? channel.members.length : 0;
};

// Index pour les requêtes fréquentes
guildVoiceSchema.index({ guildId: 1, sessionStart: -1 });
guildVoiceSchema.index({ 'channels.channelId': 1, sessionStart: -1 });
// L'index TTL a été commenté pour permettre la conservation de l'historique complet des données.
// guildVoiceSchema.index({ sessionStart: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // TTL 30 jours

// Forcer la reconstruction des index au démarrage
const GuildVoice = mongoose.model('GuildVoice', guildVoiceSchema);
// La suppression des index au démarrage est généralement déconseillée en production.
// GuildVoice.collection.dropIndexes().catch(console.error);

module.exports = GuildVoice;
