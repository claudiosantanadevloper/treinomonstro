import { renderSharingan } from '../components/Sharingan.js';
import { delegate, createRipple } from '../utils/dom.js';
import { formatDate, formatDuration, formatVolume } from '../utils/format.js';
import { getLabels } from '../utils/labels.js';

/* ─── Frequência por grupo muscular ────────────────────────────────── */

const WORKOUT_MUSCLES = {
  '1': ['Peito', 'Ombros', 'Tríceps', 'Panturrilha'],
  '2': ['Quadríceps', 'Posterior', 'Panturrilha'],
  '3': ['Dorsal', 'Bíceps', 'Trapézio', 'Panturrilha'],
  '4': ['Ombros', 'Peito', 'Tríceps', 'Panturrilha'],
  '5': ['Posterior', 'Glúteo', 'Quadríceps', 'Panturrilha'],
  '6': ['Dorsal', 'Trapézio', 'Bíceps', 'Panturrilha'],
};

const MUSCLE_TARGET = {
  'Panturrilha': 6, 'Peito': 2, 'Ombros': 2, 'Tríceps': 2,
  'Dorsal': 2, 'Bíceps': 2, 'Trapézio': 2,
  'Quadríceps': 2, 'Posterior': 2, 'Glúteo': 1,
};

function renderMuscleFrequencyPanel(cycleDone = []) {
  if (!cycleDone.length) return '';

  const freq = {};
  cycleDone.forEach(wId => {
    (WORKOUT_MUSCLES[wId] ?? []).forEach(m => { freq[m] = (freq[m] ?? 0) + 1; });
  });
  if (!Object.keys(freq).length) return '';

  const rows = Object.entries(MUSCLE_TARGET).map(([muscle, target]) => {
    const count = freq[muscle] ?? 0;
    const pct   = Math.min(100, Math.round((count / target) * 100));
    const done  = count >= target;
    return `
      <div class="flex items-center gap-2">
        <span class="text-[8px] text-zinc-600 w-20 shrink-0 font-bold truncate">${muscle}</span>
        <div class="flex-1 h-1 bg-zinc-800/80 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500 ${done ? 'bg-green-600' : count > 0 ? 'bg-theme-primary/70' : ''}"
               style="width:${pct}%"></div>
        </div>
        <span class="text-[8px] font-mono w-7 text-right ${done ? 'text-green-500' : count > 0 ? 'text-zinc-500' : 'text-zinc-800'}">${count}/${target}</span>
      </div>`;
  });

  return `
    <div class="mt-3 pt-3 border-t border-zinc-800/50">
      <div class="text-[8px] font-black text-zinc-700 uppercase tracking-widest mb-2">Frequência · Ciclo Atual</div>
      <div class="space-y-1.5">${rows.join('')}</div>
    </div>`;
}

/* ─── Constantes ───────────────────────────────────────────────────── */

const EFFORT_CLS = {
  'fácil':    { badge: 'text-green-400 bg-green-900/20 border border-green-900/30', dot: 'bg-green-500' },
  'moderado': { badge: 'text-amber-400 bg-amber-900/20 border border-amber-900/30', dot: 'bg-amber-500' },
  'forte':    { badge: 'text-rose-400  bg-rose-900/20  border border-rose-900/30',  dot: 'bg-rose-500'  },
};
const EFFORT_LBL = { 'fácil': 'Fácil', 'moderado': 'Moderado', 'forte': 'Forte' };

/* ─── Resume banner ────────────────────────────────────────────────── */

function renderResumeBanner(workoutId, startTime, workouts) {
  const workout = workouts.find(w => w.id === workoutId);
  if (!workout) return '';
  const elapsed = Math.round((Date.now() - startTime) / 60000);

  return `
    <div class="ripple-target relative overflow-hidden rounded-2xl border border-theme-accent
                bg-gradient-to-r from-theme-dim to-black/60 p-4 cursor-pointer animate-zoom-in"
         data-action="resume-workout" data-workout-id="${workoutId}">
      <div class="absolute inset-0 bg-theme-primary/5 pointer-events-none"></div>
      <div class="flex items-center justify-between relative z-10">
        <div>
          <div class="text-[10px] font-bold text-theme-primary uppercase tracking-widest flex items-center gap-1.5 mb-1">
            <span class="w-2 h-2 bg-theme-primary rounded-full animate-pulse inline-block"></span>
            SESSÃO EM ANDAMENTO
          </div>
          <div class="font-black text-white text-base">${workout.title}</div>
          <div class="text-xs text-zinc-500 font-mono mt-0.5">${formatDuration(elapsed)} decorrido</div>
        </div>
        <div class="w-11 h-11 rounded-full bg-theme-primary/10 border border-theme-accent flex items-center justify-center shrink-0">
          <i data-lucide="zap" class="w-5 h-5 text-theme-primary"></i>
        </div>
      </div>
    </div>
  `;
}

/* ─── Render principal ─────────────────────────────────────────────── */

export function renderDashboard(state, workouts, protocols = [], templates = []) {
  const {
    cycleDone = [], history, theme, workoutStartTime, workoutId, cycleGoal = 6, weekPlan = {},
    cycleOrder = [], cyclePosition = 0, cardioHistory = [],
    weeklyCardioKmGoal = null, weeklyCardioMinGoal = null,
    hiddenSections = [],
  } = state;

  const todayPlan    = weekPlan[new Date().getDay()] ?? null;
  const L            = getLabels(state.appMode);
  const weekCount    = cycleDone.length;
  const muscWorkouts = workouts.filter(w => !w.isCardio);

  const resumeBanner = workoutStartTime && workoutId
    ? renderResumeBanner(workoutId, workoutStartTime, workouts)
    : '';

  const cycleLen    = cycleOrder.length;
  const nextWId     = cycleLen > 0 ? cycleOrder[cyclePosition] : null;
  const nextWorkout = nextWId ? workouts.find(w => w.id === nextWId) ?? null : null;

  // Dias consecutivos treinados (musculação + cardio) — para contexto nos cards Off/Flex
  const consecutiveDays = (() => {
    const allDates = new Set([
      ...(history      ?? []).map(h => h.date.slice(0, 10)),
      ...(cardioHistory ?? []).map(c => c.date.slice(0, 10)),
    ]);
    let count = 0;
    const d = new Date();
    // se não treinou hoje, começa a contar a partir de ontem
    if (!allDates.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 60; i++) {
      if (!allDates.has(d.toISOString().slice(0, 10))) break;
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  })();

  // Renderiza um slot do ciclo (barra + label)
  function renderSlot(wId, i) {
    const w         = wId ? workouts.find(x => x.id === wId) : null;
    const isCurrent = i === cyclePosition;
    const isPast    = i < cyclePosition;
    const isOff     = wId === null;
    const isFlex    = w?.isFlexDay === true;
    const barColor  = isPast
      ? isOff ? 'bg-zinc-700' : 'bg-green-600'
      : isCurrent
      ? isOff
        ? 'bg-zinc-500 shadow-[0_0_6px_rgba(113,113,122,0.4)]'
        : isFlex
        ? 'bg-cyan-500 shadow-[0_0_6px_rgba(34,211,238,0.5)]'
        : 'bg-theme-primary shadow-[0_0_6px_var(--theme-primary)]'
      : isOff
      ? 'bg-zinc-800/40'
      : isFlex
      ? 'bg-cyan-900/50'
      : 'bg-zinc-800';
    const labelColor = isCurrent
      ? isOff ? 'text-zinc-400 font-bold' : isFlex ? 'text-cyan-400 font-bold' : 'text-theme-primary font-bold'
      : isPast
      ? isOff ? 'text-zinc-600' : 'text-green-600'
      : isOff ? 'text-zinc-800'
      : isFlex ? 'text-cyan-900/80'
      : 'text-zinc-700';
    const shortLabel = isOff ? 'OFF' : isFlex ? 'FLEX' : (w?.label ?? `T${i + 1}`);
    return `
      <div class="flex-1 flex flex-col items-center gap-0.5 min-w-0">
        <div class="w-full h-1.5 rounded-full transition-all duration-500 ${barColor}${isCurrent ? ' animate-pulse' : ''}"></div>
        <span class="text-[7px] font-mono ${labelColor} truncate w-full text-center leading-tight mt-0.5">
          ${shortLabel}
        </span>
      </div>`;
  }

  // Layout A/B (2 linhas) quando ciclo tem 6 treinos com um null no meio como separador
  const muscleSlots = cycleOrder.filter(id => id !== null && id !== 'flex');
  const midNullIdx  = cycleOrder.reduce((found, id, i) =>
    found === -1 && id === null && i > 0 && i < cycleLen - 1 ? i : found, -1);
  const useABLayout = muscleSlots.length === 6 && midNullIdx > 0;
  const half        = useABLayout ? midNullIdx + 1 : 0; // inclui o null do meio na linha A

  const cycleSlots = cycleLen > 0
    ? useABLayout
      ? `
        <div class="space-y-1.5">
          <div class="flex items-center gap-1.5">
            <span class="text-[8px] font-black text-zinc-700 uppercase tracking-widest w-3 shrink-0">A</span>
            <div class="flex gap-1.5 flex-1">${cycleOrder.slice(0, half).map((id, i) => renderSlot(id, i)).join('')}</div>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-[8px] font-black text-zinc-700 uppercase tracking-widest w-3 shrink-0">B</span>
            <div class="flex gap-1.5 flex-1">${cycleOrder.slice(half).map((id, i) => renderSlot(id, half + i)).join('')}</div>
          </div>
        </div>`
      : `<div class="flex gap-1.5">${cycleOrder.map((id, i) => renderSlot(id, i)).join('')}</div>`
    : '';

  return `
    <div class="stagger-enter space-y-4 pb-4">

      ${resumeBanner}

      <!-- Ciclo Adaptativo -->
      <div class="glass-card p-4 rounded-2xl border border-theme-dim relative overflow-hidden">
        <div class="absolute right-0 top-0 p-3 opacity-10 rotate-12 pointer-events-none">
          ${renderSharingan('w-24 h-24', false, theme)}
        </div>
        <div class="relative z-10">
          <div class="flex justify-between items-center mb-2">
            <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">CICLO ADAPTATIVO</span>
            ${cycleLen > 0
              ? `<span class="text-[10px] font-mono text-zinc-600">${cyclePosition + 1}/${cycleLen}</span>`
              : ''}
          </div>
          ${cycleLen > 0 ? `
            <div class="mb-3">${cycleSlots}</div>
            ${renderMuscleFrequencyPanel(cycleDone)}
            <div class="flex items-center gap-2 mt-3 mb-3 bg-black/30 rounded-xl px-3 py-2 border ${nextWId === null ? 'border-zinc-800/40' : 'border-theme-dim/40'}">
              <i data-lucide="${nextWId === null ? 'moon' : 'target'}" class="w-3.5 h-3.5 ${nextWId === null ? 'text-zinc-600' : 'text-theme-primary'} shrink-0"></i>
              <div class="min-w-0 flex-1">
                <div class="text-[9px] text-zinc-600 uppercase tracking-wider leading-none mb-0.5">PRÓXIMO</div>
                <div class="text-sm font-black ${nextWId === null ? 'text-zinc-500' : 'text-theme-primary'} leading-tight truncate">
                  ${nextWId === null ? 'Descanso' : nextWorkout ? nextWorkout.label : '—'}
                </div>
                <div class="text-[9px] text-zinc-500 truncate">
                  ${nextWId === null ? 'Recuperação programada' : nextWorkout ? nextWorkout.subtitle : ''}
                </div>
              </div>
            </div>
          ` : ''}
          <div class="flex gap-2">
            <button data-action="open-cycle-modal"
                    class="ripple-target flex-1 py-2.5 rounded-xl bg-theme-dark/60 border border-theme-accent/30 text-xs text-theme-primary
                           font-bold transition-all uppercase flex items-center justify-center gap-2 active:scale-[0.98]">
              <i data-lucide="layers" class="w-3 h-3"></i> Ver Ciclo
            </button>
            <button data-action="open-workout-picker"
                    class="ripple-target flex-1 py-2.5 rounded-xl bg-black/40 border border-zinc-800 text-xs text-zinc-400
                           font-bold transition-all uppercase flex items-center justify-center gap-2 active:scale-[0.98]">
              <i data-lucide="list" class="w-3 h-3"></i> Escolher
            </button>
            <button data-action="start-new-week"
                    class="ripple-target px-3 py-2.5 rounded-xl bg-black/40 border border-zinc-800 text-xs text-zinc-500
                           font-bold transition-all uppercase flex items-center justify-center gap-2 active:scale-[0.98]">
              <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Seção: Musculação -->
      <div>
        <div class="flex items-center gap-2 mb-3 px-1">
          <i data-lucide="dumbbell" class="w-3.5 h-3.5 text-zinc-600"></i>
          <span class="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Musculação</span>
        </div>
        ${muscWorkouts.length === 0 ? `
        <div class="glass-card p-6 rounded-2xl border border-zinc-800/60 text-center">
          <i data-lucide="dumbbell" class="w-10 h-10 text-zinc-700 mx-auto mb-3"></i>
          <h3 class="text-sm font-black text-white uppercase mb-1">Nenhum treino ainda</h3>
          <p class="text-[10px] text-zinc-500 font-mono mb-5">Crie seu primeiro treino para começar a registrar sua evolução</p>
          <button data-action="new-workout" data-payload=""
                  class="ripple-target btn-akatsuki px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all inline-flex items-center gap-2">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            Criar treino
          </button>
        </div>` : `
        <div class="space-y-3">
          ${nextWId === null
            ? renderOffDayCard(0, true, consecutiveDays, weekCount)
            : ''}
          ${muscWorkouts.map((w, i) =>
            w.isFlexDay
              ? renderFlexCard(w, cycleDone, i + (nextWId === null ? 1 : 0), nextWId, consecutiveDays)
              : renderWorkoutCard(w, cycleDone, history, i + (nextWId === null ? 1 : 0), todayPlan, nextWId)
          ).join('')}
        </div>`}
      </div>

      <!-- Seção: Cardio -->
      ${protocols.length > 0 ? renderCardioSection(protocols, cardioHistory, weeklyCardioKmGoal, weeklyCardioMinGoal) : ''}

      <!-- Seção: Programas Prontos (templates built-in, visível quando user tem programa próprio) -->
      ${templates.length > 0 ? renderTemplatesSection(templates, cycleDone, history, todayPlan, nextWId, hiddenSections) : ''}

      <!-- Novo Treino -->
      <button data-action="new-workout"
              class="ripple-target w-full py-3.5 rounded-2xl border border-dashed border-zinc-700
                     text-zinc-500 text-xs font-black uppercase tracking-widest
                     flex items-center justify-center gap-2 active:scale-[0.98] transition-all
                     hover:border-theme-accent hover:text-theme-primary hover:bg-theme-dim/40 mb-4">
        <i data-lucide="plus-circle" class="w-4 h-4"></i> Novo Treino
      </button>

    </div>
  `;
}

/* ─── Seção Templates (programas prontos) ───────────────────────────── */

function renderTemplatesSection(templates, cycleDone, history, todayPlan, nextWId, hiddenSections) {
  const collapsed = hiddenSections.includes('program-templates');
  const muscTemplates = templates.filter(w => !w.isFlexDay && !w.isCardio);
  if (!muscTemplates.length) return '';

  return `
    <div>
      <button data-action="toggle-section" data-section-id="program-templates"
              class="ripple-target w-full flex items-center justify-between gap-2 py-2.5 px-1
                     text-[10px] font-bold text-zinc-600 uppercase tracking-widest
                     hover:text-zinc-400 transition-all active:scale-[0.98]">
        <span class="flex items-center gap-2">
          <i data-lucide="layers" class="w-3.5 h-3.5"></i>
          Programas Prontos
          <span class="bg-zinc-800 border border-zinc-700 text-zinc-500 text-[8px] font-mono px-1.5 py-0.5 rounded">
            ${muscTemplates.length} treinos
          </span>
        </span>
        <i data-lucide="${collapsed ? 'chevron-down' : 'chevron-up'}" class="w-3.5 h-3.5 transition-transform"></i>
      </button>
      ${!collapsed ? `
        <div class="space-y-3 mt-1">
          <p class="text-[9px] text-zinc-700 font-mono px-1 pb-1 border-b border-zinc-800/50">
            Treinos built-in do app · use como referência ou inicie direto
          </p>
          ${muscTemplates.map((w, i) =>
            renderWorkoutCard(w, cycleDone, history, i, todayPlan, nextWId)
          ).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/* ─── Seção Cardio ──────────────────────────────────────────────────── */

function renderCardioSection(protocols, cardioHistory, weeklyKmGoal, weeklyMinGoal) {
  const WEEKMS   = 7 * 24 * 3600 * 1000;
  const thisWeek = cardioHistory.filter(c => Date.now() - new Date(c.date) <= WEEKMS);
  const weekKm   = thisWeek.reduce((s, c) => s + (c.distance || 0), 0);
  const weekMin  = thisWeek.reduce((s, c) => s + (c.duration || 0), 0);

  let goalBars = '';
  if (weeklyKmGoal || weeklyMinGoal) {
    const bars = [];
    if (weeklyKmGoal) {
      const pct  = Math.min(100, (weekKm / weeklyKmGoal) * 100);
      const done = pct >= 100;
      bars.push(`
        <div>
          <div class="flex justify-between items-center mb-1">
            <span class="text-[9px] text-zinc-600 uppercase tracking-wide">km/sem</span>
            <span class="text-[9px] font-mono ${done ? 'text-green-400' : 'text-theme-primary'}">${weekKm.toFixed(1)} / ${weeklyKmGoal}km</span>
          </div>
          <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-700 ${done ? 'bg-green-500' : 'bg-theme-primary'}"
                 style="width:${pct.toFixed(1)}%"></div>
          </div>
        </div>`);
    }
    if (weeklyMinGoal) {
      const pct  = Math.min(100, (weekMin / weeklyMinGoal) * 100);
      const done = pct >= 100;
      bars.push(`
        <div>
          <div class="flex justify-between items-center mb-1">
            <span class="text-[9px] text-zinc-600 uppercase tracking-wide">min/sem</span>
            <span class="text-[9px] font-mono ${done ? 'text-green-400' : 'text-theme-primary'}">${Math.round(weekMin)} / ${weeklyMinGoal}min</span>
          </div>
          <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-700 ${done ? 'bg-green-500' : 'bg-theme-primary'}"
                 style="width:${pct.toFixed(1)}%"></div>
          </div>
        </div>`);
    }
    goalBars = `<div class="mb-3 space-y-2">${bars.join('')}</div>`;
  }

  const cards = protocols.map((p, i) =>
    renderProtocolCard(p, cardioHistory, i)
  ).join('');

  return `
    <div>
      <div class="flex items-center justify-between mb-3 px-1">
        <div class="flex items-center gap-2">
          <i data-lucide="activity" class="w-3.5 h-3.5 text-zinc-600"></i>
          <span class="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Cardio</span>
          ${thisWeek.length > 0 ? `
            <span class="text-[9px] font-mono text-zinc-700">${thisWeek.length} sess. essa semana</span>
          ` : ''}
        </div>
        <button data-action="open-cardio-log"
                class="ripple-target flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                       bg-zinc-800/80 border border-zinc-700 text-zinc-400
                       text-[9px] font-black uppercase tracking-wider active:scale-90 transition-all">
          <i data-lucide="plus" class="w-3 h-3"></i> Log Manual
        </button>
      </div>
      ${goalBars}
      <div class="space-y-2.5">
        ${cards}
      </div>
    </div>
  `;
}

/* ─── Card de protocolo ────────────────────────────────────────────── */

function renderProtocolCard(protocol, cardioHistory, idx) {
  const effort   = protocol.effort ?? 'moderado';
  const efCls    = EFFORT_CLS[effort]?.badge ?? '';
  const efLbl    = EFFORT_LBL[effort] ?? effort;
  const durMin   = protocol.totalDuration > 0
    ? Math.round(protocol.totalDuration / 60)
    : null;
  const blockCount = protocol.blocks.length;

  // Última execução deste protocolo
  const last = cardioHistory.find(c => c.protocolId === protocol.id) ?? null;
  let lastRow = '';
  if (last) {
    const daysAgo  = Math.floor((Date.now() - new Date(last.date)) / 86400000);
    const dayLabel = daysAgo === 0 ? 'Hoje' : daysAgo === 1 ? 'Ontem' : `há ${daysAgo}d`;
    lastRow = `
      <div class="mt-2 pt-2 border-t border-zinc-800/60 flex items-center gap-2 text-[9px] font-mono text-zinc-600 flex-wrap">
        <span>${dayLabel}</span>
        ${last.distance ? `<span class="text-zinc-700">·</span><span>${last.distance}km</span>` : ''}
        ${last.pace ? `<span class="text-zinc-700">·</span><span class="text-theme-primary/80">${last.pace}/km</span>` : ''}
        ${!last.pace && last.duration ? `<span class="text-zinc-700">·</span><span>${Math.round(last.duration)}min</span>` : ''}
      </div>`;
  }

  return `
    <div class="stagger-enter ripple-target group border border-zinc-800 bg-zinc-900/80
                hover:border-theme-accent/50 rounded-xl p-4 transition-all active:scale-[0.98] cursor-pointer"
         style="animation-delay:${idx * 40}ms"
         data-action="start-cardio-protocol"
         data-protocol-id="${protocol.id}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">
            <span class="text-[9px] font-bold px-2 py-0.5 rounded ${efCls}">${efLbl}</span>
            ${durMin ? `
              <span class="text-[9px] font-mono text-zinc-600 flex items-center gap-1">
                <i data-lucide="clock" class="w-2.5 h-2.5"></i> ${durMin} min
              </span>` : `
              <span class="text-[9px] font-mono text-zinc-600">Sem duração fixa</span>`}
          </div>
          <h3 class="font-black text-base text-white group-hover:text-theme-primary transition-colors leading-tight">
            ${protocol.name}
          </h3>
          <p class="text-xs text-zinc-500 mt-0.5">${protocol.description}</p>
          <p class="text-[9px] text-zinc-700 font-mono mt-1">
            ${blockCount} bloco${blockCount !== 1 ? 's' : ''}
            ${protocol.blocks.slice(0, 3).map(b => b.name).join(' · ')}${blockCount > 3 ? ' · …' : ''}
          </p>
          ${lastRow}
        </div>
        <div class="w-11 h-11 rounded-full bg-theme-dim border border-theme-dim
                    group-hover:border-theme-accent group-hover:shadow-[0_0_15px_var(--theme-dim)]
                    flex items-center justify-center shrink-0 transition-all mt-0.5">
          <i data-lucide="zap" class="w-5 h-5 text-theme-primary"></i>
        </div>
      </div>
    </div>
  `;
}

/* ─── Off day card ──────────────────────────────────────────────────── */

function renderOffDayCard(idx, isCycleNext, consecutiveDays = 0, cycleDoneCount = 0) {
  const ctxNote = consecutiveDays >= 3
    ? `${consecutiveDays} dias seguidos de treino · descanso bem merecido`
    : consecutiveDays === 2
    ? `2 dias seguidos · recuperação ativa recomendada`
    : consecutiveDays === 1
    ? `1 dia de treino · aproveite para recuperar`
    : cycleDoneCount > 0
    ? `${cycleDoneCount} treino${cycleDoneCount !== 1 ? 's' : ''} no ciclo`
    : 'Parte do protocolo de recuperação';

  return `
    <div class="stagger-enter border border-zinc-800/50 bg-zinc-900/20 p-4 rounded-xl"
         style="animation-delay:${idx * 50}ms">
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">
            <span class="text-[10px] font-mono bg-black/50 border border-zinc-800 px-2 py-0.5 rounded text-zinc-600 uppercase tracking-wide">
              OFF
            </span>
            ${isCycleNext ? `
              <span class="text-[10px] font-bold text-zinc-500 flex items-center gap-1 bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-700/60">
                <i data-lucide="moon" class="w-3 h-3"></i> PRÓXIMO
              </span>` : ''}
          </div>
          <h3 class="font-bold text-base text-zinc-500 leading-tight">DIA DE DESCANSO</h3>
          <p class="text-xs text-zinc-700 font-medium">Recuperação programada · parte do protocolo</p>
          <p class="text-[9px] text-zinc-600 font-mono mt-1">${ctxNote}</p>
        </div>
        <i data-lucide="moon" class="w-5 h-5 text-zinc-800 shrink-0 mt-0.5 ml-3"></i>
      </div>
      ${isCycleNext ? `
        <div class="mt-3.5 space-y-2">
          <button data-action="register-off-day"
                  class="ripple-target w-full py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60
                         text-[10px] text-zinc-500 font-black uppercase tracking-wide
                         hover:border-zinc-700 hover:text-zinc-400 transition-all active:scale-[0.98]
                         flex items-center justify-center gap-1.5">
            <i data-lucide="check" class="w-3 h-3"></i> Confirmar Descanso
          </button>
          <button data-action="open-workout-picker"
                  class="ripple-target w-full py-2 rounded-xl border border-zinc-800/40
                         text-[9px] text-zinc-600 font-bold
                         hover:text-zinc-400 transition-all active:scale-[0.98]">
            Treinar mesmo assim →
          </button>
        </div>` : ''}
    </div>
  `;
}

/* ─── Flex day card ─────────────────────────────────────────────────── */

function renderFlexCard(w, cycleDone, idx, cycleNextId, consecutiveDays = 0) {
  const done        = cycleDone.includes(w.id);
  const isCycleNext = cycleNextId === w.id;

  return `
    <div class="stagger-enter border
                ${done
                  ? 'border-zinc-800 bg-zinc-900/40 opacity-60 grayscale'
                  : isCycleNext
                  ? 'border-cyan-900/50 bg-cyan-950/20'
                  : 'border-zinc-800/70 bg-zinc-900/30'}
                p-4 rounded-xl transition-all"
         style="animation-delay:${idx * 50}ms">
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">
            <span class="text-[10px] font-mono bg-black/50 border border-cyan-900/30 px-2 py-0.5 rounded text-cyan-700 uppercase tracking-wide">
              ${w.label}
            </span>
            ${isCycleNext && !done ? `
              <span class="text-[10px] font-bold text-cyan-400 flex items-center gap-1 bg-cyan-900/20 px-2 py-0.5 rounded border border-cyan-800/40">
                <i data-lucide="target" class="w-3 h-3"></i> PRÓXIMO
              </span>` : ''}
            ${done ? `
              <span class="text-[10px] font-bold text-green-500 flex items-center gap-1 bg-green-900/10 px-2 py-0.5 rounded border border-green-900/20">
                <i data-lucide="check" class="w-3 h-3"></i> FEITO
              </span>` : ''}
          </div>
          <h3 class="font-bold text-base text-white leading-tight">${w.title}</h3>
          <p class="text-xs text-zinc-500 font-medium">${w.subtitle}</p>
          <p class="text-[9px] text-cyan-800/70 font-mono mt-1">
            ${consecutiveDays >= 3
              ? `${consecutiveDays} dias seguidos · descanso é uma opção válida`
              : consecutiveDays === 2
              ? `2 dias seguidos · Core leve ou descanse`
              : 'Tudo opcional — faça o que fizer sentido hoje'}
          </p>
        </div>
        <i data-lucide="wind" class="w-6 h-6 text-cyan-900/60 shrink-0 mt-0.5 ml-2"></i>
      </div>
      ${!done ? `
        <div class="flex gap-2 mt-3.5">
          <button data-action="start-workout" data-workout-id="${w.id}"
                  class="ripple-target flex-1 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60
                         text-[10px] text-zinc-400 font-black uppercase tracking-wide
                         hover:border-zinc-700 hover:text-zinc-300 transition-all active:scale-[0.98]
                         flex items-center justify-center gap-1.5">
            <i data-lucide="dumbbell" class="w-3 h-3"></i> Core
          </button>
          <button data-action="goto-tab" data-payload="cardio"
                  class="ripple-target flex-1 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60
                         text-[10px] text-zinc-400 font-black uppercase tracking-wide
                         hover:border-cyan-900/50 hover:text-cyan-400 transition-all active:scale-[0.98]
                         flex items-center justify-center gap-1.5">
            <i data-lucide="wind" class="w-3 h-3"></i> Cardio
          </button>
          <button data-action="skip-flex-day"
                  class="ripple-target flex-1 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60
                         text-[10px] text-zinc-400 font-black uppercase tracking-wide
                         hover:border-zinc-700/50 hover:text-zinc-400 transition-all active:scale-[0.98]
                         flex items-center justify-center gap-1.5">
            <i data-lucide="moon" class="w-3 h-3"></i> Descansar
          </button>
        </div>` : ''}
    </div>
  `;
}

/* ─── Workout card ─────────────────────────────────────────────────── */

function renderWorkoutCard(w, cycleDone, history, idx, todayPlan = null, cycleNextId = null) {
  const done        = cycleDone.includes(w.id);
  const isScheduled = todayPlan === w.id;
  const isCycleNext = cycleNextId === w.id;
  const isHighlight = !done && (isScheduled || isCycleNext);
  const leadEx    = isCycleNext && !done ? (w.exercises?.find(e => !e.warmup) ?? w.exercises?.[0])?.name ?? null : null;
  const last      = history.find(h => h.workoutId === w.id);
  const lastDate  = last ? formatDate(last.date) : null;
  const lastVol   = last ? `${(last.vol / 1000).toFixed(1)}t` : null;

  // Tendência: compara as 2 últimas sessões deste treino
  let trendHtml = '';
  const sessions = history.filter(h => h.workoutId === w.id);
  if (sessions.length >= 2) {
    const vNew = sessions[0].vol ?? 0;
    const vOld = sessions[1].vol ?? 0;
    if (vOld > 0) {
      const pct = Math.round((vNew - vOld) / vOld * 100);
      if (pct >= 3) {
        trendHtml = `<span class="text-zinc-700">·</span><span class="text-green-400 font-bold">↑ +${pct}%</span>`;
      } else if (pct <= -3) {
        trendHtml = `<span class="text-zinc-700">·</span><span class="text-rose-400 font-bold">↓ ${pct}%</span>`;
      } else {
        trendHtml = `<span class="text-zinc-700">·</span><span class="text-zinc-600">→</span>`;
      }
    }
  }

  return `
    <div
      class="stagger-enter group border
             ${done
               ? 'border-zinc-800 bg-zinc-900/40 opacity-60 grayscale'
               : isHighlight
               ? 'ripple-target border-theme-accent bg-zinc-900/80 cursor-pointer shadow-[0_0_12px_var(--theme-dim)] active:scale-[0.98]'
               : 'ripple-target border-zinc-800 bg-zinc-900/80 hover:border-theme-accent cursor-pointer active:scale-[0.98]'}
             p-4 rounded-xl transition-all"
      style="animation-delay:${idx * 50}ms"
      data-action="${done ? '' : 'start-workout'}"
      data-workout-id="${w.id}"
    >
      <div class="flex justify-between items-center">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="text-[10px] font-mono bg-black/50 border border-zinc-800 px-2 py-0.5 rounded text-zinc-400 uppercase tracking-wide">
              ${w.label}
            </span>
            ${isScheduled
              ? `<span class="text-[10px] font-bold text-theme-primary flex items-center gap-1 bg-theme-dim px-2 py-0.5 rounded border border-theme-accent ${done ? '' : 'animate-pulse'}">
                   <i data-lucide="calendar" class="w-3 h-3"></i> HOJE
                 </span>`
              : ''}
            ${isCycleNext && !isScheduled
              ? `<span class="text-[10px] font-bold text-theme-primary flex items-center gap-1 bg-theme-dim px-2 py-0.5 rounded border border-theme-accent ${done ? '' : 'animate-pulse'}">
                   <i data-lucide="target" class="w-3 h-3"></i> PRÓXIMO
                 </span>`
              : ''}
            ${done
              ? `<span class="text-[10px] font-bold text-green-500 flex items-center gap-1 bg-green-900/10 px-2 py-0.5 rounded border border-green-900/20">
                   <i data-lucide="check" class="w-3 h-3"></i> FEITO
                 </span>`
              : ''}
          </div>
          <h3 class="font-bold text-base text-white group-hover:text-theme-primary transition-colors leading-tight">
            ${w.title}
          </h3>
          <p class="text-xs text-zinc-500 font-medium">${w.subtitle}</p>
          <p class="text-[10px] text-zinc-700 font-mono mt-0.5">
            ${w.exercises?.length ?? 0} exercício${(w.exercises?.length ?? 0) !== 1 ? 's' : ''}
          </p>
          ${leadEx ? `<p class="text-[9px] text-theme-primary/60 font-mono mt-0.5 flex items-center gap-1"><i data-lucide="zap" class="w-2.5 h-2.5"></i>${leadEx}</p>` : ''}
          ${lastDate
            ? `<p class="text-[10px] text-zinc-600 font-mono mt-1 flex items-center gap-1.5 flex-wrap">
                 <i data-lucide="clock" class="w-3 h-3"></i>
                 ${lastDate}
                 ${lastVol ? `<span class="text-zinc-700">·</span><span class="text-theme-primary/60">${lastVol}</span>` : ''}
                 ${trendHtml}
               </p>`
            : ''}
        </div>
        <div class="flex items-center gap-1 shrink-0 ml-2">
          <button data-action="show-workout-history" data-workout-id="${w.id}"
                  title="Ver histórico"
                  class="flex items-center gap-1 px-2 py-2.5 min-h-[40px] rounded-lg text-zinc-600
                         hover:text-theme-primary hover:bg-theme-dim transition-all z-20">
            <i data-lucide="history" class="w-3.5 h-3.5 shrink-0"></i>
            <span class="text-[9px] font-bold uppercase tracking-wider">Hist.</span>
          </button>
          <button data-action="edit-workout" data-workout-id="${w.id}"
                  title="Editar treino"
                  class="flex items-center gap-1 px-2 py-2.5 min-h-[40px] rounded-lg text-zinc-600
                         hover:text-theme-primary hover:bg-theme-dim transition-all z-20">
            <i data-lucide="pencil" class="w-3.5 h-3.5 shrink-0"></i>
            <span class="text-[9px] font-bold uppercase tracking-wider">Editar</span>
          </button>
          ${done
            ? `<button data-action="undo-mission" data-workout-id="${w.id}"
                       class="w-10 h-10 rounded-full flex items-center justify-center text-zinc-600
                              hover:text-theme-primary hover:bg-theme-dim transition-all z-20">
                 <i data-lucide="x" class="w-5 h-5"></i>
               </button>`
            : `<div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700
                           group-hover:border-theme-accent group-hover:text-theme-primary
                           group-hover:shadow-[0_0_15px_var(--theme-dim)] transition-all">
                 <i data-lucide="chevron-right" class="w-5 h-5"></i>
               </div>`}
        </div>
      </div>
    </div>
  `;
}

/* ─── Event mounting ───────────────────────────────────────────────── */

export function mountDashboard(container, handler) {
  delegate(container, '[data-action="start-workout"]', 'click', (e, el) => {
    const innerAction = e.target.closest('[data-action]')?.dataset.action;
    if (innerAction && innerAction !== 'start-workout') return;
    createRipple(e, el);
    handler('start-workout', el.dataset.workoutId);
  });

  delegate(container, '[data-action="resume-workout"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('resume-workout', el.dataset.workoutId);
  });

  delegate(container, '[data-action="undo-mission"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('undo-mission', el.dataset.workoutId);
  });

  delegate(container, '[data-action="start-new-week"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('start-new-week');
  });

  delegate(container, '[data-action="open-cycle-modal"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('open-cycle-modal');
  });

  delegate(container, '[data-action="open-workout-picker"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('open-workout-picker');
  });

  delegate(container, '[data-action="register-off-day"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('register-off-day');
  });

  delegate(container, '[data-action="new-workout"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('new-workout');
  });

  delegate(container, '[data-action="edit-workout"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('edit-workout', el.dataset.workoutId);
  });

  delegate(container, '[data-action="show-workout-history"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('show-workout-history', el.dataset.workoutId);
  });

  delegate(container, '[data-action="open-cardio-log"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('open-cardio-log');
  });

  delegate(container, '[data-action="start-cardio-protocol"]', 'click', (e, el) => {
    const inner = e.target.closest('[data-action]')?.dataset.action;
    if (inner && inner !== 'start-cardio-protocol') return;
    createRipple(e, el);
    handler('start-cardio-protocol', el.dataset.protocolId);
  });

  delegate(container, '[data-action="skip-flex-day"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('skip-flex-day');
  });

  delegate(container, '[data-action="goto-tab"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('goto-tab', el.dataset.payload);
  });

  delegate(container, '[data-action="toggle-section"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('toggle-section', el.dataset.sectionId);
  });

  delegate(container, '[data-action="import-pdf"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('import-pdf');
  });
}
