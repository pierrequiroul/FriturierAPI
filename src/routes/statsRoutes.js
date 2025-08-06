const express = require('express');
const router = express.Router();
const userStatsController = require('../controllers/userStatsController');

// Route pour déclencher la mise à jour manuelle des statistiques pour une guilde
router.post('/update/:guildId', userStatsController.updateAllUserStats);
router.post('/update/:guildId/:userId', userStatsController.recordUserStats);

module.exports = router;