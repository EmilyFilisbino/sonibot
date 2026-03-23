import ical from 'node-ical';

export async function fetchMoodleTasks() {
  const icsUrl = process.env.MOODLE_ICS_URL;

  if (!icsUrl) {
    console.log('❌ MOODLE_ICS_URL não configurada no .env');
    return [];
  }

  try {
    const data = await ical.async.fromURL(icsUrl);

    const allEvents = Object.values(data).filter(event => event.type === 'VEVENT');

    console.log(`📥 Eventos brutos encontrados no calendário: ${allEvents.length}`);

    const now = new Date();

    const tasks = allEvents
      .map(event => {
        const rawTitle = event.summary || 'Sem título';
        const rawDescription = event.description || '';
        const startDate = event.start || event.end || null;

        return {
          id: event.uid || rawTitle || `task-${Math.random()}`,
          title: rawTitle,
          subject: detectSubject(rawTitle, rawDescription),
          kind: detectKind(rawTitle, rawDescription),
          dueDate: startDate,
          type: detectWorkType(rawTitle, rawDescription),
          teacherComments: extractTeacherComments(rawDescription),
          description: cleanText(rawDescription)
        };
      })
      .filter(item => item.dueDate)
      .filter(item => new Date(item.dueDate) > now)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    console.log(`📅 ${tasks.length} atividade(s) futura(s) lida(s) do Moodle`);

    return tasks;
  } catch (error) {
    console.error('❌ Erro ao ler calendário do Moodle:', error);
    return [];
  }
}

function detectSubject(summary, description) {
  const text = `${summary} ${description}`.toLowerCase();

  if (text.includes('redes')) return 'Redes';

  if (text.includes('mobile')) return 'Desenvolvimento Mobile';

  if (
    text.includes('ciência de dados') ||
    text.includes('ciencia de dados') ||
    text.includes('data science') ||
    text.includes('dados')
  ) {
    return 'Ciência de Dados';
  }

  if (
    text.includes('jornada') ||
    text.includes('aprendizagem') ||
    text.includes('empresa') ||
    text.includes('ribas') ||
    text.includes('documentos') ||
    text.includes('documento') ||
    text.includes('postagem') ||
    text.includes('postar') ||
    text.includes('poste') ||
    text.includes('postem') ||
    text.includes('lista') ||
    text.includes('template') ||
    text.includes('inicio') ||
    text.includes('início') ||
    text.includes('termino') ||
    text.includes('término')
  ) {
    return 'Jornada de Aprendizagem';
  }

  if (
    text.includes('banco') ||
    text.includes('nosql') ||
    text.includes('não relacional') ||
    text.includes('nao relacional')
  ) {
    return 'Banco de Dados Não Relacional';
  }

  return 'Geral';
}

function detectKind(summary, description) {
  const text = `${summary} ${description}`.toLowerCase();

  if (text.includes('prova')) return 'Prova';
  if (text.includes('aps')) return 'APS';
  if (text.includes('atividade')) return 'Atividade';
  if (text.includes('aula')) return 'Aula';
  if (text.includes('trabalho')) return 'Trabalho';
  if (text.includes('entrega')) return 'Entrega';
  if (text.includes('avaliação') || text.includes('avaliacao')) return 'Avaliação';

  if (
    text.includes('postagem') ||
    text.includes('postar') ||
    text.includes('poste') ||
    text.includes('postem')
  ) {
    return 'Postagem';
  }

  if (
    text.includes('documento') ||
    text.includes('documentos') ||
    text.includes('arquivo') ||
    text.includes('pdf') ||
    text.includes('anexo') ||
    text.includes('anexar')
  ) {
    return 'Documento';
  }

  if (text.includes('fórum') || text.includes('forum')) return 'Fórum';
  if (text.includes('lista')) return 'Lista';
  if (text.includes('template')) return 'Template';
  if (text.includes('inicio') || text.includes('início')) return 'Início';
  if (text.includes('termino') || text.includes('término')) return 'Término';

  return 'Evento acadêmico';
}

function detectWorkType(summary, description) {
  const text = `${summary} ${description}`.toLowerCase();

  if (
    text.includes('grupo') ||
    text.includes('em grupo') ||
    text.includes('dupla') ||
    text.includes('equipe') ||
    text.includes('empresa') ||
    text.includes('ribas')
  ) {
    return 'Grupo';
  }

  if (text.includes('individual')) {
    return 'Individual';
  }

  if (
    text.includes('postar') ||
    text.includes('postagem') ||
    text.includes('poste') ||
    text.includes('postem') ||
    text.includes('anexar') ||
    text.includes('submeter') ||
    text.includes('enviar')
  ) {
    return 'Envio no AVA';
  }

  if (
    text.includes('documentos') ||
    text.includes('documento') ||
    text.includes('lista') ||
    text.includes('template')
  ) {
    return 'Material / Entrega';
  }

  return 'Não identificado';
}

function extractTeacherComments(description) {
  if (!description) return [];

  const cleaned = cleanText(description);

  return cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line =>
      line.length > 8 &&
      !line.toLowerCase().includes('http') &&
      !line.toLowerCase().includes('clique aqui')
    )
    .slice(0, 5);
}

function cleanText(text) {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\r/g, '')
    .trim();
}