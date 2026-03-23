console.log('INICIOU O BOT');

import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  Events
} from 'discord.js';

import cron from 'node-cron';
import { setupServer } from './setup-server.mjs';
import { postInitialMessages } from './post-messages.mjs';
import { fetchMoodleTasks } from './moodle-sync.mjs';
import { EmbedBuilder } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

const sentAlerts = new Set();

const commands = [
  new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Mostra os comandos disponíveis do SONIBOT'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Verifica se o SONIBOT está online'),

  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Cria a estrutura do servidor SONICOS'),

  new SlashCommandBuilder()
    .setName('postar-mensagens')
    .setDescription('Posta as mensagens iniciais do servidor'),

  new SlashCommandBuilder()
    .setName('tarefas')
    .setDescription('Mostra as próximas tarefas do Moodle'),

  new SlashCommandBuilder()
    .setName('hoje')
    .setDescription('Mostra as tarefas que vencem hoje'),

  new SlashCommandBuilder()
    .setName('semana')
    .setDescription('Mostra as tarefas que vencem nesta semana'),

  new SlashCommandBuilder()
    .setName('aviso')
    .setDescription('Publica um aviso no canal de anúncios')
    .addStringOption(option =>
      option
        .setName('materia')
        .setDescription('Nome da matéria')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('titulo')
        .setDescription('Título do aviso')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('mensagem')
        .setDescription('Mensagem do aviso')
        .setRequired(true)
    )
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );

  console.log('✅ Comandos registrados com sucesso.');
}

function createTaskEmbed(task) {
  return new EmbedBuilder()
    .setTitle(`📚 ${task.title}`)
    .setColor(0x00bfff)
    .addFields(
      { name: '📖 Matéria', value: task.subject || 'Não definida', inline: true },
      { name: '🕒 Prazo', value: new Date(task.dueDate).toLocaleString('pt-BR'), inline: true },
      { name: '👥 Tipo', value: task.type || 'Não definido', inline: true }
    )
    .setDescription(task.description?.substring(0, 200) || 'Sem descrição')
    .setFooter({ text: 'SONIBOT • Sistema Acadêmico' });

}

function formatTask(task) {
  return `📚 **${task.title}**
🕒 Data: ${task.dueDate ? new Date(task.dueDate).toLocaleString('pt-BR') : 'Sem data'}
📝 Descrição: ${task.description ? task.description.substring(0, 200) : 'Sem descrição'}`;
}

if (interaction.commandName === 'hoje') {
  await interaction.deferReply({ ephemeral: true });

  const tasks = await fetchMoodleTasks();
  const todayTasks = tasks.filter(task => isToday(task.dueDate));

  if (!todayTasks.length) {
    await interaction.editReply('📭 Nenhuma tarefa vence hoje.');
    return;
  }

  const embeds = todayTasks.slice(0, 5).map(task => createTaskEmbed(task));

  await interaction.editReply({
    content: '📚 Atividades que vencem hoje:',
    embeds
  });
}

function isThisWeek(date) {
  const now = new Date();
  const target = new Date(date);
  const diffMs = target - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays >= 0 && diffDays <= 7;
}

async function checkDeadlinesAndNotify(clientInstance) {
  try {
    const guild = clientInstance.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
      console.log('❌ Guild não encontrada.');
      return;
    }

    const channel = guild.channels.cache.find(c => c.name === '📌-tarefas');
    if (!channel || !channel.isTextBased()) {
      console.log('❌ Canal 📌-tarefas não encontrado.');
      return;
    }

    const tasks = await fetchMoodleTasks();
    const now = new Date();

    for (const task of tasks) {
      const due = new Date(task.dueDate);
      const diffMs = due - now;
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours <= 24 && diffHours > 0) {
        const alertKey = `${task.id}-24h`;

        if (!sentAlerts.has(alertKey)) {
          await channel.send({ content: '⏰ Lembrete de atividade', embeds: [createTaskEmbed(task)] });
          sentAlerts.add(alertKey);
          console.log(`✅ Alerta enviado para: ${task.title}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Erro ao verificar prazos:', error);
  }
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`🤖 Online como ${readyClient.user.tag}`);
  await registerCommands();

  await checkDeadlinesAndNotify(client);

  cron.schedule('0 * * * *', async () => {
    console.log('⏰ Verificando prazos do Moodle...');
    await checkDeadlinesAndNotify(client);
  });
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === 'ajuda') {
      await interaction.reply({
        ephemeral: true,
        content: `🤖 **SONIBOT — Ajuda rápida**

📚 **Atividades**
\`/tarefas\` → mostra as próximas atividades
\`/hoje\` → mostra o que vence hoje
\`/semana\` → mostra o que vence nesta semana

📢 **Avisos**
\`/aviso\` → publica um aviso no canal de anúncios

⚙️ **Sistema**
\`/ping\` → verifica se o bot está online
\`/setup\` → cria a estrutura base do servidor
\`/postar-mensagens\` → envia as mensagens iniciais

💡 Use os comandos em **#⚙️-comandos** para manter o servidor organizado.`});
      return;
    }

    if (interaction.commandName === 'ping') {
      await interaction.reply({
        content: '🏓 Pong! SONIBOT está online.',
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === 'proxima') {
      const tasks = await fetchMoodleTasks();

      await interaction.reply({
        content: '❌ Algo deu errado. Tente novamente ou chame um admin.',
        ephemeral: true
      });

      if (!tasks.length) {
        await interaction.reply('📭 Nenhuma tarefa encontrada.');
        return;
      }

      const next = tasks[0];

      await interaction.reply({
        content: '🚨 Próxima atividade:',
        embeds: [createTaskEmbed(next)],
        ephemeral: true
      });
    }

    if (interaction.commandName === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      await setupServer(interaction.guild);
      await interaction.editReply('✅ Estrutura criada com sucesso.');
      return;
    }

    if (interaction.commandName === 'postar-mensagens') {
      await interaction.deferReply({ ephemeral: true });
      await postInitialMessages(interaction.guild);
      await interaction.editReply('✅ Mensagens postadas com sucesso.');
      return;
    }

    if (interaction.commandName === 'tarefas') {
      await interaction.deferReply({ ephemeral: true });

      const tasks = await fetchMoodleTasks();

      if (!tasks.length) {
        await interaction.editReply('📭 Nenhuma tarefa futura encontrada no Moodle.');
        return;
      }

      const message = tasks.slice(0, 10).map(formatTask).join('\n\n');
      await interaction.editReply(message);
      return;
    }

    if (interaction.commandName === 'hoje') {
      await interaction.deferReply({ ephemeral: true });

      .filter(item => {
  const due = new Date(item.dueDate);
  return due >= new Date(new Date().setHours(0,0,0,0));
})

      if (!todayTasks.length) {
        await interaction.editReply('📭 Nenhuma tarefa vence hoje.');
        return;
      }

      const embeds = tasks.slice(0, 5).map(task => createTaskEmbed(task));
      await interaction.editReply({
        content: '📚 Próximas atividades:', embeds
      });
    }

    if (interaction.commandName === 'semana') {
      await interaction.deferReply({ ephemeral: true });

      const tasks = await fetchMoodleTasks();
      const weekTasks = tasks.filter(task => isThisWeek(task.dueDate));

      if (!weekTasks.length) {
        await interaction.editReply('📭 Nenhuma tarefa vence nesta semana.');
        return;
      }

      const message = weekTasks.map(formatTask).join('\n\n');
      await interaction.editReply(message);
      return;
    }

    if (interaction.commandName === 'aviso') {
      await interaction.deferReply({ ephemeral: true });

      const allowedRoles = ['Founder', 'Admin', 'Mentor'];
      const memberRoles = interaction.member.roles.cache.map(role => role.name);
      const canUse = allowedRoles.some(role => memberRoles.includes(role));

      if (!canUse) {
        await interaction.editReply('❌ Você não tem permissão para usar este comando.');
        return;
      }

      const materia = interaction.options.getString('materia');
      const titulo = interaction.options.getString('titulo');
      const mensagem = interaction.options.getString('mensagem');

      const guild = interaction.guild;
      const announcementChannel = guild.channels.cache.find(
        c => c.name === '📢-anuncios'
      );

      if (!announcementChannel || !announcementChannel.isTextBased()) {
        await interaction.editReply('❌ Canal 📢-anuncios não encontrado.');
        return;
      }

      const avisoFormatado = `📢 **Aviso do Professor**

📘 **Matéria:** ${materia}
📝 **Título:** ${titulo}

${mensagem}

👤 Enviado por: ${interaction.user}`;

      await announcementChannel.send(avisoFormatado);
      await interaction.editReply('✅ Aviso publicado com sucesso no canal 📢-anuncios.');
      return;
    }
  } catch (error) {
    console.error('ERRO NO COMANDO:', error);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('❌ Ocorreu um erro ao executar o comando.');
      } else {
        await interaction.reply({
          content: '❌ Ocorreu um erro ao executar o comando.',
          ephemeral: true
        });
      }
    } catch (replyError) {
      console.error('ERRO AO RESPONDER INTERACTION:', replyError);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
