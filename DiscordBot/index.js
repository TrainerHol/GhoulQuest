require("dotenv").config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require("discord.js");
const fs = require("fs");

// Validate environment variables
if (!process.env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is required in .env file");
}

if (!process.env.CLIENT_ID) {
  throw new Error("CLIENT_ID is required in .env file");
}

// Initialize bot client with intents
const bot = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

bot.commands = new Collection();

// Function to deploy commands
async function deployCommands() {
  const commands = [];
  const commandFiles = fs.readdirSync("./commands").filter((file) => file.endsWith(".js"));

  // Load command files
  for (const file of commandFiles) {
    try {
      const command = require(`./commands/${file}`);

      // Validate command structure
      if (!command.data || !command.execute) {
        console.log(`[WARNING] The command ${file} is missing required properties.`);
        continue;
      }

      console.log(`Loading command: ${command.data.name}`);
      bot.commands.set(command.data.name, command);
      commands.push(command.data.toJSON());
    } catch (error) {
      console.error(`Error loading command ${file}:`, error);
    }
  }

  if (commands.length === 0) {
    console.error("No commands were loaded!");
    return;
  }

  try {
    console.log("Started refreshing application (/) commands.");
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

    console.log(`Deploying commands to application ID: ${process.env.CLIENT_ID}`);
    const data = await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error("Error deploying commands:", error);
    console.error("Error details:", error.rawError?.errors || error.message);
  }
}

// Handle slash commands
bot.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = bot.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);
    const reply = interaction.replied ? interaction.followUp : interaction.reply;
    await reply({
      content: "There was an error executing this command!",
      ephemeral: true,
    });
  }
});

bot.once("ready", async () => {
  console.log(`${bot.user.username} is online`);

  try {
    // Deploy commands when bot starts
    await deployCommands();
  } catch (error) {
    console.error("Error during startup:", error);
  }

  bot.user.setPresence({
    activities: [{ name: "⋆www.ghoul-fc.com⋆", type: 0 }],
    status: "online",
  });
});

// Handle errors
bot.on("error", (error) => {
  console.error("Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

bot.login(process.env.DISCORD_TOKEN);
