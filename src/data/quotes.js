// ─── Named Quotes — contextuais, com autoria ───────────────────────────────

const STOICISM = [
  { text: 'O obstáculo no caminho torna-se o caminho.',                             author: 'Marco Aurélio' },
  { text: 'A felicidade da tua vida depende da qualidade dos teus pensamentos.',    author: 'Marco Aurélio' },
  { text: 'Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.', author: 'Sêneca' },
  { text: 'Enquanto vivemos, continuemos a aprender a viver.',                      author: 'Sêneca' },
  { text: 'Primeiro diga a si mesmo quem deseja ser; depois faça o que precisa ser feito.', author: 'Epicteto' },
];

const PATH = [
  { text: 'Hoje é vitória sobre si mesmo; amanhã será vitória sobre os outros.',   author: 'Miyamoto Musashi' },
  { text: 'Não há amor mais sincero do que o amor à excelência.',                  author: 'Miyamoto Musashi' },
];

const IDENTITY = [
  { text: 'Você não sobe ao nível dos seus objetivos. Você cai ao nível dos seus sistemas.', author: 'James Clear' },
  { text: 'Cada ação é um voto na pessoa que você deseja se tornar.',              author: 'James Clear' },
];

const OVERCOMING = [
  { text: 'Aquilo que não me mata me fortalece.',                                   author: 'Friedrich Nietzsche' },
  { text: 'Torna-te quem tu és.',                                                   author: 'Friedrich Nietzsche' },
  { text: 'Odiava cada minuto de treinamento, mas dizia a mim mesmo: não desista. Sofra agora e viva o resto da sua vida como um campeão.', author: 'Muhammad Ali' },
  { text: 'A vontade deve ser mais forte que a habilidade.',                        author: 'Muhammad Ali' },
  { text: 'Disciplina é liberdade.',                                                author: 'Jocko Willink' },
];

const MASTERY = [
  { text: 'Não tema o homem que praticou dez mil chutes uma vez. Tema aquele que praticou um único chute dez mil vezes.', author: 'Bruce Lee' },
];

const ANIME = [
  { text: 'Quando decidi seguir meu sonho, eu já tinha descartado minha vida.',                                            author: 'Zoro' },
  { text: 'Somente aqueles que sofreram por muito tempo conseguem ver luz através das sombras.',                            author: 'Zoro' },
  { text: 'O mais bravo não é aquele que ganha, mas sim aquele que encara seus medos.',                                    author: 'Zoro' },
  { text: 'Há alguém que devo encontrar de novo. Até esse dia, nem mesmo a morte pode tirar minha vida.',                  author: 'Zoro' },
  { text: 'Não importa o que o mundo diz de mim — nunca fiz nada que contrariasse meus princípios e nunca farei.',        author: 'Zoro' },
  { text: 'A lâmina mais forte é aquela que pode proteger o que você quer proteger e cortar o que você quer cortar.',     author: 'Zoro' },
  { text: 'Eu serei o maior espadachim do mundo. Meu nome pode ser infame, mas vai abalar o mundo.',                      author: 'Zoro' },
  { text: 'Você é fraco. Te falta ódio.',                                                                                  author: 'Itachi Uchiha' },
  { text: 'Ninguém que nasceu neste mundo tem o direito de dizer que não pode fazer nada.',                                author: 'Itachi Uchiha' },
  { text: 'Perdão, Sasuke. É a última vez.',                                                                               author: 'Itachi Uchiha' },
  { text: 'Acreditar em si mesmo é o meu ninjutsu.',                                                                       author: 'Naruto Uzumaki' },
  { text: 'Nunca vou desistir. É o meu jeito ninja.',                                                                      author: 'Naruto Uzumaki' },
  { text: 'Se você não compartilha a dor de alguém, você nunca poderá entendê-la.',                                       author: 'Naruto Uzumaki' },
  { text: 'O trabalho duro supera o talento quando o talento não trabalha duro.',                                          author: 'Rock Lee' },
  { text: 'Alguém que não pode proteger o que quer proteger não merece ser chamado de Rei dos Piratas.',                   author: 'Monkey D. Luffy' },
  { text: 'Vou me tornar o Rei dos Piratas. Essa é a minha promessa.',                                                     author: 'Monkey D. Luffy' },
  { text: 'Pode me chamar de idiota. Mas quando eu prometo algo, eu cumpro.',                                               author: 'Monkey D. Luffy' },
  { text: 'Não tenho medo de morrer. Tenho medo de não ter feito o que vim fazer.',                                        author: 'Monkey D. Luffy' },
  { text: 'O sonho é meu. Ninguém vai me tirar isso.',                                                                     author: 'Monkey D. Luffy' },
  { text: 'Não me importo com o que os outros pensam. Só sei que não posso parar agora.',                                  author: 'Monkey D. Luffy' },
  { text: 'Mesmo que meu corpo quebre, não vou parar enquanto ainda estiver respirando.',                                  author: 'Monkey D. Luffy' },
];

const ALL_NAMED = [...STOICISM, ...PATH, ...IDENTITY, ...OVERCOMING, ...MASTERY, ...ANIME];

// ─── Mapa de contexto → arquétipo ───────────────────────────────────────────

const CONTEXT_MAP = {
  first_workout:      IDENTITY,
  new_pr:             [...OVERCOMING, ...PATH, ...ANIME],
  streak_7:           [...STOICISM, ...IDENTITY, ...ANIME],
  cycle_complete:     [...MASTERY, ...PATH, ...ANIME],
  return_after_pause: STOICISM,
  battle_report:      ALL_NAMED,
};

export function getContextualQuote(context = 'battle_report') {
  const pool = CONTEXT_MAP[context] ?? ALL_NAMED;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Frases por hora do dia ──────────────────────────────────────────────────

const TIMED_QUOTES = {
  morning: [
    'O dia ainda não sabe do que você é capaz.',
    'Comece antes das desculpas acordarem.',
    'Hoje você tem uma nova oportunidade de cumprir sua palavra.',
    'A manhã pertence a quem decide aparecer.',
    'Seu futuro começa enquanto os outros ainda dormem.',
  ],
  midday: [
    'A disciplina não faz pausa para esperar motivação.',
    'Cada escolha de agora ecoa no treino de hoje.',
    'Seu progresso está escondido nas pequenas decisões.',
    'Meio do caminho: a segunda metade é sua.',
    'O compromisso não depende do horário.',
  ],
  evening: [
    'O difícil é começar. Depois, deixe o hábito conduzir.',
    'Seu corpo espera aquilo que sua mente decidir.',
    'Entre e faça o trabalho.',
    'O treino que você não quer fazer é exatamente o que você precisa.',
    'A diferença entre hoje e amanhã está na decisão que você toma agora.',
  ],
  night: [
    'Descanse. A recuperação também faz parte da evolução.',
    'Amanhã a jornada continua.',
    'O corpo cresce enquanto a disciplina permanece.',
    'O silêncio da noite carrega os resultados do dia.',
    'Você fez o suficiente para crescer. Agora descanse.',
  ],
};

export function getTimedQuote() {
  const hour = new Date().getHours();
  let period;
  if (hour >= 5 && hour < 11)  period = 'morning';
  else if (hour >= 11 && hour < 17) period = 'midday';
  else if (hour >= 17 && hour < 22) period = 'evening';
  else period = 'night';

  const pool = TIMED_QUOTES[period];
  return { text: pool[Math.floor(Math.random() * pool.length)] };
}

// ─── Pool geral — 100+ frases anônimas ──────────────────────────────────────

export const QUOTES = [
  'Um treino não muda uma vida. Mil treinos mudam.',
  'A consistência escreve histórias que a motivação nunca termina.',
  'O progresso gosta da rotina.',
  'Treinar é uma conversa silenciosa entre você e seu futuro.',
  'A força chega antes ao caráter do que aos músculos.',
  'Hoje é apenas mais um tijolo na construção da sua evolução.',
  'Cada série concluída fortalece uma versão melhor de você.',
  'Os resultados aparecem primeiro na disciplina.',
  'O corpo aprende aquilo que você repete.',
  'Você não precisa vencer todos os dias. Precisa continuar.',
  'Grandes mudanças são discretas no começo.',
  'Quem respeita o processo não teme o tempo.',
  'A rotina faz o que o entusiasmo não consegue manter.',
  'Persistir também é uma habilidade.',
  'O hábito pesa pouco hoje e sustenta muito amanhã.',
  'O treino termina. A transformação continua.',
  'Toda repetição tem um propósito.',
  'Você está construindo algo que ninguém pode fazer por você.',
  'A disciplina sempre cobra menos do que o arrependimento.',
  'Toda escolha deixa uma marca no futuro.',
  'Os músculos crescem. O caráter também.',
  'Você está mais perto do que estava ontem.',
  'Continue mesmo quando ninguém estiver olhando.',
  'Quem aparece todos os dias já está à frente.',
  'Os dias difíceis também contam.',
  'A melhor estratégia ainda é não parar.',
  'A evolução não faz promessas. Ela exige presença.',
  'Treine para o longo prazo.',
  'Os resultados respeitam quem respeita o processo.',
  'A excelência nasce da repetição consciente.',
  'Não acelere. Continue.',
  'Cada treino fortalece mais do que o corpo.',
  'O compromisso vence a inspiração.',
  'As pequenas escolhas nunca são pequenas.',
  'Sua rotina revela suas prioridades.',
  'O corpo responde ao que você faz, não ao que você planeja.',
  'A constância sempre encontra recompensa.',
  'A disciplina transforma esforço em identidade.',
  'O treino de hoje facilita o treino de amanhã.',
  'Você já percorreu um caminho que antes parecia impossível.',
  'Não existe evolução sem continuidade.',
  'A diferença entre desistir e vencer costuma ser apenas mais um dia.',
  'Seu futuro começa nas decisões de hoje.',
  'A dedicação acumula resultados invisíveis.',
  'A mudança acontece antes de aparecer.',
  'Quem constrói hábitos constrói liberdade.',
  'Continue. Seu corpo está ouvindo.',
  'Você está treinando muito mais do que músculos.',
  'A versão de amanhã agradece a disciplina de hoje.',
  'Faça do esforço um costume.',
  'Seu potencial cresce junto com sua constância.',
  'Não espere vontade. Crie movimento.',
  'Cada treino deixa uma assinatura.',
  'Toda jornada merece mais um passo.',
  'O progresso prefere quem permanece.',
  'Você não compete com ninguém além de si mesmo.',
  'A repetição transforma habilidade em natureza.',
  'Os dias comuns constroem resultados extraordinários.',
  'A força é paciente.',
  'Seu maior investimento é continuar.',
  'Treinar é escolher o futuro antes dele chegar.',
  'Você está acumulando vitórias silenciosas.',
  'Nem todo avanço aparece no espelho.',
  'Os melhores resultados levam tempo.',
  'A disciplina elimina desculpas.',
  'Continue plantando. A colheita chega.',
  'Todo campeão já foi iniciante.',
  'Você já venceu ao decidir aparecer.',
  'A constância reduz a distância até seus objetivos.',
  'Cada treino fortalece sua confiança.',
  'A coragem também se pratica.',
  'Você merece descobrir do que é capaz.',
  'Seu limite muda toda vez que você insiste.',
  'Respire. Termine mais uma série.',
  'As melhores transformações acontecem sem pressa.',
  'O tempo recompensa quem continua.',
  'O esforço nunca é desperdiçado.',
  'Hoje importa.',
  'Continue construindo.',
  'Ainda vale a pena.',
  'Você está evoluindo.',
  'Mais um passo.',
  'O próximo treino importa.',
  'Sua história continua hoje.',
  'A disciplina não tira férias.',
  'A persistência nunca envelhece.',
  'Os resultados acompanham quem permanece.',
  'Treine com intenção.',
  'Honre o compromisso que fez consigo mesmo.',
  'Faça o básico extraordinariamente bem.',
  'A jornada vale tanto quanto o destino.',
  'A repetição cria excelência.',
  'Não existe atalho para a consistência.',
  'Seu esforço está sendo registrado.',
  'Toda conquista começou com um primeiro treino.',
  'O impossível costuma desistir primeiro.',
  'A evolução é uma coleção de dias comuns.',
  'Hoje conta.',
  'Grandes físicos são construídos em dias sem motivação.',
  'A força de vontade é um músculo. Treine-a.',
  'O desconforto de hoje é o progresso de amanhã.',
  'Cada sessão é uma promessa cumprida.',
  'Você não precisa ser extremo. Precisa ser consistente.',
  // ── Anime ──────────────────────────────────────────────────────────────────
  'Quando decidi seguir meu sonho, eu já tinha descartado minha vida.',
  'O mais bravo não é aquele que ganha, mas aquele que encara seus medos.',
  'Somente aqueles que sofreram por muito tempo conseguem ver luz através das sombras.',
  'Eu nunca vou perder de novo.',
  'Acreditar em si mesmo é o meu ninjutsu.',
  'Se você não compartilha a dor de alguém, você nunca poderá entendê-la.',
  'Nunca vou desistir. É o meu jeito ninja.',
  'O trabalho duro supera o talento quando o talento não trabalha duro.',
  'Você é fraco. Te falta ódio.',
  'Ninguém que nasceu neste mundo tem o direito de dizer que não pode fazer nada.',
  'Não importa o que o mundo diz de mim — nunca fiz nada que contrariasse meus princípios.',
  'Há alguém que devo encontrar. Até esse dia, nem mesmo a morte pode tirar minha vida.',
  'A lâmina mais forte protege o que você quer proteger e corta o que você quer cortar.',
  'Meu nome pode ser infame, mas vai abalar o mundo.',
  'Perdão. É a última vez.',
  'Minha vontade de fogo nunca se apagará.',
  'A tripulação que perde o respeito pelo capitão facilmente será destruída.',
  'Acreditar em si mesmo não é moleza. É exatamente por isso que vale a pena.',
  'Existe algo de errado em perseguir o sonho mais impossível do mundo.',
  'Seu destino está escrito pela sua espada, não pelo seu passado.',
  'Alguém que não pode proteger o que quer proteger não merece ser chamado de Rei dos Piratas.',
  'Vou me tornar o Rei dos Piratas. Essa é a minha promessa.',
  'Pode me chamar de idiota. Mas quando eu prometo algo, eu cumpro.',
  'Não tenho medo de morrer. Tenho medo de não ter feito o que vim fazer.',
  'O sonho é meu. Ninguém vai me tirar isso.',
  'Não me importo com o que os outros pensam. Só sei que não posso parar agora.',
  'Mesmo que meu corpo quebre, não vou parar enquanto ainda estiver respirando.',
];

// Retrocompatibilidade — HomeView usa getDailyQuote internamente
export function getDailyQuote() {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return QUOTES[dayIndex % QUOTES.length];
}

// ─── Contextos de Cardio ─────────────────────────────────────────────────────

const CARDIO_CONTEXTS = {
  first_cardio:        [...IDENTITY],
  new_distance_record: [...OVERCOMING, ...PATH],
  new_duration_record: [...STOICISM, ...OVERCOMING],
  new_pace_record:     [...MASTERY, ...PATH],
  zone_master:         [...OVERCOMING, ...MASTERY],
  cardio_streak:       [...STOICISM, ...IDENTITY],
  fallback:            ALL_NAMED,
};

export function getCardioContextualQuote(context = 'fallback') {
  const pool = CARDIO_CONTEXTS[context] ?? ALL_NAMED;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Frases durante o treino (descanso / série) ──────────────────────────────

export const WORKOUT_PHRASES = [
  'Mais uma série.',
  'Respire. Continue.',
  'Seu limite está aprendendo.',
  'Você ainda tem mais.',
  'O desconforto é temporário. O progresso é permanente.',
  'Cada repetição conta.',
  'Foco.',
  'Não pare agora.',
  'Esteja presente.',
  'O corpo segue a mente.',
  'Faça valer o descanso.',
  'Concentre. Execute.',
  'Você veio até aqui. Continue.',
  'O trabalho silencioso produz resultados reais.',
  'Mais uma. Sempre mais uma.',
  'Ninguém vai fazer por você.',
  'Seja melhor do que ontem.',
  'O próximo set define a sessão.',
  'Disciplina em ação.',
  'Cada pausa tem um propósito.',
  'Você é fraco. Te falta ódio.',
  'Eu nunca vou perder de novo.',
  'Quando decidi seguir meu sonho, eu já tinha descartado minha vida.',
  'O trabalho duro supera o talento quando o talento não trabalha duro.',
  'Alguém que não pode proteger o que quer proteger não merece ser chamado de Rei dos Piratas.',
  'Mesmo que meu corpo quebre, não vou parar enquanto ainda estiver respirando.',
  'O sonho é meu. Ninguém vai me tirar isso.',
];

export function getWorkoutPhrase(usedSet = new Set()) {
  const available = WORKOUT_PHRASES.filter(p => !usedSet.has(p));
  const pool = available.length > 0 ? available : WORKOUT_PHRASES;
  return pool[Math.floor(Math.random() * pool.length)];
}
