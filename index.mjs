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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

const sentAlerts = new Set();

const commands = [
  new SlashCommandBuilder().setName('ajuda').setDescription('Mostra os comandos disponíveis'),
  new SlashCommandBuilder().setName('ping').setDescription('Verifica se o bot está online'),
  new SlashCommandBuilder().setName('setup').setDescription('Cria a estrutura do servidor'),
  new SlashCommandBuilder().setName('postar-mensagens').setDescription('Posta mensagens iniciais'),
  new SlashCommandBuilder().setName('tarefas').setDescription('Mostra as próximas tarefas'),
  new SlashCommandBuilder().setName('hoje').setDescription('Mostra tarefas de hoje'),
  new SlashCommandBuilder().setName('semana').setDescription('Mostra tarefas da semana'),

new SlashCommandBuilder()
  .setName('aviso')
  .setDescription('Publica um aviso')
  .addStringOption(o =>
    o.setName('materia')
     .setDescription('Nome da matéria')
     .setRequired(true)
  )
  .addStringOption(o =>
    o.setName('titulo')
     .setDescription('Título do aviso')
     .setRequired(true)
  )
  .addStringOption(o =>
    o.setName('mensagem')
     .setDescription('Mensagem do aviso')
     .setRequired(true)
  )

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );

  console.log('✅ Comandos registrados.');
}

// ================= UTIL =================

function isToday(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const target = new Date(date);

  return target >= today && target < tomorrow;
}

function isThisWeek(date) {
  const now = new Date();
  const target = new Date(date);

  const diffDays = (target - now) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
}

// ================= EMBEDS =================

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
🕒 ${new Date(task.dueDate).toLocaleString('pt-BR')}
📝 ${task.description?.substring(0, 100) || 'Sem descrição'}`;
}

// ================= ALERTAS =================

async function checkDeadlinesAndNotify(clientInstance) {
  try {
    const guild = clientInstance.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return;

    const channel = guild.channels.cache.find(c => c.name === '📌-tarefas');
    if (!channel || !channel.isTextBased()) return;

    const tasks = await fetchMoodleTasks();
    const now = new Date();

    for (const task of tasks) {
      const due = new Date(task.dueDate);
      const diffHours = (due - now) / (1000 * 60 * 60);

      if (diffHours <= 24 && diffHours > 0) {
        const key = `${task.id}-24h`;

        if (!sentAlerts.has(key)) {
          await channel.send({
            content: '⏰ Lembrete de atividade',
            embeds: [createTaskEmbed(task)]
          });

          sentAlerts.add(key);
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
}

// ================= READY =================

client.once(Events.ClientReady, async () => {
  console.log(`🤖 Online como ${client.user.tag}`);

  await registerCommands();
  await checkDeadlinesAndNotify(client);

  cron.schedule('0 * * * *', async () => {
    console.log('⏰ Verificando tarefas...');
    await checkDeadlinesAndNotify(client);
  });
});

// ================= COMANDOS =================

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {

    // AJUDA
    if (interaction.commandName === 'ajuda') {
      return interaction.reply({
        ephemeral: true,
        content: `📚 /tarefas
📅 /hoje
🗓 /semana
📢 /aviso
⚙️ /setup`
      });
    }

    // PING
    if (interaction.commandName === 'ping') {
      return interaction.reply({ content: '🏓 Pong!', ephemeral: true });
    }

    // SETUP
    if (interaction.commandName === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      await setupServer(interaction.guild);
      return interaction.editReply('✅ Servidor configurado.');
    }

    // POST
    if (interaction.commandName === 'postar-mensagens') {
      await interaction.deferReply({ ephemeral: true });
      await postInitialMessages(interaction.guild);
      return interaction.editReply('✅ Mensagens enviadas.');
    }

    // TAREFAS
    if (interaction.commandName === 'tarefas') {
      await interaction.deferReply({ ephemeral: true });

      const tasks = await fetchMoodleTasks();

      if (!tasks.length) {
        return interaction.editReply('📭 Nenhuma tarefa.');
      }

      const msg = tasks.slice(0, 10).map(formatTask).join('\n\n');
      return interaction.editReply(msg);
    }

    // HOJE ✅ CORRIGIDO
    if (interaction.commandName === 'hoje') {
      await interaction.deferReply({ ephemeral: true });

      const tasks = await fetchMoodleTasks();
      const todayTasks = tasks.filter(t => isToday(t.dueDate));

      if (!todayTasks.length) {
        return interaction.editReply('📭 Nenhuma tarefa hoje.');
      }

      const embeds = todayTasks.slice(0, 5).map(createTaskEmbed);

      return interaction.editReply({
        content: '📚 Tarefas de hoje:',
        embeds
      });
    }

    // SEMANA
    if (interaction.commandName === 'semana') {
      await interaction.deferReply({ ephemeral: true });

      const tasks = await fetchMoodleTasks();
      const weekTasks = tasks.filter(t => isThisWeek(t.dueDate));

      if (!weekTasks.length) {
        return interaction.editReply('📭 Nada esta semana.');
      }

      const msg = weekTasks.map(formatTask).join('\n\n');
      return interaction.editReply(msg);
    }

    // AVISO
    if (interaction.commandName === 'aviso') {
      await interaction.deferReply({ ephemeral: true });

      const materia = interaction.options.getString('materia');
      const titulo = interaction.options.getString('titulo');
      const mensagem = interaction.options.getString('mensagem');

      const channel = interaction.guild.channels.cache.find(
        c => c.name === '📢-anuncios'
      );

      if (!channel) {
        return interaction.editReply('❌ Canal não encontrado.');
      }

      await channel.send(`📢 **${titulo}**
📘 ${materia}

${mensagem}`);

      return interaction.editReply('✅ Aviso enviado.');
    }

  } catch (err) {
    console.error(err);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('❌ Erro.');
    } else {
      await interaction.reply({ content: '❌ Erro.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
