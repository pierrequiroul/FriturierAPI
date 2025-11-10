/**
 * Script pour forcer le recalcul de toutes les statistiques utilisateur
 * Usage: node force_recalculate_stats.js <guildId>
 * Exemple: node force_recalculate_stats.js 355051708503687168
 */

require('dotenv').config();
const mongoose = require('mongoose');
const GuildVoice = require('../models/GuildVoice');
const UserStats = require('../models/UserStats');
const statsService = require('../services/statsService');

const GUILD_ID = process.argv[2] || '355051708503687168';

async function forceRecalculate() {
    try {
        console.log('\n========================================');
        console.log('🔄 RECALCUL FORCÉ DES STATISTIQUES');
        console.log('========================================\n');
        console.log(`Guild ID: ${GUILD_ID}\n`);

        // Connexion à MongoDB
        console.log('📡 Connexion à MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connecté à MongoDB\n');

        // Étape 1: Suppression des anciennes stats
        console.log('🗑️  Suppression des anciennes statistiques...');
        const deleteResult = await UserStats.deleteMany({ guildId: GUILD_ID });
        console.log(`✅ ${deleteResult.deletedCount} entrées supprimées\n`);

        // Étape 2: Récupération des utilisateurs
        console.log('👥 Récupération de la liste des utilisateurs actifs...');
        const allUserIds = await GuildVoice.distinct('channels.members.userId', { guildId: GUILD_ID });
        console.log(`✅ ${allUserIds.length} utilisateurs trouvés\n`);

        if (allUserIds.length === 0) {
            console.log('⚠️  Aucun utilisateur trouvé. Fin du script.');
            await mongoose.disconnect();
            process.exit(0);
        }

        // Étape 3: Recalcul des statistiques
        console.log('📊 Recalcul des statistiques pour tous les utilisateurs...');
        console.log('   (Cela peut prendre du temps)\n');
        
        const startTime = Date.now();
        await statsService.calculateAndSaveStatsForUsers(GUILD_ID, allUserIds);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n========================================');
        console.log('✅ RECALCUL TERMINÉ AVEC SUCCÈS');
        console.log('========================================');
        console.log(`Utilisateurs traités: ${allUserIds.length}`);
        console.log(`Durée totale: ${duration} secondes`);
        console.log(`Moyenne: ${(duration / allUserIds.length).toFixed(2)}s par utilisateur\n`);

        // Déconnexion
        await mongoose.disconnect();
        console.log('👋 Déconnecté de MongoDB\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌❌❌ ERREUR LORS DU RECALCUL ❌❌❌');
        console.error(error);
        
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('Erreur lors de la déconnexion:', disconnectError);
        }
        
        process.exit(1);
    }
}

// Lancer le recalcul
forceRecalculate();
