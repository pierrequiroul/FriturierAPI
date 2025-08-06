require('dotenv').config();
// --- IDs à remplacer par vos propres IDs de test ---
const TEST_GUILD_ID = '355051708503687168'; // Utilisez un ID de serveur dédié pour les tests

const API_BASE_URL = 'http://localhost:3001'; // Assurez-vous que le port est correct

// --- Helper Functions ---

// Une simple fonction de délai pour simuler le temps qui passe entre les événements
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Envoie une requête POST pour enregistrer une nouvelle activité.
 * @param {object} payload - Le corps de la requête, contenant l'état des canaux.
 * @returns {Promise<{status: number, data: object}>} La réponse du serveur.
 */
async function recordActivity(payload) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/voice/${TEST_GUILD_ID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.API_KEY
            },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        console.log(`   [${response.status}] Réponse:`, data.message || data);
        return { status: response.status, data };
    } catch (error) {
        console.error('   [ERREUR] Impossible d\'envoyer la requête:', error.message);
        return { status: 500, data: { error: error.message } };
    }
}

// --- Scénarios de test ---

async function runTestScenarios() {
    console.log('--- Lancement de la batterie de tests pour recordGuildActivity ---');
    console.log('NOTE: Ce test est séquentiel. Il est recommandé de vider la collection `guildvoices` pour cette guilde avant de lancer.');
    console.log('Un délai de 2 secondes est appliqué entre les tests pour simuler le temps qui passe.');

    // --- SCÉNARIO 1: Connexion initiale ---
    console.log('\n[1] Test: Un premier utilisateur se connecte.');
    let payload1 = {
        channels: [
            {
                channelId: '959744073634304020',
                channelName: 'Général',
                members: [{ memberId: '87107972676751360', username: 'Alice' }]
            }
        ]
    };
    await recordActivity(payload1);
    console.log('   -> Attendu: Un nouveau document est créé (status 201).');
    await delay(10000);

    // --- SCÉNARIO 2: Aucun changement ---
    console.log('\n[2] Test: Aucun changement d\'état.');
    await recordActivity(payload1);
    console.log('   -> Attendu: L\'état est inchangé, aucun enregistrement (status 200).');
    await delay(10000);

    // --- SCÉNARIO 3: Un autre utilisateur rejoint ---
    console.log('\n[3] Test: Un deuxième utilisateur rejoint le même salon.');
    let payload3 = {
        channels: [
            {
                channelId: '959744073634304020',
                channelName: 'Général',
                members: [
                    { memberId: '87107972676751360', username: 'Alice' },
                    { memberId: '404766072563302420', username: 'Bob' }
                ]
            }
        ]
    };
    await recordActivity(payload3);
    console.log('   -> Attendu: La session précédente est fermée et une nouvelle est créée (status 201).');
    await delay(10000);

    // --- SCÉNARIO 4: Un utilisateur quitte, mais le salon n'est pas vide ---
    console.log('\n[4] Test: Un utilisateur quitte, mais le salon n\'est pas vide.');
    let payload4 = { channels: [{ channelId: '959744073634304020', channelName: 'Général', members: [{ memberId: '404766072563302420', username: 'Bob' }] }] };
    await recordActivity(payload4);
    console.log('   -> Attendu: La session précédente est fermée et une nouvelle est créée (status 201).');
    await delay(10000);

    // --- SCÉNARIO 5: Le dernier utilisateur se déconnecte du serveur ---
    console.log('\n[5] Test: Le dernier utilisateur se déconnecte du serveur.');
    let payload5 = { channels: [] };
    await recordActivity(payload5);
    console.log('   -> Attendu: La session précédente est fermée, aucune nouvelle session n\'est créée (status 200).');
    await delay(10000);

    // --- SCÉNARIO 6: Le serveur est vide, aucun changement ---
    console.log('\n[6] Test: Le serveur est vide, on envoie un état vide à nouveau.');
    await recordActivity(payload5);
    console.log('   -> Attendu: L\'état est inchangé (vide), aucun enregistrement (status 200).');

    console.log('\n--- Batterie de tests terminée ---');
}

runTestScenarios();