import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ai')
  .setDescription('Ask questions to AI models via OpenRouter')
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .addStringOption(option =>
    option.setName('prompt')
      .setDescription('What do you want to ask the AI?')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('model')
      .setDescription('Choose the AI model to query')
      .setRequired(false)
      .addChoices(
        { name: 'Llama 3 8B (Free)', value: 'meta-llama/llama-3-8b-instruct:free' },
        { name: 'Gemma 2 9B (Free)', value: 'google/gemma-2-9b-it:free' },
        { name: 'Claude 3 Opus (Premium)', value: 'anthropic/claude-3-opus' },
        { name: 'Claude 3.5 Sonnet (Premium)', value: 'anthropic/claude-3.5-sonnet' },
        { name: 'Claude Fable 5 (Example Mock)', value: 'anthropic/claude-fable-5' }
      )
  );

export async function execute(interaction) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return interaction.reply({
      content: '❌ **Configuration Error:** The bot owner has not set the `OPENROUTER_API_KEY` environment variable on Render.',
      flags: 64
    });
  }

  await interaction.deferReply();

  const prompt = interaction.options.getString('prompt');
  const model = interaction.options.getString('model') || 'meta-llama/llama-3-8b-instruct:free';

  try {
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    // If it's a reasoning model (like Fable 5), enable reasoning parameter
    if (model.includes('fable-5') || model.includes('reasoning')) {
      requestBody.reasoning = {
        exclude: false
      };
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://kirkahub.vercel.app',
        'X-Title': 'KirkaHub Bot'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      return interaction.editReply({
        content: `❌ **OpenRouter API Error:** HTTP ${response.status}\n\`\`\`json\n${errText.substring(0, 1500)}\n\`\`\``
      });
    }

    const data = await response.json();
    let replyContent = data.choices?.[0]?.message?.content;

    if (!replyContent) {
      return interaction.editReply({
        content: '⚠️ Received an empty response from the AI model.'
      });
    }

    // Check if there is reasoning output in the response
    let reasoning = data.choices?.[0]?.message?.reasoning || data.choices?.[0]?.reasoning_details;
    let finalOutput = '';

    if (reasoning) {
      finalOutput += `💭 **Thinking Process:**\n*${reasoning.substring(0, 500)}${reasoning.length > 500 ? '...' : ''}*\n\n`;
    }

    finalOutput += replyContent;

    const friendlyModelNames = {
      'meta-llama/llama-3-8b-instruct:free': 'Llama 3 8B (Free)',
      'google/gemma-2-9b-it:free': 'Gemma 2 9B (Free)',
      'anthropic/claude-3-opus': 'Claude 3 Opus (Premium)',
      'anthropic/claude-3.5-sonnet': 'Claude 3.5 Sonnet (Premium)',
      'anthropic/claude-fable-5': 'Claude Fable 5'
    };
    const modelName = friendlyModelNames[model] || model;

    if (finalOutput.length > 1950) {
      const buffer = Buffer.from(finalOutput, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: 'ai-response.txt' });
      await interaction.editReply({
        content: `📝 **AI Response (${modelName}) was too long for Discord (${finalOutput.length} chars). Attached as text file:**`,
        files: [attachment]
      });
    } else {
      await interaction.editReply({
        content: `🤖 **AI Response (${modelName}):**\n\n${finalOutput}`
      });
    }

  } catch (err) {
    console.error('OpenRouter query failed:', err);
    await interaction.editReply({
      content: `❌ **Failed to contact OpenRouter:** ${err.message}`
    });
  }
}
