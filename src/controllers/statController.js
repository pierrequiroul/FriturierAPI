const Stat = require('../models/Stat');

// Gestion des arrivées/départs du serveur
exports.handleGuildJoin = async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    
    const stat = await Stat.findOneAndUpdate(
      { guildId, userId, channelId: null },
      { 
        $set: { 
          joinDate: new Date(),
          leaveDate: null,
          lastActivity: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json(stat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.handleGuildLeave = async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    
    const stat = await Stat.findOneAndUpdate(
      { guildId, userId, channelId: null },
      { 
        $set: { 
          leaveDate: new Date(),
          lastActivity: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json(stat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Gestion des salons vocaux
exports.handleVoiceJoin = async (req, res) => {
  try {
    const { guildId, channelId, userId } = req.params;
    
    const stat = await Stat.findOneAndUpdate(
      { guildId, channelId, userId },
      { 
        $set: { 
          voiceJoinDate: new Date(),
          lastActivity: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json(stat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.handleVoiceLeave = async (req, res) => {
  try {
    const { guildId, channelId, userId } = req.params;
    
    const stat = await Stat.findOne({ guildId, channelId, userId });
    if (!stat) {
      return res.status(404).json({ error: 'No voice session found' });
    }

    const voiceJoinDate = stat.voiceJoinDate;
    if (!voiceJoinDate) {
      return res.status(400).json({ error: 'No voice join date found' });
    }

    const duration = Math.floor((new Date() - voiceJoinDate) / 1000); // Durée en secondes

    const updatedStat = await Stat.findOneAndUpdate(
      { guildId, channelId, userId },
      { 
        $inc: { voiceTimeTotal: duration },
        $set: { 
          voiceJoinDate: null,
          lastActivity: new Date()
        }
      },
      { new: true }
    );

    res.json(updatedStat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Gestion des messages
exports.handleMessage = async (req, res) => {
  try {
    const { guildId, channelId, userId } = req.params;
    
    const stat = await Stat.findOneAndUpdate(
      { guildId, channelId, userId },
      { 
        $inc: { messageCount: 1 },
        $set: { lastActivity: new Date() }
      },
      { upsert: true, new: true }
    );

    res.json(stat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Récupération des statistiques
exports.getGuildStats = async (req, res) => {
  try {
    const { guildId } = req.params;
    const stats = await Stat.find({ guildId });
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const stats = await Stat.find({ guildId, userId });
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getChannelStats = async (req, res) => {
  try {
    const { guildId, channelId } = req.params;
    const stats = await Stat.find({ guildId, channelId });
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
