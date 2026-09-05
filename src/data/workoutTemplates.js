/**
 * Templates de divisão de treino para o onboarding.
 * Cada split gera customWorkouts + cycleOrder prontos para uso.
 */

// ─── Banco de exercícios por posição de template ───────────────────────

const EX = {
  // PEITO
  supino_halter:    { icon:'dumbbell',  name:'Supino Reto (Halter)',             sets:3, reps:'8-12',  rest:90  },
  supino_inclin:    { icon:'dumbbell',  name:'Supino Inclinado (Halter)',         sets:3, reps:'8-12',  rest:90  },
  peck_deck:        { icon:'layers',    name:'Peck Deck',                         sets:3, reps:'12-15', rest:60  },
  cross_over:       { icon:'layers',    name:'Cross Over',                        sets:3, reps:'12-15', rest:60  },

  // OMBROS
  desenv_halter:    { icon:'dumbbell',  name:'Desenvolvimento com Halteres',      sets:3, reps:'10-12', rest:90  },
  elev_lateral:     { icon:'dumbbell',  name:'Elevação Lateral (Halter)',          sets:4, reps:'12-15', rest:60  },
  elev_lat_maq:     { icon:'layers',    name:'Elevação Lateral na Máquina',        sets:3, reps:'12-15', rest:60  },
  face_pull:        { icon:'crosshair', name:'Face Pull',                          sets:3, reps:'12-15', rest:60  },
  cruc_inv:         { icon:'layers',    name:'Crucifixo Inverso Máquina',          sets:3, reps:'12-15', rest:60  },

  // TRÍCEPS
  triceps_pulley:   { icon:'activity',  name:'Tríceps Pulley',                    sets:3, reps:'10-12', rest:60  },
  triceps_testa:    { icon:'activity',  name:'Tríceps Testa no Cabo',             sets:3, reps:'8-10',  rest:60  },
  triceps_corda:    { icon:'activity',  name:'Tríceps Corda',                     sets:3, reps:'12-15', rest:60  },

  // COSTAS
  puxada_frente:    { icon:'layers',    name:'Puxada Frente Pronada',             sets:4, reps:'8-12',  rest:90  },
  remada_curv:      { icon:'dumbbell',  name:'Remada Curvada Pronada',            sets:3, reps:'8-10',  rest:90  },
  remada_uni:       { icon:'dumbbell',  name:'Remada Unilateral Articulada',      sets:3, reps:'8-10',  rest:90  },
  pullover_polia:   { icon:'activity',  name:'Pullover na Polia',                 sets:3, reps:'12-15', rest:60  },

  // BÍCEPS
  rosca_direta:     { icon:'dumbbell',  name:'Rosca Direta (Barra W)',            sets:3, reps:'8-12',  rest:60  },
  rosca_alternada:  { icon:'dumbbell',  name:'Rosca Alternada (Halter)',          sets:3, reps:'10-12', rest:60  },
  rosca_martelo:    { icon:'dumbbell',  name:'Rosca Martelo',                     sets:3, reps:'10-12', rest:60  },

  // QUADRÍCEPS
  agachamento:      { icon:'move',      name:'Agachamento Livre',                 sets:4, reps:'8-12',  rest:120 },
  leg_press:        { icon:'move',      name:'Leg Press 45°',                     sets:4, reps:'10-15', rest:120 },
  extensora:        { icon:'layers',    name:'Extensora Unilateral',              sets:3, reps:'12-15', rest:60  },

  // POSTERIOR / GLÚTEO
  stiff:            { icon:'dumbbell',  name:'Stiff (Halter)',                    sets:3, reps:'10-12', rest:90  },
  flexora:          { icon:'layers',    name:'Flexora Unilateral',                sets:3, reps:'10-12', rest:60  },
  hip_thrust:       { icon:'move',      name:'Hip Thrust',                        sets:3, reps:'12-15', rest:90  },

  // PANTURRILHA
  panturrilha_pe:   { icon:'move',      name:'Panturrilha em Pé (Máquina)',      sets:3, reps:'15-20', rest:45  },
  panturrilha_sent: { icon:'layers',    name:'Panturrilha Sentada',               sets:3, reps:'12-15', rest:45  },

  // CORE
  prancha:          { icon:'target',    name:'Prancha Ventral',                   sets:3, reps:'45s',   rest:45  },
  abdominal:        { icon:'target',    name:'Abdominal Remador',                 sets:3, reps:'15-20', rest:45  },
};

// ─── Definições dos splits ─────────────────────────────────────────────

export const SPLIT_TEMPLATES = {
  'full-body': {
    label:            'Full Body',
    icon:             'layers',
    desc:             'Corpo inteiro por sessão · 2-3×/sem',
    defaultCycleGoal: 3,
    workouts: [
      {
        label:       'Full Body',
        title:       'FULL BODY',
        subtitle:    'Corpo Inteiro',
        muscleFocus: ['Peito', 'Costas', 'Pernas', 'Ombros', 'Braços'],
        exKeys:      ['agachamento', 'supino_halter', 'puxada_frente', 'desenv_halter', 'rosca_alternada', 'triceps_pulley', 'prancha'],
      },
    ],
    cyclePattern: [0],
  },

  'abc': {
    label:            'ABC',
    icon:             'dumbbell',
    desc:             'Grupos antagonistas · 3×/sem',
    defaultCycleGoal: 3,
    workouts: [
      {
        label:       'Treino A',
        title:       'TREINO A',
        subtitle:    'Peito + Tríceps',
        muscleFocus: ['Peito', 'Braços'],
        exKeys:      ['supino_halter', 'supino_inclin', 'peck_deck', 'triceps_testa', 'triceps_pulley'],
      },
      {
        label:       'Treino B',
        title:       'TREINO B',
        subtitle:    'Costas + Bíceps',
        muscleFocus: ['Costas', 'Braços'],
        exKeys:      ['puxada_frente', 'remada_curv', 'remada_uni', 'rosca_direta', 'rosca_martelo'],
      },
      {
        label:       'Treino C',
        title:       'TREINO C',
        subtitle:    'Pernas + Ombros',
        muscleFocus: ['Pernas', 'Ombros'],
        exKeys:      ['agachamento', 'leg_press', 'stiff', 'extensora', 'desenv_halter', 'elev_lateral', 'panturrilha_pe'],
      },
    ],
    cyclePattern: [0, 1, 2],
  },

  'upper-lower': {
    label:            'Upper / Lower',
    icon:             'bar-chart-2',
    desc:             'Superior + Inferior · 4×/sem',
    defaultCycleGoal: 4,
    workouts: [
      {
        label:       'Upper',
        title:       'UPPER',
        subtitle:    'Superior',
        muscleFocus: ['Peito', 'Costas', 'Ombros', 'Braços'],
        exKeys:      ['supino_halter', 'puxada_frente', 'remada_curv', 'desenv_halter', 'elev_lateral', 'rosca_direta', 'triceps_pulley'],
      },
      {
        label:       'Lower',
        title:       'LOWER',
        subtitle:    'Inferior',
        muscleFocus: ['Pernas'],
        exKeys:      ['agachamento', 'leg_press', 'stiff', 'extensora', 'flexora', 'hip_thrust', 'panturrilha_pe'],
      },
    ],
    cyclePattern: [0, 1, 0, 1],
  },

  'ppl': {
    label:            'PPL',
    icon:             'repeat',
    desc:             'Push · Pull · Legs · 3-6×/sem',
    defaultCycleGoal: 6,
    workouts: [
      {
        label:       'Push',
        title:       'PUSH',
        subtitle:    'Peito + Ombros + Tríceps',
        muscleFocus: ['Peito', 'Ombros', 'Braços'],
        exKeys:      ['supino_halter', 'supino_inclin', 'peck_deck', 'desenv_halter', 'elev_lateral', 'cruc_inv', 'triceps_testa', 'triceps_pulley'],
      },
      {
        label:       'Pull',
        title:       'PULL',
        subtitle:    'Costas + Bíceps',
        muscleFocus: ['Costas', 'Braços'],
        exKeys:      ['puxada_frente', 'remada_curv', 'remada_uni', 'pullover_polia', 'face_pull', 'rosca_direta', 'rosca_alternada'],
      },
      {
        label:       'Legs',
        title:       'LEGS',
        subtitle:    'Pernas + Panturrilha',
        muscleFocus: ['Pernas'],
        exKeys:      ['agachamento', 'leg_press', 'stiff', 'extensora', 'flexora', 'hip_thrust', 'panturrilha_pe', 'panturrilha_sent', 'abdominal'],
      },
    ],
    cyclePattern: [0, 1, 2, 0, 1, 2],
  },

  'abcd': {
    label:            'ABCD',
    icon:             'calendar',
    desc:             '4 treinos · alta frequência',
    defaultCycleGoal: 4,
    workouts: [
      {
        label:       'Push A',
        title:       'PUSH A',
        subtitle:    'Peito + Ombros',
        muscleFocus: ['Peito', 'Ombros'],
        exKeys:      ['supino_halter', 'supino_inclin', 'peck_deck', 'desenv_halter', 'elev_lateral', 'elev_lat_maq'],
      },
      {
        label:       'Legs',
        title:       'LEGS',
        subtitle:    'Pernas',
        muscleFocus: ['Pernas'],
        exKeys:      ['agachamento', 'leg_press', 'stiff', 'extensora', 'flexora', 'hip_thrust', 'panturrilha_pe'],
      },
      {
        label:       'Pull',
        title:       'PULL',
        subtitle:    'Costas + Bíceps',
        muscleFocus: ['Costas', 'Braços'],
        exKeys:      ['puxada_frente', 'remada_curv', 'remada_uni', 'pullover_polia', 'rosca_direta', 'rosca_martelo'],
      },
      {
        label:       'Push B',
        title:       'PUSH B',
        subtitle:    'Ombros + Tríceps',
        muscleFocus: ['Ombros', 'Braços'],
        exKeys:      ['desenv_halter', 'elev_lateral', 'cruc_inv', 'face_pull', 'triceps_testa', 'triceps_corda'],
      },
    ],
    cyclePattern: [0, 1, 2, 3],
  },
};

// ─── Modificadores por objetivo ───────────────────────────────────────

const GOAL_MODIFIERS = {
  hipertrofia:     { repsLo: 8,  repsHi: 12, restMult: 1.0, setsDelta:  0 },
  forca:           { repsLo: 4,  repsHi: 6,  restMult: 2.0, setsDelta:  1 },
  emagrecimento:   { repsLo: 15, repsHi: 20, restMult: 0.6, setsDelta:  0 },
  condicionamento: { repsLo: 15, repsHi: 25, restMult: 0.4, setsDelta: -1 },
  recomposicao:    { repsLo: 10, repsHi: 15, restMult: 0.8, setsDelta:  0 },
};

function applyGoal(ex, goal) {
  const mod = GOAL_MODIFIERS[goal];
  if (!mod) return ex;
  if (typeof ex.reps === 'string' && ex.reps.includes('s')) return ex; // prancha, etc.
  const reps = mod.repsLo === mod.repsHi ? `${mod.repsLo}` : `${mod.repsLo}-${mod.repsHi}`;
  return {
    ...ex,
    reps,
    rest:  Math.max(30, Math.round((ex.rest ?? 60) * mod.restMult)),
    sets:  Math.max(1, (ex.sets ?? 3) + mod.setsDelta),
  };
}

// ─── Gerador ──────────────────────────────────────────────────────────

/**
 * Gera customWorkouts[] e cycleOrder[] a partir de um template de divisão.
 * goal (opcional): ajusta rep ranges e descanso conforme o objetivo do usuário.
 */
export function generateWorkoutsFromTemplate(splitKey, goal = null) {
  const template = SPLIT_TEMPLATES[splitKey];
  if (!template) return { workouts: [], cycleOrder: [], defaultCycleGoal: 4 };

  const ts   = Date.now();
  const rand = Math.random().toString(36).slice(2, 6);
  const workouts = template.workouts.map((wt, wi) => {
    const id = `custom_${ts}${rand}_${wi}`;
    const exercises = wt.exKeys.map((key, ei) => {
      const base = { ...EX[key], id: `tpl_${ts}${rand}_${wi}_${ei}` };
      return goal ? applyGoal(base, goal) : base;
    });
    return {
      id,
      label:       wt.label,
      title:       wt.title,
      subtitle:    wt.subtitle,
      muscleFocus: wt.muscleFocus,
      exercises,
      isCustom:    true,
    };
  });

  const cycleOrder = template.cyclePattern.map(i => workouts[i].id);

  return { workouts, cycleOrder, defaultCycleGoal: template.defaultCycleGoal };
}

export { GOAL_MODIFIERS };

/**
 * Retorna um resumo legível do split para preview no onboarding.
 * Cada item: { label, exNames: string[], exCount: number }
 */
export function getTemplateSummary(splitKey) {
  const template = SPLIT_TEMPLATES[splitKey];
  if (!template) return [];
  return template.workouts.map(wt => ({
    label:   wt.label,
    exNames: wt.exKeys.slice(0, 4).map(k => EX[k]?.name ?? k),
    exCount: wt.exKeys.length,
  }));
}
