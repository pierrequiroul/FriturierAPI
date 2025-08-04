// Test simple de l'API avec fetch natif
async function testAPI() {
    try {
        // Test de l'endpoint guilds
        console.log('🔍 Test de /api/voice/guilds...');
        const guildsResponse = await fetch('http://localhost:3000/api/voice/guilds');
        const guilds = await guildsResponse.json();
        console.log('Guilds:', guilds);

        if (guilds.length > 0) {
            const guildId = guilds[0]._id;
            const channelId = guilds[0].channels[0]?.channelId;

            if (channelId) {
                console.log(`\n🔍 Test de /api/voice/${guildId}/${channelId}...`);
                const now = new Date();
                const start = new Date(now - 24 * 60 * 60 * 1000); // 24h ago
                
                const activityResponse = await fetch(
                    `http://localhost:3000/api/voice/${guildId}/${channelId}?start=${start.toISOString()}&end=${now.toISOString()}&interval=1h`
                );
                const activity = await activityResponse.json();
                console.log('Activity data:', activity);
                console.log('Nombre de points:', activity.length);
                
                if (activity.length > 0) {
                    console.log('Premier point:', activity[0]);
                }
            }
        }
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

// Vérifier si fetch est disponible
if (typeof fetch === 'undefined') {
    console.log('⚠️ Fetch non disponible, utilisation de http module...');
    const http = require('http');
    
    function makeRequest(url) {
        return new Promise((resolve, reject) => {
            const req = http.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', reject);
        });
    }
    
    async function testWithHttp() {
        try {
            console.log('🔍 Test de /api/voice/guilds...');
            const guilds = await makeRequest('http://localhost:3000/api/voice/guilds');
            console.log('Guilds:', guilds);
            
            if (guilds.length > 0) {
                const guildId = guilds[0]._id;
                const channelId = guilds[0].channels[0]?.channelId;
                
                if (channelId) {
                    console.log(`\n🔍 Test de /api/voice/${guildId}/${channelId}...`);
                    const now = new Date();
                    const start = new Date(now - 24 * 60 * 60 * 1000);
                    
                    const activity = await makeRequest(
                        `http://localhost:3000/api/voice/${guildId}/${channelId}?start=${start.toISOString()}&end=${now.toISOString()}&interval=1h`
                    );
                    console.log('Activity data:', activity);
                    console.log('Nombre de points:', activity.length);
                    
                    if (activity.length > 0) {
                        console.log('Premier point:', activity[0]);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Erreur:', error.message);
        }
    }
    
    testWithHttp();
} else {
    testAPI();
} 