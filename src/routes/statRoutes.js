const express = require('express');
const router = express.Router();
const statController = require('../controllers/statController');
const voiceInteractionController = require('../controllers/voiceInteractionController');
const channelActivityController = require('../controllers/channelActivityController');
const userActivityController = require('../controllers/userActivityController');

// Routes pour la gestion des membres du serveur
router.post('/guild/join/:guildId/:userId', statController.handleGuildJoin);
router.post('/guild/leave/:guildId/:userId', statController.handleGuildLeave);

// Routes pour la gestion des salons vocaux
router.post('/channel/join/:guildId/:channelId/:userId', voiceInteractionController.handleVoiceJoin);
router.post('/channel/leave/:guildId/:channelId/:userId', voiceInteractionController.handleVoiceLeave);

// Routes pour les messages et interactions
router.post('/channel/message/:guildId/:channelId/:userId', voiceInteractionController.handleMessage);

// Routes pour obtenir les statistiques
router.get('/guild/:guildId', statController.getGuildStats);
router.get('/guild/:guildId/user/:userId', statController.getUserStats);
router.get('/guild/:guildId/channel/:channelId', statController.getChannelStats);

// Route pour obtenir les interactions d'un utilisateur
router.get('/interactions/:guildId/user/:userId', voiceInteractionController.getUserInteractions);

// Routes pour l'activité des salons vocaux
router.post('/voice/:guildId/:channelId', channelActivityController.recordVoiceActivity);
router.get('/voice/:guildId/:channelId', channelActivityController.getChannelActivity);
router.get('/voice/:guildId/:channelId/stats', channelActivityController.getChannelActivityStats);
router.get('/voice/:guildId/:channelId/peak-hours', channelActivityController.getChannelPeakHours);

// Route pour l'activité des messages
router.post('/message/:guildId/:channelId/:userId', channelActivityController.recordMessageActivity);

module.exports = router;
