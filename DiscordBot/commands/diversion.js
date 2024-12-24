const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder().setName("diversion").setDescription("Draw a diversion card"),

  async execute(interaction) {
    const cdnProxy = "https://discord-cdn-proxy.strangehousing.workers.dev?";

    var deck = JSON.parse(fs.readFileSync("./decks/diversion.json", "utf8"));
    const cardIndex = Math.floor(Math.random() * deck.length);
    const cardDrawn = deck[cardIndex];

    const proxyImageUrl = cdnProxy + cardDrawn.ImageURL;
    const attachment = new AttachmentBuilder(proxyImageUrl, { name: "card.png" });

    const embed = new EmbedBuilder().setImage("attachment://card.png");

    await interaction.reply({
      content: `**<a:moogle:728157348090347562>[${cardDrawn.Name}]<a:moogle:728157348090347562>**\n\`\`\`${cardDrawn.Effect}\`\`\``,
      embeds: [embed],
      files: [attachment],
    });
  },
};
