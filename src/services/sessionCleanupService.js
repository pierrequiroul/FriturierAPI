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

// Délai de grâce minimum avant qu'une session puisse être fermée (en millisecondes) - 3 minutes
// Cela évite de fermer une session qui vient juste de démarrer au moment du boot de l'API
const MINIMUM_SESSION_AGE = 3 * 60 * 1000;

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
        // PROTECTION 1: Ne jamais fermer une session trop récente
        // Évite de fermer des sessions actives au démarrage de l'API
        const sessionAge = now - session.sessionStart;
        if (sessionAge < MINIMUM_SESSION_AGE) {
            console.log(`[SessionCleanup] Session ${session._id} trop récente (${Math.round(sessionAge / 60000)} min), ignorée`);
            return false;
        }

        // LOGIQUE PRINCIPALE: Une session doit être fermée SI ET SEULEMENT SI
        // il existe une session PLUS RÉCENTE pour la même guilde
        // Cela signifie que l'état a changé et qu'une nouvelle session a été créée
        const newerSession = await GuildVoice.findOne({
            guildId: session.guildId,
            sessionStart: { $gt: session.sessionStart }
        }).sort({ sessionStart: 1 }).limit(1);

        if (newerSession) {
            // Une session plus récente existe, donc celle-ci doit être fermée
            console.log(`[SessionCleanup] Session ${session._id} doit être fermée (remplacée par session ${newerSession._id})`);
            return true;
        }

        // Pas de session plus récente, donc celle-ci est toujours la session active
        // SAUF si elle est vraiment très ancienne (timeout de sécurité)
        if (sessionAge > SESSION_TIMEOUT) {
            console.warn(`[SessionCleanup] Session ${session._id} très ancienne (${Math.round(sessionAge / 60000)} min) sans nouvelle session - possible problème`);
            
            // Double vérification: est-ce que des membres sont vraiment présents dans Discord ?
            if (!client.isReady()) {
                console.warn(`[SessionCleanup] Client Discord non prêt, impossible de vérifier - session conservée par sécurité`);
                return false;
            }

            const guild = client.guilds.cache.get(session.guildId);
            if (!guild) {
                console.warn(`[SessionCleanup] Guilde ${session.guildId} non trouvée, session fermée`);
                return true;
            }

            // Vérifier si TOUS les canaux vocaux de la guilde sont vides
            const allVoiceChannels = guild.channels.cache.filter(ch => ch.type === 2); // Type 2 = GuildVoice
            let totalMembers = 0;
            allVoiceChannels.forEach(ch => {
                totalMembers += ch.members ? ch.members.size : 0;
            });

            if (totalMembers === 0) {
                console.log(`[SessionCleanup] Session ${session._id} expirée et aucun membre vocal détecté - fermeture`);
                return true;
            } else {
                console.warn(`[SessionCleanup] Session ${session._id} expirée MAIS ${totalMembers} membre(s) vocal présent(s) - CONSERVÉE (snapshot manquant?)`);
                return false;
            }
        }

        // Session récente et toujours active
        console.log(`[SessionCleanup] Session ${session._id} toujours active (âge: ${Math.round(sessionAge / 60000)} min)`);
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
