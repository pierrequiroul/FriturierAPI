require('dotenv').config();
// --- IDs à remplacer par vos propres IDs de test ---
const TEST_GUILD_ID = '355051708503687168'; // Mettez un ID de serveur valide où le bot se trouve
const TEST_USER_ID = '416425276239511563';   // Mettez un ID d'utilisateur valide de ce serveur
const TEST_CHANNEL_ID = '797014090488872989'; // Mettez un ID de canal valide de ce serveur

const API_BASE_URL = 'http://localhost:3001'; // Assurez-vous que le port est correct

/**
 * Fonction générique pour tester un endpoint.
 * @param {string} name - Le nom du test.
 * @param {string} url - L'URL complète de l'endpoint à tester.
 */
async function testEndpoint(name, url) {
    console.log(`\n🔍 Test de l'endpoint : ${name}`);
    console.log(`   URL: ${url}`);
    try {
        const headers = {};
        // Ajouter la clé d'API pour les routes sécurisées
        if (url.includes('/api/discord/')) {
            headers['x-api-key'] = process.env.API_KEY;
        }

        const response = await fetch(url, { headers });
        const data = await response.json();

        if (!response.ok) {
            console.error(`❌ Erreur ${response.status}:`, data.message || 'Erreur inconnue');
        } else {
            console.log('✅ Succès. Réponse :');
            console.log(data);
        }
    } catch (error) {
        console.error('❌ Erreur de connexion:', error.message);
    }
}

async function runAllTests() {
    console.log('--- Lancement des tests de l\'API ---');
    console.log('Assurez-vous d\'avoir remplacé les IDs de test dans le fichier test_api.js');

    // --- Tests des nouveaux endpoints Discord ---
    await testEndpoint('Infos de la Guilde', `${API_BASE_URL}/api/discord/guilds/${TEST_GUILD_ID}`);
    await testEndpoint('Infos de l\'Utilisateur', `${API_BASE_URL}/api/discord/guilds/${TEST_GUILD_ID}/users/${TEST_USER_ID}`);
    await testEndpoint('Infos du Canal', `${API_BASE_URL}/api/discord/guilds/${TEST_GUILD_ID}/channels/${TEST_CHANNEL_ID}`);

    // --- Test de l'endpoint d'activité vocale (existant) ---
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24h
    await testEndpoint('Activité Vocale de la Guilde', `${API_BASE_URL}/api/voice/${TEST_GUILD_ID}?start=${start.toISOString()}&end=${now.toISOString()}`);

    console.log('\n--- Tests terminés ---');
}

runAllTests();