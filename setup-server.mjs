import { ChannelType, PermissionsBitField } from 'discord.js';

export async function setupServer(guild) {
  if (!guild) throw new Error('Servidor não encontrado.');

  const rolesToCreate = [
    'Founder',
    'Admin',
    'Mentor',
    'Backend',
    'Frontend',
    'Data Science',
    'Mobile',
    'Redes',
    'Membro'
  ];

  for (const roleName of rolesToCreate) {
    const exists = guild.roles.cache.find(role => role.name === roleName);

    if (!exists) {
      await guild.roles.create({
        name: roleName,
        reason: 'Estrutura inicial do servidor SONICOS'
      });
    }
  }

  const structure = [
    {
      category: '📢 INÍCIO',
      channels: [
        { name: '👋-boas-vindas', type: ChannelType.GuildText },
        { name: '📜-regras', type: ChannelType.GuildText },
        { name: '📢-anuncios', type: ChannelType.GuildText }
      ]
    },
    {
      category: '💬 COMUNIDADE',
      channels: [
        { name: '💬-chat-geral', type: ChannelType.GuildText },
        { name: '🧑‍💻-apresentacoes', type: ChannelType.GuildText },
        { name: '❓-duvidas', type: ChannelType.GuildText }
      ]
    },
    {
      category: '📚 MATÉRIAS',
      channels: [
        { name: '🗄️-nosql', type: ChannelType.GuildText },
        { name: '📊-ciencia-de-dados', type: ChannelType.GuildText },
        { name: '📱-mobile', type: ChannelType.GuildText },
        { name: '🧭-jornada', type: ChannelType.GuildText },
        { name: '🌐-redes', type: ChannelType.GuildText }
      ]
    },
    {
      category: '🚀 PROJETOS',
      channels: [
        { name: '💡-ideias', type: ChannelType.GuildText },
        { name: '📂-projetos', type: ChannelType.GuildText },
        { name: '📌-tarefas', type: ChannelType.GuildText }
      ]
    },
    {
      category: '🤖 BOT',
      channels: [
        { name: '⚙️-comandos', type: ChannelType.GuildText },
        { name: '🏆-ranking', type: ChannelType.GuildText },
        { name: '📊-progresso', type: ChannelType.GuildText }
      ]
    },
    {
      category: '🎮 RESENHA',
      channels: [
        { name: '😂-memes', type: ChannelType.GuildText },
        { name: '🎮-games', type: ChannelType.GuildText },
        { name: '☕-off-topic', type: ChannelType.GuildText },
        { name: '🎥-filmes-series', type: ChannelType.GuildText },
        { name: '🎧-call-resenha', type: ChannelType.GuildVoice }
      ]
    }
  ];

  for (const item of structure) {
    let category = guild.channels.cache.find(
      channel =>
        channel.type === ChannelType.GuildCategory &&
        channel.name === item.category
    );

    if (!category) {
      category = await guild.channels.create({
        name: item.category,
        type: ChannelType.GuildCategory,
        reason: 'Categoria criada pelo SONIBOT'
      });
    }

    for (const channelData of item.channels) {
      const exists = guild.channels.cache.find(
        channel =>
          channel.name === channelData.name &&
          channel.parentId === category.id
      );

      if (!exists) {
        await guild.channels.create({
          name: channelData.name,
          type: channelData.type,
          parent: category.id,
          reason: 'Canal criado pelo SONIBOT',
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              allow: [PermissionsBitField.Flags.ViewChannel]
            }
          ]
        });
      }
    }
  }

  const rulesChannel = guild.channels.cache.find(c => c.name === '📜-regras');
  const announcementsChannel = guild.channels.cache.find(c => c.name === '📢-anuncios');

  if (rulesChannel) {
    await rulesChannel.permissionOverwrites.edit(guild.roles.everyone, {
      SendMessages: false
    });
  }

  if (announcementsChannel) {
    await announcementsChannel.permissionOverwrites.edit(guild.roles.everyone, {
      SendMessages: false
    });
  }
}