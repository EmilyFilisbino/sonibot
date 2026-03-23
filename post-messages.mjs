export async function postInitialMessages(guild) {
  const welcome = guild.channels.cache.find(c => c.name === '👋-boas-vindas');
  const rules = guild.channels.cache.find(c => c.name === '📜-regras');
  const anuncios = guild.channels.cache.find(c => c.name === '📢-anuncios');

  if (welcome?.isTextBased()) {
    await welcome.send(
      `🚀 **Bem-vindo ao SONICOS!**

Somos uma equipe de Engenharia de Software da UniSENAI - PR.

Aqui você encontra:
• estudos por matéria
• projetos
• dúvidas
• prazos acadêmicos
• área de resenha e descompressão

Comece em **#🧑‍💻-apresentacoes**.`
    );
  }

  if (rules?.isTextBased()) {
    await rules.send(
      `📜 **Regras do SONICOS**

1. Respeito sempre
2. Nada de spam
3. Use o canal correto
4. Ajude a equipe
5. Resenha liberada na área certa 😎
6. Não deixe atividade para última hora`
    );
  }

  if (anuncios?.isTextBased()) {
    await anuncios.send(
      `📢 **Canal oficial de anúncios do SONICOS**
Aqui ficarão avisos importantes, prazos, novidades e atualizações do SONIBOT.`
    );
  }
}