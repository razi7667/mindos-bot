require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const NOTIFICATION_CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID;
const PORT = 3000;

const MESSAGE_STORE_FILE = 'botEmbedMessages.json';
let messageStore = {};

if (fs.existsSync(MESSAGE_STORE_FILE)) {
  messageStore = JSON.parse(fs.readFileSync(MESSAGE_STORE_FILE));
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

const pingedBots = new Set();

// HTTP server for UptimeRobot pings
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot Status Monitor is running.');
  console.log(`[Pinged] ${new Date().toLocaleString()}`);
}).listen(PORT, () => {
  console.log(`🚀 Ping server ready at http://localhost:${PORT}`);
});

function pingBotOffline(botName) {
  if (!pingedBots.has(botName)) {
    console.log(`❌ ${botName} went offline!`);
    pingedBots.add(botName);

    // Optional: trigger UptimeRobot ping
    http.get('http://localhost:' + PORT);
  }
}

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  async function updateStatus() {
    try {
      const bots = client.users.cache.filter(user => user.bot);
      const embed = new EmbedBuilder()
        .setAuthor({ name: 'Bot Status Monitor' })
        .setColor('Red')
        .setFooter({ text: 'Powered by Muhammed Razi™' })
        .setTimestamp();

      for (const bot of bots.values()) {
        const status = bot.presence?.status || 'offline';
        const isOnline = status !== 'offline';
        const uptime = isOnline
          ? `<t:${Math.floor(Date.now() / 1000)}:R>`
          : '0 seconds';

        embed.addFields({
          name: `• ${bot.username}`,
          value: isOnline
            ? `\`\`\`🟢 Online\`\`\`\n**• Uptime:** ${uptime}\n\u200B`
            : `\`\`\`🟥 Offline\`\`\`\n**• Uptime:** ${uptime}\n\u200B`,
          inline: false,
        });

        if (!isOnline) pingBotOffline(bot.username);
      }

      const channel = await client.channels.fetch(CHANNEL_ID);

      if (messageStore[CHANNEL_ID]) {
        const msg = await channel.messages.fetch(messageStore[CHANNEL_ID]);
        await msg.edit({ embeds: [embed] });
      } else {
        const msg = await channel.send({ embeds: [embed] });
        messageStore[CHANNEL_ID] = msg.id;
        fs.writeFileSync(MESSAGE_STORE_FILE, JSON.stringify(messageStore, null, 2));
      }

      // Send notification embed to NOTIFICATION_CHANNEL_ID
      const notificationChannel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID);

      const notifyEmbed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('🔔 Bot Status Updated')
        .setDescription('All bot statuses have been checked and the status message has been updated. <#' + CHANNEL_ID + '>')
        .setFooter({ text: 'Powered by Muhammed Razi™' })
        .setTimestamp();

      notificationChannel.send({ embeds: [notifyEmbed] });

      console.log(`✅ Status embed updated & notification sent.`);
    } catch (err) {
      console.error(`⚠️ Error in updateStatus():`, err.message);
    }
  }

  // Run once immediately
  await updateStatus();

  // Run every hour
  setInterval(updateStatus, 60 * 60 * 1000);
});

client.login(BOT_TOKEN);
