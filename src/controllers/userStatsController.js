const UserStats = require('../models/UserStats');
const statsService = require('../services/statsService');

/**
 * Calcule et met à jour les statistiques pour tous les utilisateurs d'une guilde.
 * C'est une opération potentiellement longue.
 */
exports.updateAllUserStats = async (req, res) => {
    try {
        const { guildId } = req.params;
        
        // Délègue le calcul au service. On n'attend pas la fin pour répondre rapidement.
        statsService.updateAllUserStats(guildId);
        
        res.status(202).json({ message: `La mise à jour des statistiques pour la guilde ${guildId} a été lancée en arrière-plan.` });
    } catch (error) {
        console.error(`Erreur lors de la mise à jour des statistiques pour la guilde ${req.params.guildId}:`, error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour des statistiques.' });
    }
};
/**
 * Récupère les statistiques pré-calculées d'un utilisateur.
 */
exports.getUserStats = async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        const userStats = await UserStats.findOne({ guildId, userId });
        if (!userStats) {
            return res.status(404).json({ message: 'Aucune statistique trouvée pour cet utilisateur.' });
        }
        res.json(userStats);
    } catch (error) {
        console.error(`Erreur lors de la récupération des stats pour l'utilisateur ${req.params.userId}:`, error);
        res.status(500).json({ message: 'Erreur lors de la récupération des statistiques.' });
    }
};