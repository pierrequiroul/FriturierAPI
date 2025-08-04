const VoiceInteraction = require('../models/VoiceInteraction');

exports.handleVoiceJoin = async (req, res) => {
    try {
        const { guildId, channelId, userId } = req.params;
        const { username, channelName, currentMembers } = req.body;
        const now = new Date();

        // Mise à jour ou création du document principal de l'utilisateur
        const userDoc = await VoiceInteraction.findOneAndUpdate(
            { guildId, userId },
            {
                $set: { friendlyName: username }
            },
            { upsert: true, new: true }
        );

        // Mise à jour du canal
        await VoiceInteraction.findOneAndUpdate(
            { guildId, userId, 'channels.channelId': channelId },
            {
                $set: {
                    'channels.$.friendlyName': channelName,
                    'channels.$.lastJoin': now
                }
            }
        );

        // Si le canal n'existe pas encore, l'ajouter
        if (!userDoc.channels.find(c => c.channelId === channelId)) {
            await VoiceInteraction.findOneAndUpdate(
                { guildId, userId },
                {
                    $push: {
                        channels: {
                            channelId,
                            friendlyName: channelName,
                            timeSpent: 0,
                            lastJoin: now
                        }
                    }
                }
            );
        }

        // Mise à jour des interactions avec les membres présents
        if (currentMembers && currentMembers.length > 0) {
            for (const member of currentMembers) {
                if (member.userId === userId) continue;

                // Mise à jour pour l'utilisateur principal
                await VoiceInteraction.findOneAndUpdate(
                    { 
                        guildId, 
                        userId,
                        'interactions.userId': member.userId 
                    },
                    {
                        $set: {
                            'interactions.$.friendlyName': member.username,
                            'interactions.$.lastVoiceInteraction': now,
                            'interactions.$.currentSession': {
                                channelId,
                                startTime: now
                            }
                        }
                    }
                );

                // Si l'interaction n'existe pas encore, l'ajouter
                await VoiceInteraction.findOneAndUpdate(
                    { guildId, userId },
                    {
                        $addToSet: {
                            interactions: {
                                userId: member.userId,
                                friendlyName: member.username,
                                timeSpentTogether: 0,
                                lastVoiceInteraction: now,
                                lastMessageInteraction: null,
                                currentSession: {
                                    channelId,
                                    startTime: now
                                }
                            }
                        }
                    }
                );

                // Faire la même chose pour l'autre utilisateur
                await VoiceInteraction.findOneAndUpdate(
                    { guildId, userId: member.userId },
                    {
                        $set: { friendlyName: member.username }
                    },
                    { upsert: true }
                );
            }
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.handleVoiceLeave = async (req, res) => {
    try {
        const { guildId, channelId, userId } = req.params;
        const { currentMembers } = req.body;
        const now = new Date();

        // Mise à jour du temps passé dans le canal
        const userDoc = await VoiceInteraction.findOne({ guildId, userId });
        const channel = userDoc.channels.find(c => c.channelId === channelId);
        
        if (channel && channel.lastJoin) {
            const duration = Math.floor((now - channel.lastJoin) / 1000);
            await VoiceInteraction.findOneAndUpdate(
                { guildId, userId, 'channels.channelId': channelId },
                {
                    $inc: { 'channels.$.timeSpent': duration },
                    $set: { 'channels.$.lastJoin': null }
                }
            );
        }

        // Mise à jour des interactions
        for (const interaction of userDoc.interactions) {
            if (interaction.currentSession && interaction.currentSession.channelId === channelId) {
                const duration = Math.floor((now - interaction.currentSession.startTime) / 1000);
                await VoiceInteraction.findOneAndUpdate(
                    { guildId, userId, 'interactions.userId': interaction.userId },
                    {
                        $inc: { 'interactions.$.timeSpentTogether': duration },
                        $set: {
                            'interactions.$.lastVoiceInteraction': now,
                            'interactions.$.currentSession': null
                        }
                    }
                );

                // Mise à jour réciproque pour l'autre utilisateur
                await VoiceInteraction.findOneAndUpdate(
                    { guildId, userId: interaction.userId, 'interactions.userId': userId },
                    {
                        $inc: { 'interactions.$.timeSpentTogether': duration },
                        $set: {
                            'interactions.$.lastVoiceInteraction': now,
                            'interactions.$.currentSession': null
                        }
                    }
                );
            }
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.handleMessage = async (req, res) => {
    try {
        const { guildId, channelId, userId } = req.params;
        const { targetUserId, username, targetUsername } = req.body;
        const now = new Date();

        // Mise à jour de l'interaction pour l'expéditeur
        await VoiceInteraction.findOneAndUpdate(
            { guildId, userId, 'interactions.userId': targetUserId },
            {
                $set: {
                    'interactions.$.lastMessageInteraction': now,
                    'interactions.$.friendlyName': targetUsername
                }
            }
        );

        // Mise à jour de l'interaction pour le destinataire
        await VoiceInteraction.findOneAndUpdate(
            { guildId, userId: targetUserId, 'interactions.userId': userId },
            {
                $set: {
                    'interactions.$.lastMessageInteraction': now,
                    'interactions.$.friendlyName': username
                }
            }
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getUserInteractions = async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        
        const userStats = await VoiceInteraction.findOne(
            { guildId, userId }
        );

        if (!userStats) {
            return res.status(404).json({ error: 'No stats found for this user' });
        }

        res.json(userStats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
