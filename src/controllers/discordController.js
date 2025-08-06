const { client } = require('../app');

async function getDiscordInfo(userId, channelId, guildId) {
    try {
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        
        return {
            user: member.user,
            guild: guild,
            channelId: channelId
        };
    } catch (error) {
        console.error('Error fetching Discord info:', error);
        throw error;
    }
}
async function getDiscordUser(guildId, userId) {
        try {
            const guild = await client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            
            return {
                user: member,
                guild: guild,
            };
        } catch (error) {
            console.error('Error fetching Discord info:', error);
            throw error;
        }
}

async function getDiscordGuild(guildId) {
        try {
            const guild = await client.guilds.fetch(guildId);
            
            return guild;
        } catch (error) {
            console.error('Error fetching Discord info:', error);
            throw error;
        }
}

module.exports = {
    getDiscordInfo,
    getDiscordUser,
    getDiscordGuild
};
