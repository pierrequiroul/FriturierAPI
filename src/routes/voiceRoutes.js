const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voiceController');

// Route pour obtenir la liste des serveurs et leurs salons
router.get('/guilds', voiceController.getGuildsAndChannels);

// Routes pour l'activité des salons vocaux
router.post('/:guildId', voiceController.recordActivity);
router.get('/:guildId/', voiceController.getActivity);
router.get('/:guildId/:channelId/stats', voiceController.getStats);

module.exports = router;
