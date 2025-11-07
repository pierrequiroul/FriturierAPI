require('dotenv').config();
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
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
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

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});
client.login(process.env.DISCORD_TOKEN);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});