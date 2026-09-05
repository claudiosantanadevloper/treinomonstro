export const WORKOUTS = [

  /* ─── PUSH A — Peitoral Superior + Deltoide Lateral ─────────────────
     32 séries · Composto → Isolador peito → Delta medial alto volume → Tríceps → Core
     Lógica: supino inclinado enquanto SNC fresco → pré-fatiga peito isolado →
             deltoide medial com 3 estímulos distintos → tríceps cabecinha longa primeiro
  ─────────────────────────────────────────────────────────────────────── */
  {
    id: '1',
    label: 'Push A',
    title: 'PUSH A',
    subtitle: 'Peitoral Superior + Deltoide Lateral',
    muscleFocus: ['Peito', 'Ombros', 'Braços'],
    exercises: [
      { id: 't1_1',   icon: 'dumbbell', name: 'Supino Inclinado (Halter / Articulado)',  sets: 4, reps: '6-8',   note: 'Série 1 leve 15x aquecimento · RIR 1-2', rest: 120 },
      { id: 't1_2',   icon: 'layers',   name: 'Crucifixo Inclinado Articulado',          sets: 3, reps: '10-12', note: 'Amplitude máxima · pico 2s · RIR 1',    rest: 90  },
      { id: 't1_3',   icon: 'dumbbell', name: 'Supino Reto (Halter)',                    sets: 3, reps: '8-10',  note: 'Cotovelos 45° · volume de peito',       rest: 90  },
      { id: 't1_4',   icon: 'dumbbell', name: 'Elevação Lateral (Halter)',               sets: 4, reps: '12-15', note: 'Cotovelo ligeiramente dobrado · 3s descida', rest: 60 },
      { id: 't1_5',   icon: 'layers',   name: 'Elevação Lateral na Máquina',             sets: 4, reps: '12-15', note: 'Pico 2s no topo · dropset na última',   rest: 60  },
      { id: 't1_6',   icon: 'activity', name: 'Elevação Lateral na Polia (unilateral)',  sets: 3, reps: '15-20', note: 'Braço cruzado · melhor ROM distal',      rest: 45  },
      { id: 't1_7',   icon: 'activity', name: 'Tríceps Francês (Halter)',                sets: 3, reps: '8-10',  note: 'Cabeça longa · cotovelo alto · RIR 2',  rest: 60  },
      { id: 't1_8',   icon: 'activity', name: 'Tríceps Pulley',                          sets: 4, reps: '10-12', note: 'Pico 2s · punho neutro',                rest: 60  },
      { id: 't1_9',   icon: 'target',   name: 'Prancha Ventral',                         sets: 4, reps: '60s',   note: 'Glúteo contraído · coluna neutra',      rest: 45  },
    ],
  },

  /* ─── LEGS A — Quadríceps + Posterior ────────────────────────────────
     34 séries · Ativação → Agachamento → Leg Press → Isoladores quad →
                 Posterior → Adutora → Panturrilhas → Core
     Lógica: ativação bilateral leve aquece joelho para agachamento pesado →
             compostos descendentes → isoladores uni para corrigir assimetria latente
  ─────────────────────────────────────────────────────────────────────── */
  {
    id: '2',
    label: 'Legs A',
    title: 'LEGS A',
    subtitle: 'Quadríceps + Posterior',
    muscleFocus: ['Pernas'],
    exercises: [
      { id: 't2_0',      icon: 'layers',   name: 'Extensora Bilateral (ativação)',   sets: 3, reps: '15',    note: 'Leve · aquecer joelho · sem falha',         rest: 45  },
      { id: 't2_1',      icon: 'move',     name: 'Agachamento Livre / Pendular',     sets: 4, reps: '6-8',   note: 'Série 1 leve 15x · profundidade paralela', rest: 180 },
      { id: 't2_2',      icon: 'move',     name: 'Leg Press 45°',                    sets: 4, reps: '10-15', note: 'Pés médios · joelho alinhado · amplitude',  rest: 120 },
      { id: 't2_3',      icon: 'layers',   name: 'Extensora Unilateral',             sets: 3, reps: '12-15', note: 'Pico 2s · D depois E · mesmo volume',      rest: 90  },
      { id: 't2_4',      icon: 'dumbbell', name: 'Stiff com Halteres',               sets: 4, reps: '8-10',  note: 'Ênfase no alongamento isquio · RIR 1',     rest: 90  },
      { id: 't2_5',      icon: 'layers',   name: 'Flexora Unilateral',               sets: 3, reps: '10-12', note: 'Pico 2s · descida controlada 3s',           rest: 90  },
      { id: 't2_6',      icon: 'layers',   name: 'Adutora',                          sets: 3, reps: '15',    note: 'Amplitude total · pico 2s',                 rest: 60  },
      { id: 't2_7',      icon: 'layers',   name: 'Panturrilha Sentada (sóleo)',       sets: 4, reps: '12-15', note: 'Pico 2s embaixo · amplitude total',         rest: 60  },
      { id: 't2_8',      icon: 'move',     name: 'Panturrilha em Pé',                sets: 3, reps: '15-20', note: '2s embaixo · gastrocnêmio',                 rest: 45  },
      { id: 't2_9',      icon: 'target',   name: 'Abdominal Remador',                sets: 3, reps: '15',    note: 'Expirar na contração',                      rest: 30  },
    ],
  },

  /* ─── PULL A — Largura de Costas ─────────────────────────────────────
     36 séries · PRIORIDADE MÁXIMA V-TAPER
     Puxadas verticais (largura lat) → Pullover (isolação lat pura) →
     Remo (espessura) → Deltoide posterior → Bíceps
     Lógica: puxada larga pronada abre o lat completo → puxada supinada ativa
             fibras inferiores + bíceps → pullover isola adução escapular pura →
             remo adiciona espessura sem cansar lat vertical antes
  ─────────────────────────────────────────────────────────────────────── */
  {
    id: '3',
    label: 'Pull A',
    title: 'PULL A',
    subtitle: 'Largura de Costas · V-Taper',
    muscleFocus: ['Costas', 'Braços'],
    exercises: [
      { id: 't3_1',    icon: 'layers',    name: 'Puxada Frente Pronada (larga)',        sets: 4, reps: '6-10',  note: 'Série 1 leve 15x · escápula depressa · pico 2s', rest: 120 },
      { id: 't3_2',    icon: 'layers',    name: 'Puxada Supinada / Fechada',            sets: 4, reps: '8-10',  note: 'Cotovelo ao quadril · ativa lat inferior',       rest: 90  },
      { id: 't3_3',    icon: 'activity',  name: 'Pullover na Polia (reta)',              sets: 4, reps: '12-15', note: 'Braço quase estendido · adução escapular pura',  rest: 60  },
      { id: 't3_4',    icon: 'dumbbell',  name: 'Remada Curvada Pronada',               sets: 4, reps: '8-10',  note: 'Tronco 45° · barra raspa o quadril',             rest: 90  },
      { id: 't3_5',    icon: 'layers',    name: 'Remada Unilateral Articulada',         sets: 3, reps: '8-10',  note: 'Cotovelo alto · longa amplitude',                rest: 90  },
      { id: 't3_6',    icon: 'layers',    name: 'Crucifixo Inverso na Máquina',         sets: 3, reps: '12-15', note: 'Deltoide post. · pico 2s · não usar trap',       rest: 60  },
      { id: 't3_7',    icon: 'crosshair', name: 'Face Pull',                            sets: 3, reps: '12-15', note: 'Polia alta · mãos para o rosto · pico 2s',       rest: 60  },
      { id: 't3_8',    icon: 'layers',    name: 'Rosca Scott na Máquina',               sets: 4, reps: '8-10',  note: 'Pico 2s · supinação no topo',                    rest: 60  },
      { id: 't3_9',    icon: 'dumbbell',  name: 'Rosca Martelo Banco 60°',              sets: 3, reps: '8-10',  note: 'Braquial + cabeça longa · descida 3s',           rest: 60  },
      { id: 't3_10',   icon: 'target',    name: 'Abdominal Remador',                    sets: 4, reps: '15',    note: 'Expirar na contração · 2s no topo',              rest: 30  },
    ],
  },

  /* ─── PUSH B — Deltoide Lateral + Peitoral ───────────────────────────
     36 séries · PRIORIDADE: Delta medial (V-Taper topo)
     Desenvolvimento → Alta dose lateral → Elevação frontal → Peito volume → Tríceps → Core
     Lógica: com ombro aquecido pelo desenvolvimento, 3 variações de lateral para
             máximo volume delta medial; peito entra como volume secundário;
             tríceps pesado depois peito para pegar o músculo ainda pré-fadigado
  ─────────────────────────────────────────────────────────────────────── */
  {
    id: '4',
    label: 'Push B',
    title: 'PUSH B',
    subtitle: 'Deltoide Lateral + Peitoral',
    muscleFocus: ['Ombros', 'Peito', 'Braços'],
    exercises: [
      { id: 't4_1',    icon: 'dumbbell', name: 'Desenvolvimento com Halteres',          sets: 4, reps: '6-8',   note: 'Série 1 leve 15x · RIR 1-2 · não trave no topo', rest: 120 },
      { id: 't4_2',    icon: 'dumbbell', name: 'Elevação Lateral (Halter)',              sets: 4, reps: '12-15', note: '3s descida · cotovelinho leve · não balance',     rest: 60  },
      { id: 't4_3',    icon: 'activity', name: 'Elevação Lateral na Polia (unilateral)', sets: 4, reps: '15-20', note: 'Braço cruzado · melhor ROM distal · 2s pico',    rest: 45  },
      { id: 't4_4',    icon: 'layers',   name: 'Elevação Lateral na Máquina',            sets: 4, reps: '12-15', note: 'Pico 2s · dropset na última série',               rest: 60  },
      { id: 't4_5',    icon: 'dumbbell', name: 'Elevação Frontal Alternada (Halter)',    sets: 3, reps: '10-12', note: 'Delta anterior · controlar impulso do tronco',    rest: 60  },
      { id: 't4_6',    icon: 'dumbbell', name: 'Supino Reto (Halter)',                   sets: 3, reps: '8-10',  note: 'Volume de peito · cotovelos 45°',                 rest: 90  },
      { id: 't4_7',    icon: 'layers',   name: 'Crucifixo Inclinado Articulado',         sets: 3, reps: '10-12', note: 'Amplitude máxima · pico 2s · RIR 1',             rest: 90  },
      { id: 't4_8',    icon: 'activity', name: 'Tríceps Testa Cabo',                     sets: 3, reps: '8-10',  note: 'Cabeça longa · cotovelo fixo · trocar Paralelas a cada 2 meses', rest: 60 },
      { id: 't4_9',    icon: 'activity', name: 'Tríceps Pulley',                         sets: 4, reps: '10-12', note: 'Pico 2s · punho neutro',                         rest: 60  },
      { id: 't4_10',   icon: 'target',   name: 'Prancha Lateral (D + E)',                sets: 4, reps: '45s',   note: 'Oblíquo + quadrado lombar · alternado',          rest: 30  },
    ],
  },

  /* ─── LEGS B — Posterior + Glúteo ───────────────────────────────────
     38 séries · PRIORIDADE MÁXIMA (igual a dorsais — gargalo + assimetria)
     Ativação → Terra → Hip Thrust → Afundo Smith (E primeiro!) → Flexoras →
     Adutora → Abdutora → Panturrilhas → Core
     Lógica: extensora leve ativa joelho antes do Terra pesado → Hip Thrust
             isola glúteo em contração pura → Afundo Smith unilateral corrige
             assimetria 1,5cm entre coxa D e E — SEMPRE começar pelo lado E
  ─────────────────────────────────────────────────────────────────────── */
  {
    id: '5',
    label: 'Legs B',
    title: 'LEGS B',
    subtitle: 'Posterior + Glúteo',
    muscleFocus: ['Pernas', 'Glúteo', 'Costas'],
    exercises: [
      { id: 't5_0',      icon: 'layers', name: 'Cadeira Extensora (ativação)',    sets: 3, reps: '15',    note: 'Leve · aquecer joelho antes do Terra',                        rest: 45  },
      { id: 't5_1',      icon: 'move',   name: 'Levantamento Terra',              sets: 4, reps: '6-8',   note: 'Série 1 leve 15x · barra raspa perna · RIR 2',                rest: 180 },
      { id: 't5_2',      icon: 'move',   name: 'Elevação Pélvica (Hip Thrust)',   sets: 4, reps: '10-12', note: 'Pico 2s contraído · glúteo puro · não hiperestender lombar',  rest: 90  },
      { id: 't5_3',      icon: 'move',   name: 'Afundo Smith',                    sets: 4, reps: '10-12', note: '⚠ COMEÇAR SEMPRE PELO LADO E — déficit 1,5cm registrado',    rest: 90  },
      { id: 't5_4',      icon: 'layers', name: 'Mesa Flexora',                    sets: 4, reps: '10-12', note: 'Pico 2s · descida lenta 3s · isquio',                         rest: 90  },
      { id: 't5_5',      icon: 'layers', name: 'Flexora Sentada',                 sets: 3, reps: '12-15', note: 'Pico 2s · sóleo longo + isquio',                              rest: 60  },
      { id: 't5_6',      icon: 'layers', name: 'Adutora',                         sets: 3, reps: '15',    note: 'Amplitude total · pico 2s',                                   rest: 60  },
      { id: 't5_7',      icon: 'layers', name: 'Abdutora',                        sets: 3, reps: '15',    note: 'Glúteo médio · pico 2s · não usar momentum',                  rest: 60  },
      { id: 't5_8',      icon: 'layers', name: 'Panturrilha Sentada (sóleo)',      sets: 4, reps: '12-15', note: 'Pico 2s embaixo · amplitude total · sóleo',                  rest: 60  },
      { id: 't5_9',      icon: 'move',   name: 'Panturrilha em Pé',               sets: 3, reps: '15-20', note: '2s embaixo · gastrocnêmio · peso extra se tolerar',           rest: 45  },
      { id: 't5_10',     icon: 'target', name: 'Abdominal Infra',                 sets: 3, reps: '15',    note: 'Quadril sobe · não se trata de chute',                        rest: 30  },
    ],
  },

  /* ─── PULL B — Espessura de Costas + Trapézio ────────────────────────
     32 séries · Espessura (remos pesados) → Puxada neutra (lat + bíceps) →
     Pullover (lat isolation) → Trapézio → Deltoide post. → Bíceps → Core
     Lógica: remo articulado pronado enquanto SNC fresco para máxima carga →
             puxada triângulo ataca fibras médias/inferiores do lat →
             pullover isola lat sem bíceps limitar → encolhimento de trapézio
             quando o músculo ainda está fresco (não foi exaurido nos remos)
  ─────────────────────────────────────────────────────────────────────── */
  {
    id: '6',
    label: 'Pull B',
    title: 'PULL B',
    subtitle: 'Espessura de Costas + Trapézio',
    muscleFocus: ['Costas', 'Braços'],
    exercises: [
      { id: 't6_1',    icon: 'layers',   name: 'Remada Articulada Pronada',        sets: 4, reps: '6-8',   note: 'Série 1 leve 15x · cotovelo rente ao tronco · RIR 2', rest: 120 },
      { id: 't6_2',    icon: 'dumbbell', name: 'Remada Curvada Supinada',          sets: 3, reps: '8-10',  note: 'Supinação ativa lat inferior + bíceps',               rest: 90  },
      { id: 't6_3',    icon: 'activity', name: 'Puxada com Triângulo (neutra)',     sets: 4, reps: '8-10',  note: 'Pico 2s · cotovelo ao quadril · lat espessura',       rest: 90  },
      { id: 't6_4',    icon: 'activity', name: 'Remada Baixa c/ Triângulo',        sets: 3, reps: '10-12', note: 'Pico 2s · não arredondar lombar',                     rest: 90  },
      { id: 't6_5',    icon: 'activity', name: 'Pullover na Polia (reta)',          sets: 3, reps: '12-15', note: 'Braço quase estendido · V-Taper · adução pura',       rest: 60  },
      { id: 't6_6',    icon: 'dumbbell', name: 'Encolhimento com Halteres',        sets: 3, reps: '10-15', note: 'Pico 2s no topo · amplitude total embaixo',           rest: 60  },
      { id: 't6_7',    icon: 'crosshair',name: 'Face Pull',                        sets: 3, reps: '12-15', note: 'Polia alta · mãos para o rosto · pico 2s',            rest: 60  },
      { id: 't6_8',    icon: 'dumbbell', name: 'Rosca Barra W',                    sets: 3, reps: '6-8',   note: 'Força bíceps · descida completa · RIR 1-2',           rest: 60  },
      { id: 't6_9',    icon: 'activity', name: 'Rosca Unilateral Polia Alta',      sets: 3, reps: '10-12', note: 'Pico 2s no topo · pico de contração',                 rest: 60  },
      { id: 't6_10',   icon: 'target',   name: 'Abdominal Infra',                  sets: 3, reps: '15',    note: 'Quadril sobe · expirar na contração',                 rest: 30  },
    ],
  },

  /* ─── DIA FLEX — Recuperação Ativa ───────────────────────────────── */
  {
    id: 'flex',
    label: 'Flex',
    title: 'DIA FLEX',
    subtitle: 'Recuperação Ativa · Sua Escolha',
    muscleFocus: ['Core', 'Mobilidade'],
    isFlexDay: true,
    exercises: [
      { id: 'fx_1', icon: 'target',   name: 'Prancha Ventral',       sets: 3, reps: '60s',   rest: 60, note: 'Respire fundo · não prenda' },
      { id: 'fx_2', icon: 'target',   name: 'Prancha Lateral (D+E)', sets: 2, reps: '45s',   rest: 45 },
      { id: 'fx_3', icon: 'activity', name: 'Abdominal Infra',       sets: 3, reps: '15',    rest: 30 },
      { id: 'fx_5', icon: 'repeat',   name: 'Mobilidade de Quadril', sets: 1, reps: '5min',  rest: 0,  note: 'Círculos + passadas' },
      { id: 'fx_6', icon: 'repeat',   name: 'Alongamento Global',    sets: 1, reps: '10min', rest: 0,  note: 'Ombros · cadeia post.' },
    ],
  },

  /* ─── CARDIO ──────────────────────────────────────────────────────── */
  {
    id: 'cardio',
    label: 'Cardio',
    title: 'PROTOCOLO CARDIO',
    subtitle: 'Resistência & Condicionamento',
    muscleFocus: ['Cardio'],
    isCardio: true,
    exercises: [
      { id: 'c1', icon: 'timer',    name: 'Aquecimento Ativo',   sets: 1, reps: '5min',      note: 'Mobilidade + Leve',    rest: 0 },
      { id: 'c2', icon: 'zap',      name: 'HIIT Tabata',         sets: 8, reps: '20s / 10s', note: '100% intensidade',     rest: 0 },
      { id: 'c3', icon: 'activity', name: 'Corrida / Esteira',   sets: 1, reps: '20min',     note: 'Zona 2 — FC ~65%',     rest: 0 },
      { id: 'c4', icon: 'move',     name: 'Pular Corda / Steps', sets: 4, reps: '60s',       note: 'Pausa 30s',            rest: 30 },
      { id: 'c5', icon: 'wind',     name: 'Bike / Elíptico',     sets: 1, reps: '15min',     note: 'Cadência constante',   rest: 0 },
      { id: 'c6', icon: 'heart',    name: 'Desaquecimento',      sets: 1, reps: '5min',      note: 'Respiração + Alongar', rest: 0 },
    ],
  },
];
