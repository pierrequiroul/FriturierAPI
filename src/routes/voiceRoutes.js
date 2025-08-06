const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voiceController');

// Route pour obtenir la liste des serveurs et leurs salons
router.get('/guilds', voiceController.getGuildsAndChannels);

// Routes pour l'activité des salons vocaux
router.post('/:guildId', voiceController.recordGuildActivity);
router.get('/:guildId/', voiceController.getGuildActivity);

module.exports = router;
