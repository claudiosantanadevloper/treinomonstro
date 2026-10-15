export const WORKOUTS = [

  /* ─── PUSH A — Peitoral Superior + Deltoide Lateral ─────────────────
     Ativação ombro → 3 ângulos supino composto → Serrátil → Delta medial → Tríceps → Core
     Lógica: rotação externa ativa manguito ANTES de supino pesado (previne impingement) →
             inclinado com SNC fresco → reto → declinado → serrátil (V-Taper lateral) →
             delta medial 2 variações → tríceps cabeça longa primeiro
     PROGRESSÃO GERAL: bateu o TETO do range com RIR 1-2 em 2 sessões seguidas → +2.5kg compostos / +1kg isoladores
  ─────────────────────────────────────────────────────────────────────── */
  {
    id: '1',
    label: 'Push A',
    title: 'PUSH A',
    subtitle: 'Peitoral Superior + Deltoide Lateral',
    muscleFocus: ['Peito', 'Ombros', 'Braços'],
    exercises: [
      { id: 't1_0',  icon: 'activity', name: 'Rotação Externa com Elástico',
        sets: 2, reps: '15', rest: 30,
        note: 'AQUECIMENTO · Pegada: neutra no elástico · cotovelo 90° fixo ao tronco · rotaciona o antebraço para fora · amplitude total · ativa manguito rotador antes do supino pesado' },

      { id: 't1_1',  icon: 'dumbbell', name: 'Supino Inclinado (Halter / Articulado)',
        sets: 4, reps: '6-8', rest: 120,
        note: 'Pegada: pronada · escápulas retraídas e deprimidas no banco · Respiração: inspira na descida (Valsalva leve), expira forçado na subida · Tensão: cotovelos 45°, não 90° · descida 2s · PROGRESSÃO: 8 reps RIR 1 em 2 sessões → +2.5kg' },

      { id: 't1_2',  icon: 'dumbbell', name: 'Supino Reto (Halter)',
        sets: 3, reps: '8-10', rest: 90,
        note: 'Pegada: pronada · cotovelos 45° do tronco (nunca 90°) · Respiração: inspira descida, expira subida · Tensão: peito "espreme" os halteres um para o outro na subida · pés firmes no chão · escápulas coladas no banco · RIR 1-2' },

      { id: 't1_3',  icon: 'layers',   name: 'Supino Declinado Articulado',
        sets: 3, reps: '10-12', rest: 90,
        note: 'Pegada: pronada · banco ~30° declinado · Respiração: inspira descida, expira subida · Tensão: foco na porção ESTERNAL e inferior do peitoral · cotovelos 30-45° · pico 2s na contração máxima · não bater no peito' },

      { id: 't1_3b', icon: 'activity', name: 'Serrátil Punch (Cabo / Polia)',
        sets: 3, reps: '15', rest: 45,
        note: 'Pegada: pronada neutra · braço quase estendido (micro-flexão no cotovelo) · Respiração: expira ao "empurrar" (protração escapular) · Tensão: serrátil anterior empurra — não o tríceps · ombro não sobe · pico 2s na protração · V-Taper lateral visível' },

      { id: 't1_4',  icon: 'dumbbell', name: 'Elevação Lateral (Halter)',
        sets: 4, reps: '12-15', rest: 60,
        note: 'Pegada: neutra · cotovelo ACIMA do punho (cotovelo puxa, não o punho) · Respiração: expira na subida · Tensão: imagine "derramar água de um copo" ao subir · descida 3s controlada · não balance o tronco · RIR 1-2' },

      { id: 't1_5',  icon: 'layers',   name: 'Elevação Lateral na Máquina',
        sets: 4, reps: '12-15', rest: 60,
        note: 'Pegada: apoio no pad do cotovelo (não punho) · Respiração: expira na subida · Tensão: pico 2s no topo · descida 2s controlada · DROPSET na última série: falha → tira 30% do peso → falha novamente sem pausa · RIR 1' },

      { id: 't1_6',  icon: 'activity', name: 'Tríceps Francês com Halter',
        sets: 3, reps: '8-10', rest: 75,
        note: 'Pegada: neutra (palmas uma para a outra) · cotovelos apontam para o TETO, não abrem para fora · Respiração: expira na extensão · Tensão: apenas o antebraço se move · descer atrás da cabeça para máximo alongamento da cabeça longa · RIR 2' },

      { id: 't1_7',  icon: 'activity', name: 'Tríceps Pulley (corda / barra)',
        sets: 4, reps: '10-12', rest: 60,
        note: 'Pegada: pronada (barra) ou neutra (corda — abre as pontas no fundo) · cotovelos FIXOS ao tronco durante todo o movimento · Respiração: expira na extensão · Tensão: pico 2s com cotovelo totalmente estendido · não mover o ombro' },

      { id: 't1_8',  icon: 'target',   name: 'Prancha Ventral',
        sets: 4, reps: '60s', rest: 45,
        note: 'Apoio nos antebraços · Respiração: nasal rítmico — NUNCA prender · Tensão: glúteo contraído, core ativo, quadril neutro (não sobe nem desce) · olhar para o chão · se tremer muito = dividir em 2×30s com 10s pausa' },
    ],
  },

  /* ─── LEGS A — Quadríceps + Posterior ────────────────────────────────
     Mobilidade → Ativação → Agachamento → Leg Press → Isoladores quad →
     Posterior → Adutora → Panturrilhas → Core
     Lógica: mobilidade de tornozelo libera ROM do agachamento para fêmur longo →
             ativação bilateral aquece joelho → compostos descendentes →
             isoladores unilaterais corrigem assimetria latente
  ─────────────────────────────────────────────────────────────────────── */
  {
    id: '2',
    label: 'Legs A',
    title: 'LEGS A',
    subtitle: 'Quadríceps + Posterior',
    muscleFocus: ['Pernas'],
    exercises: [
      { id: 't2_mob', icon: 'activity', name: 'Mobilidade de Tornozelo',
        sets: 2, reps: '10/lado', rest: 0,
        note: 'AQUECIMENTO · Em pé, joelho vai além da ponta do pé em círculos · calcanhar NO CHÃO · 10 reps cada sentido · fêmur longo = tornozelo tenso limita profundidade do agachamento — esse mobilização é obrigatória' },

      { id: 't2_0',  icon: 'layers',   name: 'Extensora Bilateral (ativação)',
        sets: 3, reps: '15', rest: 45,
        note: 'Pegada: mãos nos apoios laterais · Respiração: expira na extensão · Tensão: LEVE (40-50% da carga de trabalho) · sem falha · objetivo: aquecer o tendão patelar e joelho antes do agachamento · descida 2s controlada' },

      { id: 't2_1',  icon: 'move',     name: 'Agachamento Livre / Pendular',
        sets: 4, reps: '6-8', rest: 180,
        note: 'Pegada: afastada, barra high-bar (trapézio alto) · VALSALVA: inspira fundo, prende o ar durante o movimento, expira ao passar do sticking point · Tensão: pés abertos (fêmur longo), joelhos seguem os dedos, peito para cima · PROGRESSÃO: 8 reps RIR 1 em 2 sessões → +2.5kg' },

      { id: 't2_2',  icon: 'move',     name: 'Leg Press 45°',
        sets: 4, reps: '10-15', rest: 120,
        note: 'FÊMUR LONGO: pés na parte ALTA da plataforma, abertura de ombro · Respiração: inspira descida, expira subida · Tensão: joelhos seguem 2°–3° além do dedão · lombar COLA na cadeira — não solta no fundo · amplitude completa' },

      { id: 't2_3',  icon: 'layers',   name: 'Extensora Unilateral',
        sets: 3, reps: '12-15', rest: 60,
        note: 'Pegada: mãos nos apoios · Respiração: expira na extensão · Tensão: pico 2s com joelho estendido · descida 3s CONTROLADA · D depois E · usar MESMO volume — corrige assimetria · RIR 1' },

      { id: 't2_4',  icon: 'dumbbell', name: 'Stiff / RDL com Halteres',
        sets: 4, reps: '8-10', rest: 90,
        note: 'Pegada: pronada · halteres raspam a frente das pernas durante todo o movimento · VALSALVA: prende na descida, expira ao subir · Tensão: empurra o quadril para TRÁS (não dobra o joelho), sente o isquio ESTICAR · FÊMUR LONGO: inclinação maior do tronco é normal · RIR 1' },

      { id: 't2_5',  icon: 'layers',   name: 'Flexora Unilateral',
        sets: 3, reps: '10-12', rest: 75,
        note: 'Pegada: apoio no pad da panturrilha · Respiração: expira na flexão · Tensão: pico 2s contraído · descida 3s LENTA (fase excêntrica é onde o músculo cresce) · não usar momentum no começo da repetição · RIR 1' },

      { id: 't2_6',  icon: 'layers',   name: 'Adutora (Máquina)',
        sets: 3, reps: '15', rest: 60,
        note: 'Pegada: mãos nos apoios · Respiração: expira na adução (fechamento) · Tensão: amplitude TOTAL nas duas direções · pico 2s com joelhos juntos · descida 2s · não usar impulso do tronco' },

      { id: 't2_7',  icon: 'layers',   name: 'Panturrilha Sentada — Sóleo',
        sets: 4, reps: '12-15', rest: 60,
        note: 'Pegada: joelhos sob o pad · Respiração: expira na subida (plantiflexão) · Tensão: 2s NO PONTO MAIS BAIXO (máximo alongamento) · pico 2s no topo · AMPLITUDE TOTAL obrigatória — ventre curto em pessoas altas · não encurtar ROM nunca' },

      { id: 't2_8',  icon: 'move',     name: 'Panturrilha em Pé — Gastrocnêmio',
        sets: 4, reps: '8-12', rest: 60,
        note: 'Pegada: apoio firme na máquina · Respiração: expira na subida · Tensão: CARGA ALTA (gastro responde pesado) · 2s no ponto mais baixo (dorsiflexão máxima) · subida explosiva · pico 2s no topo · AMPLITUDE TOTAL — nunca encurtar para usar mais peso · PROGRESSÃO: 12 reps RIR 1 em 2 sessões → +carga' },

      { id: 't2_9',  icon: 'target',   name: 'Abdominal Remador',
        sets: 3, reps: '15', rest: 30,
        note: 'Deitado, mãos atrás da cabeça ou estendidas · Respiração: EXPIRA na contração (abdominal ativa na expiração) · Tensão: cotovelo toca o joelho oposto · lombar cola no chão durante todo o movimento · 2s no pico da contração' },
    ],
  },

  /* ─── PULL A — Largura de Costas ─────────────────────────────────────
     PRIORIDADE MÁXIMA V-TAPER
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
      { id: 't3_1',  icon: 'layers',    name: 'Puxada Frente Pronada — Pegada Larga',
        sets: 4, reps: '6-10', rest: 120,
        note: 'Pegada: PRONADA, afastada além dos ombros · escápulas DEPRIMEM antes de dobrar o cotovelo (imagina "quebrar a barra ao meio") · Respiração: expira na puxada (descida da barra) · Tensão: barra toca o peito alto, pico 2s · descida lenta 3s · PROGRESSÃO: 10 reps RIR 1 em 2 sessões → +2.5kg' },

      { id: 't3_2',  icon: 'layers',    name: 'Puxada Supinada — Pegada Fechada',
        sets: 4, reps: '8-10', rest: 90,
        note: 'Pegada: SUPINADA, largura dos ombros · Respiração: expira na puxada · Tensão: cotovelo vai AO QUADRIL (não para trás) — ativa lat inferior + bíceps · pico 2s com cotovelo ao lado do corpo · descida 2s com braço quase estendido' },

      { id: 't3_3',  icon: 'activity',  name: 'Pullover na Polia — Barra Reta',
        sets: 4, reps: '12-15', rest: 60,
        note: 'Pegada: PRONADA, barra reta · braços quase estendidos (micro-flexão 10°) · Respiração: expira ao puxar para baixo (adução) · Tensão: APENAS o lat aduz o braço — não o tríceps, não o bíceps · pico 2s com braço ao lado do corpo · V-Taper puro' },

      { id: 't3_4',  icon: 'dumbbell',  name: 'Remada Curvada Pronada',
        sets: 4, reps: '8-10', rest: 90,
        note: 'Pegada: PRONADA, afastada ombros · tronco 45° · VALSALVA: prende na descida, expira ao puxar · Tensão: barra raspa o quadril na subida · cotovelo rente ao tronco, aponta para trás · pico 2s · não endireitar o tronco durante o movimento' },

      { id: 't3_5',  icon: 'layers',    name: 'Remada Unilateral Articulada',
        sets: 3, reps: '8-10', rest: 90,
        note: 'Pegada: neutra na máquina · Respiração: expira na puxada · Tensão: cotovelo ALTO (acima da linha da costa) — diferente do remo de lat · deixa o ombro descer na descida (longa amplitude) · pico 2s com cotovelo atrás do tronco' },

      { id: 't3_6',  icon: 'layers',    name: 'Crucifixo Inverso na Máquina',
        sets: 3, reps: '12-15', rest: 60,
        note: 'Pegada: neutra · Respiração: expira na abertura dos braços · Tensão: NÃO usar trapézio — imagina que os cotovelos puxam para fora e para trás · pico 2s atrás · descida 2s controlada · deltoide POSTERIOR é o foco, não o trapézio' },

      { id: 't3_7',  icon: 'crosshair', name: 'Face Pull com Corda',
        sets: 3, reps: '12-15', rest: 60,
        note: 'Pegada: neutra na corda · polia ao nível da TESTA · Respiração: expira ao puxar · Tensão: puxar em direção ao ROSTO (não ao pescoço) · cotovelos altos e abertos · separar as pontas da corda no final · ativa deltoide posterior + manguito rotador' },

      { id: 't3_8',  icon: 'layers',    name: 'Rosca Scott na Máquina',
        sets: 4, reps: '8-10', rest: 75,
        note: 'Pegada: SUPINADA · braços apoiados no pad na parte posterior do braço · Respiração: expira na flexão · Tensão: SUPINAR o punho no topo (roda para fora) — contrai bíceps ao máximo · pico 2s · descida 3s controlada · não soltar no fundo (mantém tensão)' },

      { id: 't3_9',  icon: 'dumbbell',  name: 'Rosca Martelo Banco 60°',
        sets: 3, reps: '8-10', rest: 75,
        note: 'Pegada: NEUTRA (palmas uma para a outra) · banco inclinado 60° elimina impulso · Respiração: expira na flexão · Tensão: braquial + cabeça longa do bíceps · cotovelo FIXO · descida 3s LENTA (excêntrico pesado) · RIR 1-2' },

      { id: 't3_10', icon: 'target',    name: 'Abdominal Remador',
        sets: 4, reps: '15', rest: 30,
        note: 'Respiração: EXPIRA na contração · Tensão: lombar no chão sempre · cotovelo ao joelho oposto · 2s pico de contração · não usar impulso do pescoço' },
    ],
  },

  /* ─── PUSH B — Deltoide Lateral + Peitoral (Estímulo Alongamento) ───
     Ativação ombro → Desenvolvimento → Laterais (2 variações) →
     Peito ALONGAMENTO (Crucifixo) → Peito ADUÇÃO (Cross Over) →
     Frontal → Tríceps → Core
     Lógica: Push A = 3 ângulos de supino (posição encurtada/média).
             Push B = estímulo diferente: Crucifixo (comprimento máximo) +
             Cross Over (adução pura). Frontal DEPOIS do peito — não pré-fatiga
             o delta anterior antes dos exercícios de peito.
     PROGRESSÃO GERAL: bateu TETO do range com RIR 1-2 em 2 sessões → +2.5kg compostos / +1kg isoladores
  ─────────────────────────────────────────────────────────────────────── */
  {
    id: '4',
    label: 'Push B',
    title: 'PUSH B',
    subtitle: 'Deltoide Lateral + Peitoral Alongamento',
    muscleFocus: ['Ombros', 'Peito', 'Braços'],
    exercises: [
      { id: 't4_0',  icon: 'activity', name: 'Rotação Externa com Elástico',
        sets: 2, reps: '15', rest: 30,
        note: 'AQUECIMENTO · Pegada: neutra no elástico · cotovelo 90° fixo ao tronco · rotaciona o antebraço para fora · amplitude total · ativa manguito rotador antes do desenvolvimento pesado · mesma sequência do Push A' },

      { id: 't4_1',  icon: 'dumbbell', name: 'Desenvolvimento com Halteres',
        sets: 4, reps: '6-8', rest: 120,
        note: 'Pegada: pronada · punho sobre o cotovelo (não inclinar punho) · Respiração: inspira descida, expira subida · Tensão: NÃO travar no topo (mantém tensão no deltoide) · escápulas levemente retraídas · descida até cotovelos 90° · PROGRESSÃO: 8 reps RIR 1 em 2 sessões → +2.5kg' },

      { id: 't4_2',  icon: 'dumbbell', name: 'Elevação Lateral (Halter)',
        sets: 4, reps: '12-15', rest: 60,
        note: 'Pegada: neutra · cotovelo ACIMA do punho (cotovelo puxa, punho apenas segura) · Respiração: expira na subida · Tensão: "derramar água do copo" na subida · descida 3s controlada · NUNCA balanço do tronco · RIR 1-2' },

      { id: 't4_3',  icon: 'layers',   name: 'Elevação Lateral na Máquina',
        sets: 4, reps: '12-15', rest: 60,
        note: 'Pegada: apoio no pad do cotovelo · Respiração: expira na subida · Tensão: pico 2s no topo · descida 2s · DROPSET obrigatório na última série: vai à falha → tira 30% → falha novamente sem pausa · RIR 1' },

      { id: 't4_4',  icon: 'layers',   name: 'Crucifixo Inclinado Articulado',
        sets: 3, reps: '10-12', rest: 90,
        note: 'Pegada: neutra (palmas uma para a outra no ponto mais baixo) · cotovelo micro-flexionado FIXO durante todo o movimento · Respiração: inspira na abertura (descida), expira no fechamento · Tensão: AMPLITUDE MÁXIMA na abertura — sentir o peitoral ESTICAR · pico 2s no fechamento · RIR 1' },

      { id: 't4_5',  icon: 'activity', name: 'Cross Over na Polia (baixo→cima)',
        sets: 3, reps: '12-15', rest: 60,
        note: 'Pegada: neutra/supinada · polia BAIXA · Respiração: expira na adução/cruzamento · Tensão: braços partem dos lados (posição de baixo) e cruzam acima da cintura — fibras inferiores e esternal · pico 2s com punhos cruzados · descida 2s · RIR 1' },

      { id: 't4_6',  icon: 'dumbbell', name: 'Elevação Frontal Alternada (Halter)',
        sets: 3, reps: '10-12', rest: 60,
        note: 'Pegada: pronada (palma para baixo) ou neutra · Respiração: expira na subida · Tensão: alternada — um braço desce enquanto o outro sobe (mantém tensão constante) · NUNCA balanço do tronco · vai até a altura dos ombros (não acima) · descida 2s' },

      { id: 't4_7',  icon: 'activity', name: 'Tríceps Testa com Cabo (barra EZ)',
        sets: 3, reps: '8-10', rest: 75,
        note: 'Pegada: pronada, barra EZ ou reta · cotovelos apontam para o TETO e ficam FIXOS · Respiração: expira na extensão · Tensão: apenas o antebraço se move · descer até a testa/atrás da cabeça (máximo alongamento cabeça longa) · pico 2s estendido · RIR 1-2' },

      { id: 't4_8',  icon: 'activity', name: 'Tríceps Pulley (corda / barra)',
        sets: 4, reps: '10-12', rest: 60,
        note: 'Pegada: pronada (barra) ou neutra-corda (abre as pontas no fundo) · cotovelos FIXOS ao tronco · Respiração: expira na extensão · Tensão: pico 2s com cotovelo totalmente estendido · não mover ombro · descida controlada 2s' },

      { id: 't4_9',  icon: 'target',   name: 'Prancha Lateral (D + E)',
        sets: 4, reps: '45s', rest: 30,
        note: 'Apoio no antebraço e borda do pé · Respiração: nasal rítmico · Tensão: quadril NÃO deixa cair · linha reta da cabeça ao calcanhar · oblíquo e quadrado lombar ativos · alternado: D completo → E completo' },
    ],
  },

  /* ─── LEGS B — Posterior + Glúteo ───────────────────────────────────
     PRIORIDADE MÁXIMA (igual a dorsais — gargalo + assimetria)
     Mobilidade → Ativação → Terra → Hip Thrust → Afundo Smith (E primeiro!) →
     Flexoras → Adutora → Abdutora → Panturrilhas → Core
     Lógica: mobilidade libera quadril/tornozelo para o Terra → extensora aquece joelho →
             Terra pesado com SNC fresco → Hip Thrust isola glúteo em contração pura →
             Afundo Smith corrige assimetria 1.5cm — SEMPRE começar pelo lado E
  ─────────────────────────────────────────────────────────────────────── */
  {
    id: '5',
    label: 'Legs B',
    title: 'LEGS B',
    subtitle: 'Posterior + Glúteo',
    muscleFocus: ['Pernas', 'Glúteo', 'Costas'],
    exercises: [
      { id: 't5_mob', icon: 'activity', name: 'Mobilidade de Tornozelo + Quadril',
        sets: 2, reps: '10/lado', rest: 0,
        note: 'AQUECIMENTO · Tornozelo: joelho à frente em círculos com calcanhar no chão · Quadril: passada profunda lateral + rotação do quadril · fêmur longo precisa de mobilidade bilateral antes do Terra · 2 rounds cada lado' },

      { id: 't5_0',  icon: 'layers',   name: 'Cadeira Extensora (ativação)',
        sets: 3, reps: '15', rest: 45,
        note: 'Pegada: mãos nos apoios · Respiração: expira na extensão · Tensão: LEVE — objetivo é aquecer o tendão patelar e joelho antes do Levantamento Terra · sem falha · descida 2s controlada · não carga de trabalho real' },

      { id: 't5_1',  icon: 'move',     name: 'Levantamento Terra',
        sets: 4, reps: '6-8', rest: 180,
        note: 'Pegada: DUPLA PRONADA (ou mista acima de ~80kg) · barra raspa as pernas durante todo o movimento · VALSALVA TOTAL: inspira fundo, prende durante TODA a rep, expira ao topo antes de descer · FÊMUR LONGO: quadril começa levemente mais alto — normal · PROGRESSÃO: 8 reps RIR 1 em 2 sessões → +2.5kg' },

      { id: 't5_2',  icon: 'move',     name: 'Elevação Pélvica — Hip Thrust',
        sets: 4, reps: '10-12', rest: 90,
        note: 'Pegada: pronada na barra com almofada · ombros no banco · Respiração: expira na extensão do quadril · Tensão: mento ao peito (não hiperextender o pescoço) · GLÚTEO contrai no topo por 2s · lombar NEUTRA — não hiperestender · joelhos 90° no topo · descida 2s' },

      { id: 't5_3',  icon: 'move',     name: 'Afundo no Smith',
        sets: 4, reps: '10-12', rest: 90,
        note: '⚠ SEMPRE COMEÇAR PELO LADO ESQUERDO (déficit 1.5cm registrado) · Respiração: inspira descida, expira subida · Tensão: tronco levemente inclinado, joelho da frente não passa o pé · amplitude: joelho de trás QUASE toca o chão · PROGRESSÃO: 12 reps RIR 1 em 2 sessões → +carga' },

      { id: 't5_4',  icon: 'layers',   name: 'Mesa Flexora (deitada)',
        sets: 4, reps: '10-12', rest: 90,
        note: 'Pegada: mãos nos apoios · Respiração: expira na flexão · Tensão: pico 2s contraído · descida 3s LENTA (excêntrico é onde o isquio cresce) · NÃO usar impulso/balançar para subir · quadril cola na mesa durante todo o movimento' },

      { id: 't5_5',  icon: 'layers',   name: 'Flexora Sentada (sóleo + isquio)',
        sets: 3, reps: '12-15', rest: 60,
        note: 'Pegada: apoio nas coxas/joelhos · Respiração: expira na flexão · Tensão: pico 2s · descida 2s · sóleo também é ativado — diferente da mesa flexora · bom para o sóleo longo em pessoas altas' },

      { id: 't5_6',  icon: 'layers',   name: 'Adutora (Máquina)',
        sets: 3, reps: '15', rest: 60,
        note: 'Pegada: mãos nos apoios · Respiração: expira na adução · Tensão: amplitude TOTAL · pico 2s com joelhos juntos · descida 2s · não usar impulso do tronco' },

      { id: 't5_7',  icon: 'layers',   name: 'Abdutora (Máquina)',
        sets: 3, reps: '15', rest: 60,
        note: 'Pegada: mãos nos apoios · Respiração: expira na abdução · Tensão: glúteo médio · pico 2s na abertura máxima · descida 2s controlada · não usar momentum do tronco' },

      { id: 't5_8',  icon: 'layers',   name: 'Panturrilha Sentada — Sóleo',
        sets: 4, reps: '12-15', rest: 60,
        note: 'Pegada: joelhos sob o pad · Respiração: expira na plantiflexão (subida) · Tensão: 2s NO PONTO MAIS BAIXO (alongamento máximo) · pico 2s no topo · AMPLITUDE TOTAL — sóleo tem ventre curto em pessoas altas: ROM é o diferencial · nunca encurtar para colocar mais carga' },

      { id: 't5_9',  icon: 'move',     name: 'Panturrilha em Pé — Gastrocnêmio',
        sets: 4, reps: '8-12', rest: 60,
        note: 'Pegada: apoio firme na máquina · Respiração: expira na subida · Tensão: CARGA ALTA (gastro responde pesado, diferente do sóleo) · 2s no ponto mais baixo · pico 2s no topo · AMPLITUDE TOTAL sempre · PROGRESSÃO: 12 reps RIR 1 em 2 sessões → +carga' },

      { id: 't5_10', icon: 'target',   name: 'Abdominal Infra',
        sets: 3, reps: '15', rest: 30,
        note: 'Deitado, mãos sob o glúteo · Respiração: EXPIRA ao elevar o quadril · Tensão: o QUADRIL sobe (não apenas as pernas — aí é iliopsoas) · lombar cola no chão · 2s no pico · descida 2s controlada' },
    ],
  },

  /* ─── PULL B — Espessura de Costas + Trapézio ────────────────────────
     Remo pesado → Pullover (lat fresco, posição 3) → Puxada neutra →
     Remo secundário → Trapézio → Face Pull → Bíceps → Core
     Lógica: remo articulado com SNC fresco → Pullover na posição 3 enquanto
             lat ainda tem energia (antes dos outros puxadas) → puxada triângulo
             fecha o lat → trapézio fresco → deltoide posterior → bíceps pesado
  ─────────────────────────────────────────────────────────────────────── */
  {
    id: '6',
    label: 'Pull B',
    title: 'PULL B',
    subtitle: 'Espessura de Costas + Trapézio',
    muscleFocus: ['Costas', 'Braços'],
    exercises: [
      { id: 't6_1',  icon: 'layers',   name: 'Remada Articulada Pronada (Máquina)',
        sets: 4, reps: '6-8', rest: 120,
        note: 'Pegada: PRONADA, largura dos ombros · cotovelo rente ao tronco (não abre) · Respiração: expira na puxada · Tensão: escápulas RETRAEM no pico · pico 2s · descida 3s controlada (excêntrico pesado) · PROGRESSÃO: 8 reps RIR 1 em 2 sessões → +2.5kg' },

      { id: 't6_2',  icon: 'dumbbell', name: 'Remada Curvada Supinada',
        sets: 3, reps: '8-10', rest: 90,
        note: 'Pegada: SUPINADA, largura dos ombros · tronco 45° · Respiração: Valsalva leve · Tensão: supinação do punho ativa lat inferior + bíceps — sensação diferente da pronada · cotovelo ao quadril · pico 2s · descida controlada 2s' },

      { id: 't6_3',  icon: 'activity', name: 'Pullover na Polia — Barra Reta',
        sets: 3, reps: '12-15', rest: 60,
        note: 'Pegada: PRONADA · braços quase estendidos (10° de micro-flexão) · Respiração: expira ao puxar para baixo · Tensão: lat aduz o úmero — só o lat, não o tríceps · pico 2s com braço ao lado do corpo · POSIÇÃO 3 INTENCIONAL: lat ainda tem energia antes dos outros puxadas' },

      { id: 't6_4',  icon: 'activity', name: 'Puxada com Triângulo — Pegada Neutra',
        sets: 4, reps: '8-10', rest: 90,
        note: 'Pegada: NEUTRA (V-bar/triângulo) · Respiração: expira na puxada · Tensão: cotovelo vai AO QUADRIL (não para trás) · pico 2s · escápulas deprimem antes de dobrar o cotovelo · descida lenta 2s com alongamento do lat' },

      { id: 't6_5',  icon: 'activity', name: 'Remada Baixa com Triângulo — Neutra',
        sets: 3, reps: '10-12', rest: 90,
        note: 'Pegada: NEUTRA (triângulo) · sentado, tronco levemente à frente no início · Respiração: expira na puxada · Tensão: NÃO arredondar a lombar · escápulas retraem no pico 2s · amplitude total para frente (deixa o ombro avançar) · descida 2s' },

      { id: 't6_6',  icon: 'dumbbell', name: 'Encolhimento com Halteres',
        sets: 3, reps: '10-15', rest: 60,
        note: 'Pegada: neutra · Respiração: expira ao encolher · Tensão: pico 2s no topo (ombros chegam às orelhas) · amplitude TOTAL para baixo (ombros descem completamente, não encurtar) · NÃO rolar os ombros · movimento VERTICAL puro' },

      { id: 't6_7',  icon: 'crosshair', name: 'Face Pull com Corda',
        sets: 3, reps: '12-15', rest: 60,
        note: 'Pegada: neutra na corda · polia ao nível da TESTA · Respiração: expira ao puxar · Tensão: cotovelos ALTOS e abertos · puxar em direção ao rosto separando as pontas · deltoide posterior + manguito rotador · pico 2s · descida 2s' },

      { id: 't6_8',  icon: 'dumbbell', name: 'Rosca Direta — Barra W',
        sets: 3, reps: '6-8', rest: 90,
        note: 'Pegada: SUPINADA nos ângulos externos da barra W · cotovelos FIXOS ao tronco · Respiração: expira na flexão · Tensão: descida 3s LENTA e COMPLETA (braço quase estendido — mantém tensão) · NÃO balanço do tronco · RIR 1-2 · bíceps pesado' },

      { id: 't6_9',  icon: 'activity', name: 'Rosca Unilateral Polia Alta',
        sets: 3, reps: '10-12', rest: 60,
        note: 'Pegada: supinada · polia acima da cabeça · braço estendido no início · Respiração: expira na flexão · Tensão: SUPINAR o punho no topo (roda o punho para fora) — pico de contração máximo · diferente do curl normal: trabalha o bíceps em posição encurtada (complementar) · pico 2s' },

      { id: 't6_10', icon: 'target',   name: 'Abdominal Infra',
        sets: 3, reps: '15', rest: 30,
        note: 'Deitado · Respiração: EXPIRA ao elevar o quadril · Tensão: QUADRIL sobe (não só as pernas) · lombar cola no chão · 2s no pico · descida 2s controlada' },
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
      { id: 'fx_1', icon: 'target',   name: 'Prancha Ventral',       sets: 3, reps: '60s',   rest: 60, note: 'Antebraços · Respiração: nasal rítmico · glúteo contraído · coluna neutra' },
      { id: 'fx_2', icon: 'target',   name: 'Prancha Lateral (D+E)', sets: 2, reps: '45s',   rest: 45, note: 'Antebraço e borda do pé · quadril não cai · oblíquo ativo' },
      { id: 'fx_3', icon: 'activity', name: 'Abdominal Infra',       sets: 3, reps: '15',    rest: 30, note: 'Expira na contração · quadril sobe · lombar no chão' },
      { id: 'fx_5', icon: 'repeat',   name: 'Mobilidade de Quadril', sets: 1, reps: '5min',  rest: 0,  note: 'Círculos + passadas laterais + rotação interna/externa' },
      { id: 'fx_6', icon: 'repeat',   name: 'Alongamento Global',    sets: 1, reps: '10min', rest: 0,  note: 'Ombros · isquio · quadril · cadeia posterior · respiração profunda' },
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
      { id: 'c1', icon: 'timer',    name: 'Aquecimento Ativo',   sets: 1, reps: '5min',      note: 'Mobilidade articular + caminhada acelerada · prepara o sistema cardiovascular', rest: 0 },
      { id: 'c2', icon: 'zap',      name: 'HIIT Tabata',         sets: 8, reps: '20s / 10s', note: '100% intensidade nos 20s · recuperação passiva nos 10s · burpee / agachamento / mountain climber', rest: 0 },
      { id: 'c3', icon: 'activity', name: 'Corrida / Esteira',   sets: 1, reps: '20min',     note: 'Zona 2 — FC ~65% · consegue falar frases curtas · queima de gordura + recuperação ativa', rest: 0 },
      { id: 'c4', icon: 'move',     name: 'Pular Corda / Steps', sets: 4, reps: '60s',       note: 'Ritmo constante · pausa 30s entre séries · coordenação + panturrilha + cardio', rest: 30 },
      { id: 'c5', icon: 'wind',     name: 'Bike / Elíptico',     sets: 1, reps: '15min',     note: 'Cadência constante · Zona 2 · baixo impacto · ótimo para dias após Legs', rest: 0 },
      { id: 'c6', icon: 'heart',    name: 'Desaquecimento',      sets: 1, reps: '5min',      note: 'Caminhar + respiração profunda + alongamento de cadeia posterior e panturrilha', rest: 0 },
    ],
  },
];
