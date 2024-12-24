const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder().setName("treasure").setDescription("Draw a treasure card"),

  async execute(interaction) {
    const cdnProxy = "https://discord-cdn-proxy.strangehousing.workers.dev?";

    var deck = JSON.parse(fs.readFileSync("./decks/treasure.json", "utf8"));
    const cardIndex = Math.floor(Math.random() * deck.length);
    const cardDrawn = deck[cardIndex];

    const proxyImageUrl = cdnProxy + cardDrawn.ImageURL;
    const attachment = new AttachmentBuilder(proxyImageUrl, { name: "card.png" });

    const embed = new EmbedBuilder().setImage("attachment://card.png");

    await interaction.reply({
      content: `**<a:treasure:728148707526180864>[${cardDrawn.Name}]<a:treasure:728148707526180864>**\n\`\`\`${cardDrawn.Effect}\`\`\``,
      embeds: [embed],
      files: [attachment],
    });
  },
};
