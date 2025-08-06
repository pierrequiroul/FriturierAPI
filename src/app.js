require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const discordRoutes = require('./routes/discordRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const statsRoutes = require('./routes/statsRoutes');
const apiKeyAuth = require('./middleware/auth');
const app = express();
const client = require('./services/discordClient');

// Middleware pour le logging des requêtes
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// Middleware standard
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/discord', apiKeyAuth, discordRoutes);
app.use('/api/dashboard', dashboardRoutes); // Routes publiques pour le frontend
app.use('/api/stats', apiKeyAuth, statsRoutes); // Routes protégées pour les actions de stats
app.use('/api/voice', apiKeyAuth, voiceRoutes);

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