import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// Opens the KirkaHub Skin Editor as a Discord Activity right here: everyone in the channel can join
// and watch or paint the same skin live. Free in every server (not VIP). Needs Activities turned on for
// the app in the Developer Portal.
export const data = new SlashCommandBuilder()
  .setName('skineditor')
  .setDescription('Open the live Skin Editor here: everyone can join, watch and paint the same skin')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2);

export const JOIN_BUTTON_ID = 'skineditor_join';

const NOT_ON = 'The live Skin Editor isn\'t switched on for KirkaHub yet. Meanwhile you can use it at https://kirkahub.online/skineditor';

async function launch(interaction) {
  try {
    await interaction.launchActivity();
    return true;
  } catch (err) {
    console.error('[SkinEditor] launchActivity failed:', err.message);
    const send = interaction.replied || interaction.deferred ? interaction.followUp.bind(interaction) : interaction.reply.bind(interaction);
    await send({ content: NOT_ON, flags: 64 }).catch((e) => console.error('[SkinEditor] could not say so either:', e.message));
    return false;
  }
}

/** /skineditor and the app's Launch button: open the editor, then tell the channel so others can join. */
export async function execute(interaction) {
  if (!(await launch(interaction))) return;
  // Discord doesn't announce an Activity started in a text channel, so the bot does, with a Join button.
  // Everyone who opens the editor from this channel lands in the same room (the room is the channel).
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(JOIN_BUTTON_ID).setLabel('Join and paint').setEmoji('🎨').setStyle(ButtonStyle.Success)
  );
  await interaction
    .followUp({
      content: `🎨 **${interaction.user.displayName}** opened the live **Skin Editor**. Click below to watch or paint along: every stroke shows up for everyone.`,
      components: [row],
      allowedMentions: { parse: [] },
    })
    .catch((err) => console.error('[SkinEditor] could not post the join message:', err.message));
}

/** The Join button under that message: opens the same editor for whoever clicks it. */
export async function join(interaction) {
  await launch(interaction);
}
