const client = require('../discordClient');

/**
 * Récupère les informations d'un utilisateur d'une guilde spécifique et les formate pour l'API.
 */
exports.getGuildUser = async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);

        if (!member) {
            return res.status(404).json({ message: 'Membre non trouvé.' });
        }

        res.json({
            id: member.id,
            username: member.user.username,
            discriminator: member.user.discriminator,
            avatar: member.user.displayAvatarURL(),
            avatarDecoration: member.user.avatarDecorationURL({ size: 128 }),
            nickname: member.nickname,
            roles: member.roles.cache.map(role => ({ id: role.id, name: role.name, color: role.hexColor })),
            joinedAt: member.joinedAt
        });
    } catch (error) {
        // Check for specific Discord.js "Not Found" errors
        if (error.code === 10007 || error.code === 10004) { // 10007: Unknown Member, 10004: Unknown Guild
            return res.status(404).json({ message: 'Guilde ou membre non trouvé.' });
        }
        console.error(`Erreur lors de la récupération de l'utilisateur ${req.params.userId}:`, error);
        res.status(500).json({ message: 'Erreur lors de la récupération des informations de l\'utilisateur.' });
    }
};

/**
 * Récupère les informations d'un canal d'une guilde spécifique.
 */
exports.getGuildChannel = async (req, res) => {
    try {
        const { guildId, channelId } = req.params;
        const guild = await client.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(channelId);

        if (!channel) {
            return res.status(404).json({ message: 'Canal non trouvé.' });
        }

        res.json({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            parentId: channel.parentId,
            position: channel.position
        });
    } catch (error) {
        // Check for specific Discord.js "Not Found" errors
        if (error.code === 10003 || error.code === 10004) { // 10003: Unknown Channel, 10004: Unknown Guild
            return res.status(404).json({ message: 'Guilde ou canal non trouvé.' });
        }
        console.error(`Erreur lors de la récupération du canal ${req.params.channelId}:`, error);
        res.status(500).json({ message: 'Erreur lors de la récupération des informations du canal.' });
    }
};

/**
 * Récupère les informations d'une guilde spécifique.
 */
exports.getGuild = async (req, res) => {
    try {
        const { guildId } = req.params;
        const guild = await client.guilds.fetch(guildId);

        if (!guild) {
            return res.status(404).json({ message: 'Guilde non trouvée.' });
        }

        res.json({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL(),
            memberCount: guild.memberCount,
            ownerId: guild.ownerId
        });
    } catch (error) {
        // Check for specific Discord.js "Not Found" errors
        if (error.code === 10004) { // 10004: Unknown Guild
            return res.status(404).json({ message: 'Guilde non trouvée.' });
        }
        console.error(`Erreur lors de la récupération de la guilde ${req.params.guildId}:`, error);
        res.status(500).json({ message: 'Erreur lors de la récupération des informations de la guilde.' });
    }
};

/**
 * Récupère les informations de plusieurs utilisateurs d'une guilde en une seule requête.
 */
exports.getGuildUsersBulk = async (req, res) => {
    try {
        const { guildId } = req.params;
        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ message: 'Le corps de la requête doit contenir un tableau "userIds" non vide.' });
        }

        const guild = await client.guilds.fetch(guildId);

        // On fetch chaque membre individuellement pour plus de résilience.
        // Promise.all permet de lancer les requêtes en parallèle.
        const memberPromises = userIds.map(id =>
            guild.members.fetch(id).catch(err => {
                // Si un utilisateur n'est pas trouvé (a quitté, etc.), on log un avertissement et on continue.
                console.warn(`[BULK] Impossible de récupérer le membre ${id} pour la guilde ${guildId}: ${err.message}`);
                return null; // On retourne null pour cet utilisateur.
            })
        );

        const resolvedMembers = await Promise.all(memberPromises);

        // On filtre les utilisateurs non trouvés (null) et on formate les autres.
        const formattedMembers = resolvedMembers
            .filter(member => member !== null)
            .map(member => ({
                id: member.id,
                username: member.user.username,
                avatar: member.user.displayAvatarURL(),
                avatarDecoration: member.user.avatarDecorationURL({ size: 128 }),
                nickname: member.nickname,
                discriminator: member.user.discriminator,
            }));

        res.json(formattedMembers);

    } catch (error) {
        if (error.code === 10004) { // Unknown Guild
            return res.status(404).json({ message: 'Guilde non trouvée.' });
        }
        console.error(`Erreur lors de la récupération en masse des utilisateurs pour la guilde ${req.params.guildId}:`, error);
        res.status(500).json({ message: 'Erreur lors de la récupération des informations des utilisateurs.' });
    }
};

/**
 * Récupère les informations de plusieurs canaux d'une guilde en une seule requête.
 */
exports.getGuildChannelsBulk = async (req, res) => {
    try {
        const { guildId } = req.params;
        const { channelIds } = req.body;

        if (!Array.isArray(channelIds) || channelIds.length === 0) {
            return res.status(400).json({ message: 'Le corps de la requête doit contenir un tableau "channelIds" non vide.' });
        }

        const guild = await client.guilds.fetch(guildId);

        // On filtre le cache des canaux de la guilde, ce qui est plus efficace que des fetchs multiples.
        const channels = guild.channels.cache.filter(ch => channelIds.includes(ch.id));

        const formattedChannels = channels.map(channel => ({
            id: channel.id,
            name: channel.name,
        }));

        res.json(formattedChannels);

    } catch (error) {
        if (error.code === 10004) { // Unknown Guild
            return res.status(404).json({ message: 'Guilde non trouvée.' });
        }
        console.error(`Erreur lors de la récupération en masse des canaux pour la guilde ${req.params.guildId}:`, error);
        res.status(500).json({ message: 'Erreur lors de la récupération des informations des canaux.' });
    }
};
