const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder().setName("aether").setDescription("Draw an aether card"),

  async execute(interaction) {
    const cdnProxy = "https://discord-cdn-proxy.strangehousing.workers.dev?";

    var deck = JSON.parse(fs.readFileSync("./decks/aether.json", "utf8"));
    const cardIndex = Math.floor(Math.random() * deck.length);
    const cardDrawn = deck[cardIndex];

    const proxyImageUrl = cdnProxy + cardDrawn.ImageURL;
    const attachment = new AttachmentBuilder(proxyImageUrl, { name: "card.png" });

    const embed = new EmbedBuilder().setImage("attachment://card.png");

    await interaction.reply({
      content: `**<a:aether:728156984037081158>[${cardDrawn.Name}]<a:aether:728156984037081158>**\n\`\`\`${cardDrawn.Effect}\`\`\``,
      embeds: [embed],
      files: [attachment],
    });
  },
};
