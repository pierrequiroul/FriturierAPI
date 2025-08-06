const express = require('express');
const router = express.Router();
const discordController = require('../controllers/discordController');
const voiceController = require('../controllers/voiceController');
const userStatsController = require('../controllers/userStatsController');

// Ces routes sont "sûres" car elles sont appelées par le frontend servi par ce même serveur.
// Elles ne nécessitent pas de clé d'API car l'authentification est implicite (le client a déjà accès à la page).

// Route pour obtenir les informations de plusieurs utilisateurs en une seule fois
router.post('/guilds/:guildId/users/bulk', discordController.getGuildUsersBulk);

// Route pour obtenir les informations de plusieurs canaux en une seule fois
router.post('/guilds/:guildId/channels/bulk', discordController.getGuildChannelsBulk);

// Route pour obtenir les données d'activité pour le graphique principal
router.get('/guilds/:guildId/activity', voiceController.getGuildActivity);

// Route pour obtenir les statistiques détaillées d'un utilisateur
router.get('/guilds/:guildId/users/:userId/stats', userStatsController.getUserStats);

// Route pour lancer la mise à jour manuelle des statistiques pour une guilde (déclenchée par le bouton du dashboard)
router.post('/guilds/:guildId/stats/update', userStatsController.updateAllUserStats);

module.exports = router;