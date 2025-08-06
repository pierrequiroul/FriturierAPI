const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voiceController');

// Routes pour l'activité des salons vocaux
router.post('/:guildId', voiceController.recordGuildActivity);

module.exports = router;
