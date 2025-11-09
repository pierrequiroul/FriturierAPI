const GuildVoice = require('../models/GuildVoice');
const statsService = require('./statsService');
const client = require('./discordClient');

/**
 * Service de nettoyage automatique des sessions vocales.
 * Ferme les sessions où tous les canaux sont vides mais sessionEnd n'est pas défini.
 */

// Intervalle de vérification (en millisecondes) - toutes les 2 minutes
const CLEANUP_INTERVAL = 2 * 60 * 1000;

// Timeout de session inactive (en millisecondes) - 5 minutes
const SESSION_TIMEOUT = 5 * 60 * 1000;

let cleanupTimer = null;

/**
 * Démarre le service de nettoyage périodique
 */
function startCleanupService() {
    if (cleanupTimer) {
        console.log('[SessionCleanup] Service déjà démarré');
        return;
    }

    console.log('[SessionCleanup] Démarrage du service de nettoyage automatique des sessions');
    
    // Exécuter immédiatement au démarrage
    performCleanup();
    
    // Puis exécuter périodiquement
    cleanupTimer = setInterval(() => {
        performCleanup();
    }, CLEANUP_INTERVAL);
}

/**
 * Arrête le service de nettoyage
 */
function stopCleanupService() {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
        console.log('[SessionCleanup] Service de nettoyage arrêté');
    }
}

/**
 * Exécute le nettoyage des sessions
 */
async function performCleanup() {
    try {
        const now = new Date();
        
        // Trouver toutes les sessions non fermées
        const openSessions = await GuildVoice.find({ 
            sessionEnd: null 
        }).sort({ sessionStart: -1 });

        if (openSessions.length === 0) {
            console.log('[SessionCleanup] Aucune session ouverte à vérifier');
            return;
        }

        console.log(`[SessionCleanup] Vérification de ${openSessions.length} session(s) ouverte(s)`);
        
        let closedCount = 0;
        let errorCount = 0;

        for (const session of openSessions) {
            try {
                const shouldClose = await shouldCloseSession(session, now);
                
                if (shouldClose) {
                    // Fermer la session
                    session.sessionEnd = now;
                    await session.save();
                    closedCount++;

                    console.log(`[SessionCleanup] Session ${session._id} fermée (guild: ${session.guildId})`);

                    // Déclencher la mise à jour des stats pour les utilisateurs affectés
                    const affectedUserIds = [...new Set(
                        session.channels.flatMap(ch => ch.members.map(m => m.userId))
                    )];
                    
                    if (affectedUserIds.length > 0) {
                        // Mise à jour en arrière-plan
                        statsService.calculateAndSaveStatsForUsers(session.guildId, affectedUserIds)
                            .catch(err => console.error(`[SessionCleanup] Erreur mise à jour stats:`, err));
                    }
                }
            } catch (err) {
                errorCount++;
                console.error(`[SessionCleanup] Erreur lors du traitement de la session ${session._id}:`, err);
            }
        }

        if (closedCount > 0 || errorCount > 0) {
            console.log(`[SessionCleanup] Nettoyage terminé: ${closedCount} session(s) fermée(s), ${errorCount} erreur(s)`);
        }
    } catch (err) {
        console.error('[SessionCleanup] Erreur globale lors du nettoyage:', err);
    }
}

/**
 * Détermine si une session doit être fermée
 * @param {Object} session - La session à vérifier
 * @param {Date} now - La date/heure actuelle
 * @returns {Promise<boolean>} - true si la session doit être fermée
 */
async function shouldCloseSession(session, now) {
    try {
        // Vérifier si le bot Discord est prêt
        if (!client.isReady()) {
            console.warn(`[SessionCleanup] Client Discord non prêt, impossible de vérifier la session ${session._id}`);
            // Fallback: fermer si la session est très ancienne (timeout)
            const sessionAge = now - session.sessionStart;
            return sessionAge > SESSION_TIMEOUT;
        }

        // Récupérer la guilde
        const guild = client.guilds.cache.get(session.guildId);
        if (!guild) {
            console.warn(`[SessionCleanup] Guilde ${session.guildId} non trouvée, fermeture de la session ${session._id}`);
            return true;
        }

        // Vérifier chaque canal de la session
        let hasActiveMembers = false;

        for (const channelData of session.channels) {
            const channel = guild.channels.cache.get(channelData.channelId);
            
            // Si le canal n'existe plus, le considérer comme vide
            if (!channel) {
                continue;
            }

            // Vérifier s'il y a des membres dans le canal
            if (channel.members && channel.members.size > 0) {
                hasActiveMembers = true;
                break;
            }
        }

        // Si aucun membre actif n'est trouvé, fermer la session
        if (!hasActiveMembers) {
            console.log(`[SessionCleanup] Session ${session._id} sans membres actifs détectée`);
            return true;
        }

        // Vérifier aussi le timeout (sécurité supplémentaire)
        const sessionAge = now - session.sessionStart;
        if (sessionAge > SESSION_TIMEOUT) {
            // Session ouverte depuis trop longtemps sans changement d'état
            // Cela peut arriver si le bot a manqué des événements
            console.log(`[SessionCleanup] Session ${session._id} expirée (timeout: ${Math.round(sessionAge / 60000)} min)`);
            return true;
        }

        return false;
    } catch (err) {
        console.error(`[SessionCleanup] Erreur lors de la vérification de la session ${session._id}:`, err);
        // En cas d'erreur, ne pas fermer la session par sécurité
        return false;
    }
}

/**
 * Force un nettoyage immédiat (pour tests ou commandes manuelles)
 */
async function forceCleanup() {
    console.log('[SessionCleanup] Nettoyage forcé déclenché');
    await performCleanup();
}

module.exports = {
    startCleanupService,
    stopCleanupService,
    forceCleanup
};
