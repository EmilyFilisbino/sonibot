console.log('INICIOU O BOT');

import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  Events,
  EmbedBuilder
} from 'discord.js';

import cron from 'node-cron';
import { setupServer } from './setup-server.mjs';
import { postInitialMessages } from './post-messages.mjs';
import { fetchMoodleTasks } from './moodle-sync.mjs';

// 🔥 proteção contra crash
process.on('unhandledRejection', err => console.error('UNHANDLED:', err));
process.on('uncaughtException', err => console.error('UNCAUGHT:', err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

const sentAlerts = new Set();

// ✅ comandos
const commands = [
  new SlashCommandBuilder().setName('ajuda').setDescription('Ajuda do bot'),
  new SlashCommandBuilder().setName('ping').setDescription('Verifica o bot'),
  new SlashCommandBuilder().setName('setup').setDescription('Configura servidor'),
  new SlashCommandBuilder().setName('postar-mensagens').setDescription('Posta mensagens'),
  new SlashCommandBuilder().setName('tarefas').setDescription('Lista tarefas'),
  new SlashCommandBuilder().setName('hoje').setDescription('Tarefas de hoje'),
  new SlashCommandBuilder().setName('semana').setDescription('Tarefas da semana'),

  new SlashCommandBuilder()
    .setName('aviso')
    .setDescription('Enviar aviso')
    .addStringOption(o =>
      o.setName('materia').setDescription('Matéria').setRequired(true))
    .addStringOption(o =>
      o.setName('titulo').setDescription('Título').setRequired(true))
    .addStringOption(o =>
      o.setName('mensagem').setDescription('Mensagem').setRequired(true))
].map(c => c.toJSON());

// ✅ registrar comandos
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );

  console.log('✅ Comandos registrados');
}

// 🧠 fetch seguro
async function safeFetchTasks() {
  try {
    return await fetchMoodleTasks();
  } catch (err) {
    console.error('ERRO MOODLE:', err);
    return [];
  }
}

// 🎨 embed
function createTaskEmbed(task) {
  return new EmbedBuilder()
    .setTitle(`📚 ${task.title || 'Sem título'}`)
    .setColor(0x00bfff)
    .addFields(
      { name: '📖 Matéria', value: task.subject || 'N/A', inline: true },
      { name: '🕒 Prazo', value: task.dueDate ? new Date(task.dueDate).toLocaleString('pt-BR') : 'N/A', inline: true }
    )
    .setDescription(task.description?.substring(0, 200) || 'Sem descrição');
}

// 📅 helpers
function isToday(date) {
  if (!date) return false;
  const d = new Date(date);
  const t = new Date();
  return d.getDate() === t.getDate() &&
         d.getMonth() === t.getMonth() &&
         d.getFullYear() === t.getFullYear();
}

function isThisWeek(date) {
  if (!date) return false;
  const now = new Date();
  const target = new Date(date);
  const diffDays = (target - now) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
}

// 🔔 alerta automático
async function checkDeadlinesAndNotify() {
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return;

    const channel = guild.channels.cache.find(c => c.name === '📌-tarefas');
    if (!channel || !channel.isTextBased()) return;

    const tasks = await safeFetchTasks();
    const now = new Date();

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const due = new Date(task.dueDate);
      const diffHours = (due - now) / (1000 * 60 * 60);

      if (diffHours <= 24 && diffHours > 0) {
        const key = `${task.id}-24h`;

        if (!sentAlerts.has(key)) {
          await channel.send({
            content: '⏰ Lembrete',
            embeds: [createTaskEmbed(task)]
          });
          sentAlerts.add(key);
        }
      }
    }
  } catch (err) {
    console.error('Erro alerta:', err);
  }
}

// 🚀 ready
client.once(Events.ClientReady, async () => {
  console.log(`🤖 Online como ${client.user.tag}`);

  await registerCommands();
  await checkDeadlinesAndNotify();

  cron.schedule('0 * * * *', checkDeadlinesAndNotify);
});

// 🎮 comandos
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'ping') {
      return interaction.reply({ content: '🏓 Pong!', ephemeral: true });
    }

    if (interaction.commandName === 'ajuda') {
      return interaction.reply({
        content: 'Use /tarefas /hoje /semana',
        ephemeral: true
      });
    }

    if (interaction.commandName === 'tarefas') {
      await interaction.deferReply({ ephemeral: true });

      const tasks = await safeFetchTasks();

      if (!tasks.length)
        return interaction.editReply('📭 Nenhuma tarefa');

      return interaction.editReply(
        tasks.slice(0, 5).map(t => `📚 ${t.title}`).join('\n')
      );
    }

    if (interaction.commandName === 'hoje') {
      await interaction.deferReply({ ephemeral: true });

      const tasks = await safeFetchTasks();
      const todayTasks = tasks.filter(t => isToday(t.dueDate));

      if (!todayTasks.length)
        return interaction.editReply('📭 Nenhuma hoje');

      return interaction.editReply({
        content: '📚 Hoje:',
        embeds: todayTasks.map(createTaskEmbed)
      });
    }

    if (interaction.commandName === 'semana') {
      await interaction.deferReply({ ephemeral: true });

      const tasks = await safeFetchTasks();
      const week = tasks.filter(t => isThisWeek(t.dueDate));

      if (!week.length)
        return interaction.editReply('📭 Nada na semana');

      return interaction.editReply(
        week.map(t => `📚 ${t.title}`).join('\n')
      );
    }

    if (interaction.commandName === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      await setupServer(interaction.guild);
      return interaction.editReply('✅ Setup feito');
    }

    if (interaction.commandName === 'postar-mensagens') {
      await interaction.deferReply({ ephemeral: true });
      await postInitialMessages(interaction.guild);
      return interaction.editReply('✅ Mensagens enviadas');
    }

    if (interaction.commandName === 'aviso') {
      await interaction.deferReply({ ephemeral: true });

      const materia = interaction.options.getString('materia');
      const titulo = interaction.options.getString('titulo');
      const mensagem = interaction.options.getString('mensagem');

      const canal = interaction.guild.channels.cache.find(
        c => c.name === '📢-anuncios'
      );

      if (!canal || !canal.isTextBased())
        return interaction.editReply('Canal não encontrado');

      await canal.send(
        `📢 **${titulo}**\n📘 ${materia}\n\n${mensagem}`
      );

      return interaction.editReply('✅ Aviso enviado');
    }

  } catch (err) {
    console.error('ERRO:', err);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('❌ Erro');
    } else {
      await interaction.reply({ content: '❌ Erro', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
