require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const statRoutes = require('./routes/statRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/stats', statRoutes);

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

const StatsAggregationService = require('./services/StatsAggregationService');

// Tâches d'agrégation planifiées
function setupAggregationTasks() {
    // Agrégation horaire toutes les heures
    setInterval(async () => {
        try {
            const guilds = await mongoose.connection.db.collection('useractivities').distinct('guildId');
            for (const guildId of guilds) {
                await StatsAggregationService.aggregateLastHour(guildId);
            }
            console.log('Hourly aggregation completed');
        } catch (error) {
            console.error('Error in hourly aggregation:', error);
        }
    }, 60 * 60 * 1000); // Toutes les heures

    // Agrégation journalière tous les jours à minuit
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = nextMidnight - now;

    setTimeout(() => {
        setInterval(async () => {
            try {
                const guilds = await mongoose.connection.db.collection('useractivities').distinct('guildId');
                for (const guildId of guilds) {
                    await StatsAggregationService.aggregateLastDay(guildId);
                }
                console.log('Daily aggregation completed');
            } catch (error) {
                console.error('Error in daily aggregation:', error);
            }
        }, 24 * 60 * 60 * 1000); // Tous les jours
    }, msUntilMidnight);
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    setupAggregationTasks();
});
