require('dotenv').config();

// IMPORTANT: Forcer l'affichage immédiat des logs (pas de buffering)
// Utile quand on lance via npm scripts dans VSCode
if (process.stdout && process.stdout._handle && process.stdout._handle.setBlocking) {
    process.stdout._handle.setBlocking(true);
}
if (process.stderr && process.stderr._handle && process.stderr._handle.setBlocking) {
    process.stderr._handle.setBlocking(true);
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const discordRoutes = require('./routes/discordRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const statsRoutes = require('./routes/statsRoutes');
const authRoutes = require('./routes/authRoutes');
const apiKeyAuth = require('./middleware/auth');
const checkAuth = require('./middleware/checkAuth');
const app = express();
const client = require('./services/discordClient');

// Middleware pour le logging des requêtes
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`\n🌐 [${timestamp}] ${req.method} ${req.url}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log(`📦 Body:`, JSON.stringify(req.body).substring(0, 200));
    }
    next();
});

// Middleware standard
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());

// Servir les fichiers statiques avant toute autre route
app.use(express.static(path.join(__dirname, '../public')));

// Routes d'authentification (publiques)
app.use('/api/auth', authRoutes);

// Middleware d'authentification pour les autres routes API
app.use('/api', (req, res, next) => {
    if (req.path === '/auth/login') {
        return next();
    }
    checkAuth(req, res, next);
});

// Routes protégées par authentification
app.use('/api/dashboard', checkAuth, dashboardRoutes);
app.use('/api/user', checkAuth, statsRoutes);
app.use('/api/voice', checkAuth, voiceRoutes);
//app.use('/api/text', textRoutes); //TO-DO
app.use('/api/discord', checkAuth, discordRoutes);

// Debug: lister les routes dashboard après montage (utile si 404 inattendus)
function listDashboardRoutesSafe() {
    try {
        console.log('\n📜 Liste des routes /api/dashboard enregistrées:');
        if (!app._router || !app._router.stack) {
            console.log('   (router non initialisé ou stack indisponible)');
            console.log('📜 Fin liste des routes.');
            return;
        }
        const routerMounts = app._router.stack.filter(l => l && l.name === 'router');
        routerMounts.forEach(mountLayer => {
            if (!mountLayer || !mountLayer.handle || !mountLayer.handle.stack) return;
            const basePathMatch = mountLayer.regexp && mountLayer.regexp.toString().includes('api\\/dashboard');
            if (!basePathMatch) return;
            mountLayer.handle.stack.forEach(r => {
                if (r.route && r.route.path) {
                    const methods = Object.keys(r.route.methods).map(m => m.toUpperCase()).join(',');
                    console.log(`   • [${methods}] /api/dashboard${r.route.path}`);
                }
            });
        });
        console.log('📜 Fin liste des routes.');
    } catch (err) {
        console.error('Erreur liste routes (safe):', err.message);
    }
}
listDashboardRoutesSafe();

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('\n✅ ========================================');
        console.log('✅ Connected to MongoDB');
        console.log('✅ ========================================\n');
    })
    .catch(err => {
        console.error('\n❌ ========================================');
        console.error('❌ MongoDB connection error:', err);
        console.error('❌ ========================================\n');
    });

client.once('ready', () => {
    console.log('\n🤖 ========================================');
    console.log(`🤖 Discord Bot logged in as ${client.user.tag}`);
    console.log('🤖 ========================================\n');
});
client.login(process.env.DISCORD_TOKEN);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log('\n🚀 ========================================');
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🚀 Dashboard: http://localhost:${PORT}`);
    console.log('🚀 ========================================\n');
});