const express = require('express');
const router = express.Router();
const discordController = require('../controllers/discordController');

// Route pour obtenir les informations d'une guilde
router.get('/guilds/:guildId', discordController.getGuild);

// Route pour obtenir les informations d'un utilisateur dans une guilde
router.get('/guilds/:guildId/users/:userId', discordController.getGuildUser);

// Route pour obtenir les informations d'un canal dans une guilde
router.get('/guilds/:guildId/channels/:channelId', discordController.getGuildChannel);

module.exports = router;