const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder().setName("achieve").setDescription("Draw an achievement card"),

  async execute(interaction) {
    var deck = JSON.parse(fs.readFileSync("./decks/achievements.json", "utf8"));
    const cardIndex = Math.floor(Math.random() * deck.length);
    const cardDrawn = deck[cardIndex];

    await interaction.reply(`Complete the following objective and receive double payout when passing through the Start space:\n**${cardDrawn.Achievement}** - ${cardDrawn.Objective}`);
  },
};
