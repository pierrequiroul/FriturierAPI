require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const voiceRoutes = require('./routes/voiceRoutes');
const Discord = require('discord.js');
const app = express();
const { Client, GatewayIntentBits } = require('discord.js');

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
app.use('/api/voice', voiceRoutes);
app.use('/api/stats/voice', voiceRoutes); // Support de l'ancien préfixe

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Discord connection
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});
client.login(process.env.DISCORD_TOKEN);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = client