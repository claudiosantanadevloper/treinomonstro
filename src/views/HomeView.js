import { renderSharingan } from '../components/Sharingan.js';
import { delegate, createRipple } from '../utils/dom.js';
import { formatDate, formatDuration, formatVolume } from '../utils/format.js';
import { getTimedQuote } from '../data/quotes.js';
import { getLabels } from '../utils/labels.js';
import { ACHIEVEMENT_MAP, ACHIEVEMENTS } from '../data/achievements.js';

/* ─── Helpers ──────────────────────────────────────────────────────── */

const DIAS  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function getNow(L) {
  const now = new Date();
  const h   = now.getHours();
  const min = String(now.getMinutes()).padStart(2, '0');
  const dia  = DIAS[now.getDay()];
  const data = `${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`;
  const hora = `${h}:${min}`;
  const period = h < 12
    ? { text: 'Bom dia',   icon: 'sun',  sub: L.greeting.morning }
    : h < 18
    ? { text: 'Boa tarde', icon: 'sun',  sub: L.greeting.afternoon }
    : { text: 'Boa noite', icon: 'moon', sub: L.greeting.night };
  return { hora, dia, data, ...period };
}


function localDateKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function isToday(dateStr) {
  return localDateKey(new Date(dateStr)) === localDateKey(new Date());
}

export function getStreak(history, cardioHistory = [], cardioCountsStreak = false) {
  const wDates = history.map(h => localDateKey(h.date));
  const cDates = cardioCountsStreak ? cardioHistory.map(c => localDateKey(c.date)) : [];
  const dates = new Set([...wDates, ...cDates]);
  if (!dates.size) return 0;
  const today = new Date();
  const startOffset = dates.has(localDateKey(today)) ? 0 : 1;
  let streak = 0;
  for (let i = startOffset; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (dates.has(localDateKey(d))) streak++;
    else break;
  }
  return streak;
}

function getChakraLevel(weekCount, goal, L) {
  const pct   = Math.min(100, Math.round(weekCount / goal * 100));
  const ratio = weekCount / goal;
  const C     = L.chakra;
  if (weekCount === 0) return { label: C.none, color: 'text-zinc-600', barColor: 'bg-zinc-700',       pct: 0  };
  if (ratio < 0.4)     return { label: C.low,  color: 'text-zinc-400', barColor: 'bg-zinc-500',       pct     };
  if (ratio < 0.7)     return { label: C.mid,  color: 'text-theme-primary', barColor: 'bg-theme-primary', pct };
  if (ratio < 1)       return { label: C.high, color: 'text-amber-400', barColor: 'bg-amber-400',     pct     };
  return                      { label: C.full, color: 'text-yellow-300', barColor: 'bg-yellow-300',   pct: 100 };
}

/* ─── Banners ──────────────────────────────────────────────────────── */

function renderCycleCompleteBanner(weekCount, cycleGoal) {
  if (weekCount < cycleGoal) return '';
  return `
    <div class="relative overflow-hidden rounded-2xl border border-green-700/60
                animate-zoom-in"
         style="background:linear-gradient(135deg,rgba(22,101,52,0.25),rgba(0,0,0,0.7))">
      <div class="absolute inset-0 pointer-events-none overflow-hidden">
        <div class="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-green-500/5 blur-2xl"></div>
      </div>
      <div class="relative z-10 px-4 py-4 flex items-center gap-4">
        <div class="w-12 h-12 rounded-full bg-green-900/40 border border-green-700/60
                    flex items-center justify-center shrink-0
                    shadow-[0_0_16px_rgba(74,222,128,0.2)]">
          <i data-lucide="trophy" class="w-6 h-6 text-green-400"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[10px] font-black text-green-500 uppercase tracking-widest mb-0.5">
            CICLO COMPLETO!
          </div>
          <div class="text-base font-black text-white leading-tight">
            ${weekCount}/${cycleGoal} missões concluídas
          </div>
          <div class="text-[10px] text-green-400/70 mt-0.5">
            Reinicie o ciclo para continuar progredindo
          </div>
        </div>
        <div class="flex flex-col gap-1.5 shrink-0">
          <button data-action="start-new-week"
                  class="ripple-target px-3 py-2 bg-green-900/40 border border-green-700/60
                         text-green-400 text-[10px] font-black rounded-xl uppercase tracking-wider
                         active:scale-95 transition-all hover:bg-green-800/40 whitespace-nowrap">
            Novo Ciclo
          </button>
          <button data-action="goto-tab" data-payload="treinar"
                  class="ripple-target px-3 py-1.5 bg-transparent border border-zinc-700/40
                         text-zinc-500 text-[9px] font-bold rounded-lg uppercase tracking-wider
                         active:scale-95 transition-all whitespace-nowrap">
            Ver Treinos
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderOnboardingBanner(history, cycleDone, L) {
  if (history.length > 0 || cycleDone.length > 0) return '';
  return `
    <div class="relative overflow-hidden rounded-2xl border border-theme-dim/50 p-4 animate-zoom-in"
         style="background:linear-gradient(135deg,rgba(var(--theme-rgb),0.08),transparent)">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-full bg-theme-dim border border-theme-accent/40
                    flex items-center justify-center shrink-0 mt-0.5">
          <i data-lucide="zap" class="w-5 h-5 text-theme-primary"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[10px] font-black text-theme-primary uppercase tracking-widest mb-0.5">
            BEM-VINDO
          </div>
          <div class="text-sm font-bold text-white leading-snug mb-1">
            Seu primeiro treino está esperando
          </div>
          <div class="text-[10px] text-zinc-500 leading-relaxed mb-2.5">
            Escolha um protocolo e comece a forjar seu poder.
          </div>
          <button data-action="goto-workouts"
                  class="ripple-target inline-flex items-center gap-1.5 px-4 py-2 btn-akatsuki
                         rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all">
            <i data-lucide="dumbbell" class="w-3.5 h-3.5"></i>
            Ir para Treinos
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderStaleWeekBanner(cycleDone, history, cardioHistory) {
  if (cycleDone.length === 0) return '';

  // Mede inatividade pela data da ÚLTIMA ATIVIDADE (musculação ou cardio)
  const allTimestamps = [
    ...(history     ?? []).map(h => new Date(h.date).getTime()),
    ...(cardioHistory ?? []).map(c => new Date(c.date).getTime()),
  ].filter(t => !isNaN(t));

  if (allTimestamps.length === 0) return '';

  const lastActivity = Math.max(...allTimestamps);
  const daysSince    = Math.floor((Date.now() - lastActivity) / 86400000);
  if (daysSince < 7) return '';

  return `
    <div class="relative overflow-hidden rounded-2xl border border-blue-800/50
                bg-gradient-to-r from-blue-950/60 to-black/60 p-4 animate-zoom-in">
      <div class="absolute inset-0 bg-blue-900/5 pointer-events-none"></div>
      <div class="flex items-center gap-3 relative z-10">
        <div class="w-10 h-10 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center shrink-0">
          <i data-lucide="calendar-days" class="w-5 h-5 text-blue-400"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Ciclo em Pausa</div>
          <div class="text-sm font-bold text-white">${daysSince} dias sem treinar · ${cycleDone.length} missão${cycleDone.length !== 1 ? 'ões' : ''} feita${cycleDone.length !== 1 ? 's' : ''}</div>
        </div>
        <button data-action="start-new-week"
                class="ripple-target shrink-0 px-3 py-1.5 bg-blue-900/30 border border-blue-800/50
                       text-blue-400 text-[10px] font-black rounded-lg uppercase tracking-wider active:scale-95">
          Novo Ciclo
        </button>
      </div>
    </div>
  `;
}

function renderStreakRisk(streak, history, cardioHistory, cardioCountsStreak, L, nextIsOff = false) {
  if (streak === 0) return '';
  if (nextIsOff) return '';   // Dia Off programado — streak está protegido, não alertar
  const todayKey = localDateKey(new Date());
  const trainedToday = history.some(h => localDateKey(h.date) === todayKey)
    || (cardioCountsStreak && cardioHistory.some(c => localDateKey(c.date) === todayKey));
  if (trainedToday) return '';
  return `
    <div class="relative overflow-hidden rounded-2xl border border-orange-800/60
                bg-gradient-to-r from-orange-950/60 to-black/60 p-4 animate-zoom-in">
      <div class="flex items-center gap-3 relative z-10">
        <div class="w-10 h-10 rounded-full bg-orange-900/30 border border-orange-800/50
                    flex items-center justify-center shrink-0">
          <i data-lucide="flame" class="w-5 h-5 text-orange-400 animate-pulse"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-0.5">
            ${L.streakLabel} em Risco
          </div>
          <div class="text-sm font-bold text-white">
            ${streak} dia${streak !== 1 ? 's' : ''} — treine hoje!
          </div>
        </div>
        <div class="flex flex-col items-end gap-1.5 shrink-0">
          <div class="text-2xl font-black font-mono text-orange-400">${streak}</div>
          <button data-action="goto-workouts"
                  class="ripple-target px-3 py-1.5 bg-orange-900/30 border border-orange-800/50
                         text-orange-400 text-[9px] font-black rounded-lg uppercase tracking-wider
                         active:scale-95 transition-all whitespace-nowrap">
            Treinar →
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderBioOverdueBanner(biometrics) {
  if (!biometrics?.date) return '';
  const daysSince = Math.floor((Date.now() - new Date(biometrics.date)) / 86400000);
  if (daysSince < 30) return '';
  return `
    <div class="relative overflow-hidden rounded-2xl border border-yellow-800/50
                bg-gradient-to-r from-yellow-950/60 to-black/60 p-4 animate-zoom-in">
      <div class="flex items-center gap-3 relative z-10">
        <div class="w-10 h-10 rounded-full bg-yellow-900/30 border border-yellow-800/50
                    flex items-center justify-center shrink-0">
          <i data-lucide="calendar-x" class="w-5 h-5 text-yellow-500"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-0.5">Avaliação Física Vencida</div>
          <div class="text-sm font-bold text-white">${daysSince} dias sem medição</div>
        </div>
        <button data-action="goto-profile"
                class="ripple-target shrink-0 px-3 py-1.5 bg-yellow-900/30 border border-yellow-800/50
                       text-yellow-400 text-[10px] font-black rounded-lg uppercase tracking-wider active:scale-95">
          Reavaliar
        </button>
      </div>
    </div>
  `;
}

function renderResumeBanner(workoutId, startTime, workouts) {
  const w = workouts.find(x => x.id === workoutId);
  if (!w) return '';
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
          <div class="font-black text-white text-base">${w.title}</div>
          <div class="text-xs text-zinc-500 font-mono mt-0.5">${formatDuration(elapsed)} decorrido</div>
        </div>
        <div class="w-11 h-11 rounded-full bg-theme-primary/10 border border-theme-accent flex items-center justify-center shrink-0">
          <i data-lucide="play" class="w-5 h-5 text-theme-primary"></i>
        </div>
      </div>
    </div>
  `;
}

/* ─── Missão de Hoje ───────────────────────────────────────────────── */

function renderMissionBlock(nextWorkout, cycleDone, history, defaultProtocol, cardioHistory, workoutStartTime, L, nextIsOff = false) {
  if (workoutStartTime) return ''; // resume banner já aparece acima

  const workoutDoneToday = nextWorkout && history.some(h => isToday(h.date) && h.workoutId === nextWorkout.id);
  const cardioDoneToday  = cardioHistory.some(c => isToday(c.date));

  // Bloco musculação
  let workoutRow;
  if (nextIsOff) {
    // Dia Off programado no ciclo
    workoutRow = `
      <div class="bg-zinc-900/40 rounded-xl px-3 py-3 border border-zinc-800/40">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="text-[9px] text-zinc-700 uppercase tracking-wider flex items-center gap-1 mb-0.5">
              <i data-lucide="moon" class="w-2.5 h-2.5"></i> DESCANSO
            </div>
            <div class="text-sm font-bold text-zinc-500">Dia Off programado</div>
            <div class="text-[9px] text-zinc-700 font-mono mt-0.5">Recuperação · Sono · Alimentação</div>
          </div>
          <button data-action="register-off-day"
                  class="ripple-target shrink-0 px-3 py-2 bg-zinc-800/60 border border-zinc-700
                         text-zinc-400 text-[10px] font-black rounded-xl active:scale-95 transition-all">
            Confirmar
          </button>
        </div>
        <button data-action="goto-workouts"
                class="ripple-target mt-2 w-full py-1.5 text-[9px] text-zinc-600 font-bold
                       border border-zinc-800/60 rounded-lg hover:text-zinc-400 active:scale-95 transition-all">
          Treinar mesmo assim →
        </button>
      </div>`;
  } else if (!nextWorkout) {
    workoutRow = `
      <div class="flex items-center justify-between gap-3 bg-black/30 rounded-xl px-3 py-3 border border-zinc-800/40">
        <div class="min-w-0 flex-1">
          <div class="text-[9px] text-zinc-600 uppercase tracking-wider flex items-center gap-1 mb-0.5">
            <i data-lucide="dumbbell" class="w-2.5 h-2.5"></i> MUSCULAÇÃO
          </div>
          <div class="text-sm font-bold text-zinc-600">Sem treino programado</div>
        </div>
        <button data-action="goto-workouts"
                class="ripple-target shrink-0 px-3 py-2 bg-zinc-800 border border-zinc-700
                       text-zinc-300 text-[10px] font-black rounded-xl active:scale-95 transition-all">
          Escolher
        </button>
      </div>`;
  } else if (workoutDoneToday) {
    workoutRow = `
      <div class="flex items-center justify-between gap-3 bg-green-950/30 rounded-xl px-3 py-3 border border-green-900/30">
        <div class="min-w-0 flex-1">
          <div class="text-[9px] text-zinc-600 uppercase tracking-wider flex items-center gap-1 mb-0.5">
            <i data-lucide="dumbbell" class="w-2.5 h-2.5"></i> MUSCULAÇÃO
          </div>
          <div class="text-sm font-black text-white truncate">${nextWorkout.title}</div>
          <div class="text-[10px] text-zinc-500 truncate">${nextWorkout.subtitle}</div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0 text-green-500">
          <i data-lucide="check-circle" class="w-5 h-5"></i>
          <span class="text-[10px] font-black uppercase">Feito</span>
        </div>
      </div>`;
  } else {
    workoutRow = `
      <div class="flex items-center justify-between gap-3 bg-black/30 rounded-xl px-3 py-3 border border-theme-dim/40">
        <div class="min-w-0 flex-1">
          <div class="text-[9px] text-zinc-500 uppercase tracking-wider flex items-center gap-1 mb-0.5">
            <i data-lucide="dumbbell" class="w-2.5 h-2.5"></i> MUSCULAÇÃO
          </div>
          <div class="text-sm font-black text-white leading-tight truncate">${nextWorkout.title}</div>
          <div class="text-[10px] text-zinc-500 truncate">${nextWorkout.subtitle} · ${nextWorkout.exercises?.length ?? 0} ex.</div>
        </div>
        <button data-action="start-workout" data-workout-id="${nextWorkout.id}"
                class="ripple-target shrink-0 px-4 py-2.5 bg-theme-primary text-black
                       text-[10px] font-black rounded-xl shadow-[0_0_12px_var(--theme-primary)]
                       active:scale-95 transition-all uppercase">
          Iniciar
        </button>
      </div>`;
  }

  // Bloco cardio
  let cardioRow;
  if (!defaultProtocol) {
    cardioRow = '';
  } else if (cardioDoneToday) {
    const lastC = cardioHistory.find(c => isToday(c.date));
    const TYPE_LBL = { corrida: 'Corrida', bike: 'Bike', outro: 'Outro' };
    const typeLbl = TYPE_LBL[(lastC?.type || '').toLowerCase()] || 'Cardio';
    cardioRow = `
      <div class="flex items-center justify-between gap-3 bg-green-950/30 rounded-xl px-3 py-3 border border-green-900/30">
        <div class="min-w-0 flex-1">
          <div class="text-[9px] text-zinc-600 uppercase tracking-wider flex items-center gap-1 mb-0.5">
            <i data-lucide="activity" class="w-2.5 h-2.5"></i> CARDIO
          </div>
          <div class="text-sm font-black text-white truncate">${typeLbl}</div>
          <div class="text-[10px] text-zinc-500 flex items-center gap-1 flex-wrap">
            ${lastC?.distance ? `<span>${lastC.distance}km</span>` : ''}
            ${lastC?.pace ? `<span class="text-theme-primary/80">${lastC.pace}/km</span>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0 text-green-500">
          <i data-lucide="check-circle" class="w-5 h-5"></i>
          <span class="text-[10px] font-black uppercase">Feito</span>
        </div>
      </div>`;
  } else {
    const efLabel = defaultProtocol.effort === 'fácil' ? 'Fácil' : defaultProtocol.effort === 'forte' ? 'Forte' : 'Moderado';
    const durMin  = defaultProtocol.totalDuration > 0 ? Math.round(defaultProtocol.totalDuration / 60) : null;
    cardioRow = `
      <div class="flex items-center justify-between gap-3 bg-black/30 rounded-xl px-3 py-3 border border-zinc-800/40">
        <div class="min-w-0 flex-1">
          <div class="text-[9px] text-zinc-500 uppercase tracking-wider flex items-center gap-1 mb-0.5">
            <i data-lucide="activity" class="w-2.5 h-2.5"></i> CARDIO
          </div>
          <div class="text-sm font-black text-white leading-tight truncate">${defaultProtocol.name}</div>
          <div class="text-[10px] text-zinc-500">${efLabel}${durMin ? ` · ${durMin}min` : ''}</div>
        </div>
        <button data-action="start-cardio-protocol" data-protocol-id="${defaultProtocol.id}"
                class="ripple-target shrink-0 px-4 py-2.5 bg-zinc-800 border border-zinc-700
                       text-zinc-200 text-[10px] font-black rounded-xl active:scale-95 transition-all uppercase">
          Iniciar
        </button>
      </div>`;
  }

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/70 space-y-2">
      <div class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
        <i data-lucide="target" class="w-3 h-3"></i>
        ${L.todayMission ?? 'Missão de Hoje'}
      </div>
      ${workoutRow}
      ${cardioRow}
    </div>
  `;
}

/* ─── Atividade Recente ────────────────────────────────────────────── */

function renderRecentActivity(history, cardioHistory) {
  const lastW = history[0] ?? null;
  const lastC = cardioHistory[0] ?? null;
  if (!lastW && !lastC) return '';

  const rows = [];

  if (lastW) {
    const daysAgo  = Math.floor((Date.now() - new Date(lastW.date)) / 86400000);
    const dayLabel = daysAgo === 0 ? 'Hoje' : daysAgo === 1 ? 'Ontem' : `há ${daysAgo}d`;
    rows.push(`
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-theme-dim border border-theme-accent flex items-center justify-center shrink-0">
          <i data-lucide="dumbbell" class="w-3.5 h-3.5 text-theme-primary pointer-events-none"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-bold text-white truncate">${lastW.title}</div>
          <div class="text-[9px] text-zinc-500 font-mono flex items-center gap-1 flex-wrap">
            <span>${dayLabel}</span>
            ${lastW.vol ? `<span class="text-zinc-700">·</span><span class="text-theme-primary/70">${formatVolume(lastW.vol)}</span>` : ''}
            ${lastW.duration ? `<span class="text-zinc-700">·</span><span>${formatDuration(lastW.duration)}</span>` : ''}
          </div>
        </div>
      </div>`);
  }

  if (lastC) {
    const daysAgo  = Math.floor((Date.now() - new Date(lastC.date)) / 86400000);
    const dayLabel = daysAgo === 0 ? 'Hoje' : daysAgo === 1 ? 'Ontem' : `há ${daysAgo}d`;
    const TYPE_LBL = { corrida: 'Corrida', bike: 'Bike', outro: 'Outro' };
    const typeLbl  = TYPE_LBL[(lastC.type || '').toLowerCase()] || 'Cardio';
    const localLbl = lastC.local === 'rua' ? ' · Rua' : lastC.local === 'esteira' ? ' · Esteira' : '';
    rows.push(`
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
          <i data-lucide="activity" class="w-3.5 h-3.5 text-theme-primary/70 pointer-events-none"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-bold text-white truncate">${typeLbl}${localLbl}</div>
          <div class="text-[9px] text-zinc-500 font-mono flex items-center gap-1 flex-wrap">
            <span>${dayLabel}</span>
            ${lastC.distance ? `<span class="text-zinc-700">·</span><span>${lastC.distance}km</span>` : ''}
            ${lastC.pace ? `<span class="text-zinc-700">·</span><span class="text-theme-primary/70">${lastC.pace}/km</span>`
              : lastC.duration ? `<span class="text-zinc-700">·</span><span>${Math.round(lastC.duration)}min</span>` : ''}
          </div>
        </div>
      </div>`);
  }

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/70 space-y-2.5">
      <div class="flex items-center justify-between">
        <div class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="clock" class="w-3 h-3"></i> Atividade Recente
        </div>
        <button data-action="goto-tab" data-payload="evoluir"
                class="text-[9px] text-zinc-600 hover:text-theme-primary font-bold uppercase tracking-wider transition-colors active:scale-90">
          Histórico →
        </button>
      </div>
      ${rows.join('<div class="border-t border-zinc-800/40"></div>')}
    </div>
  `;
}

/* ─── Goal Gauge ───────────────────────────────────────────────────── */

function renderGoalGauge(bodyWeights, biometrics, bioHistory) {
  const current = bodyWeights?.[0]?.value ?? biometrics?.weight;
  const target  = biometrics?.targetWeight;
  if (!current || !target || target <= current) return '';

  const allBioPoints = [
    ...( bioHistory ?? []).filter(b => b.weight && b.date),
    biometrics?.date ? biometrics : null,
  ].filter(Boolean).sort((a, b) => new Date(a.date) - new Date(b.date));

  const startW = allBioPoints[0]?.weight ?? current;
  const total  = target - startW;
  const done   = current - startW;
  const pct    = total > 0 ? Math.min(100, Math.max(0, (done / total) * 100)) : 0;
  const gap    = (target - current).toFixed(1);

  let projStr = '';
  if (allBioPoints.length >= 2) {
    const oldest  = allBioPoints[0];
    const newest  = allBioPoints[allBioPoints.length - 1];
    const days    = Math.max(1, (new Date(newest.date) - new Date(oldest.date)) / 86400000);
    const gained  = newest.weight - oldest.weight;
    const rateDay = gained / days;
    if (rateDay > 0) {
      const daysLeft = (target - current) / rateDay;
      const proj     = new Date(Date.now() + daysLeft * 86400000);
      const M = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      projStr = `${M[proj.getMonth()]}/${proj.getFullYear()}`;
    }
  }

  return `
    <div class="glass-card p-4 rounded-2xl border border-theme-dim/40 relative overflow-hidden">
      <div class="absolute inset-0 bg-theme-primary/2 pointer-events-none"></div>
      <div class="relative z-10">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <i data-lucide="target" class="w-3.5 h-3.5"></i>
            Meta: ${target}kg
          </span>
          ${projStr ? `<span class="text-[9px] text-theme-primary/60 font-mono">→ ~${projStr}</span>` : ''}
        </div>
        <div class="flex items-end justify-between mb-2.5">
          <div>
            <span class="text-2xl font-black font-mono text-white">${current.toFixed(1)}</span>
            <span class="text-zinc-500 text-xs"> kg atual</span>
          </div>
          <div class="text-right">
            <div class="text-sm font-black font-mono text-theme-primary">${parseFloat(gap) > 0 ? `+${gap}kg` : '🏆 META'}</div>
            <div class="text-[9px] text-zinc-600 font-mono">p/ chegar</div>
          </div>
        </div>
        <div class="h-2 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
          <div class="h-full rounded-full transition-all duration-1000"
               style="width:${pct.toFixed(1)}%;background:linear-gradient(90deg,var(--theme-primary),var(--theme-accent))"></div>
        </div>
        <div class="flex justify-between">
          <span class="text-[8px] font-mono text-zinc-700">${startW.toFixed(1)}kg início</span>
          <span class="text-[8px] font-mono text-theme-primary/60">${pct.toFixed(0)}% completo</span>
        </div>
      </div>
    </div>
  `;
}

/* ─── Última Evolução ──────────────────────────────────────────────── */

function renderLastEvolution(history) {
  const last = history[0];
  if (!last?.breakdown?.length) return '';

  const prev = history.find(h => h.workoutId === last.workoutId && h.id !== last.id);
  if (!prev) return '';

  const daysAgo = Math.floor((Date.now() - new Date(last.date)) / 86400000);
  const timeAgo = daysAgo === 0 ? 'hoje' : daysAgo === 1 ? 'ontem' : `há ${daysAgo} dias`;
  const prevMap = Object.fromEntries((prev.breakdown ?? []).map(b => [b.exId, b]));

  const rows = (last.breakdown ?? []).slice(0, 5).map(item => {
    const p = prevMap[item.exId];
    if (!p) {
      return `<div class="flex items-center gap-2">
        <span class="text-[11px] font-black text-zinc-600 w-4 text-center shrink-0 leading-none">●</span>
        <span class="text-[10px] text-zinc-500 flex-1 truncate">${item.name}</span>
        <span class="text-[9px] font-mono text-zinc-700">Novo</span>
      </div>`;
    }
    const wDelta = parseFloat((item.maxWeight - p.maxWeight).toFixed(1));
    const vPct   = p.vol > 0 ? Math.round((item.vol - p.vol) / p.vol * 100) : 0;

    let arrow, cls, label;
    if (wDelta > 0) {
      arrow = '↑'; cls = 'text-green-400';
      label = `+${wDelta % 1 === 0 ? wDelta : wDelta.toFixed(1)}kg`;
    } else if (wDelta < 0) {
      arrow = '↓'; cls = 'text-rose-400';
      label = `${wDelta % 1 === 0 ? wDelta : wDelta.toFixed(1)}kg`;
    } else if (vPct > 0) {
      arrow = '↑'; cls = 'text-blue-400';
      label = `+${vPct}% vol`;
    } else if (vPct < 0) {
      arrow = '↓'; cls = 'text-rose-400/70';
      label = `${vPct}% vol`;
    } else {
      arrow = '='; cls = 'text-zinc-600';
      label = 'Manteve';
    }

    return `<div class="flex items-center gap-2">
      <span class="text-[11px] font-black ${cls} w-4 text-center shrink-0 leading-none">${arrow}</span>
      <span class="text-[10px] text-zinc-400 flex-1 truncate">${item.name}</span>
      <span class="text-[10px] font-mono font-bold ${cls} shrink-0">${label}</span>
    </div>`;
  });

  if (!rows.length) return '';

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/70">
      <div class="flex items-center justify-between mb-3">
        <div class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="trending-up" class="w-3 h-3"></i>
          Última Evolução · ${last.title} · ${timeAgo}
        </div>
        <button data-action="goto-tab" data-payload="evoluir"
                class="text-[9px] text-zinc-600 hover:text-theme-primary font-bold uppercase tracking-wider transition-colors active:scale-90">
          Ver →
        </button>
      </div>
      <div class="space-y-2.5">
        ${rows.join('')}
      </div>
    </div>
  `;
}

/* ─── Motor de Insights ─────────────────────────────────────────────── */

// Maps achievement color classes → CSS values for inline bar styling
const ACH_BAR_COLOR = {
  'text-theme-primary': 'var(--theme-primary)',
  'text-yellow-300':    '#fde047',
  'text-yellow-400':    '#facc15',
  'text-amber-300':     '#fcd34d',
  'text-amber-400':     '#fbbf24',
  'text-orange-400':    '#fb923c',
  'text-red-400':       '#f87171',
  'text-red-500':       '#ef4444',
  'text-green-400':     '#4ade80',
  'text-emerald-400':   '#34d399',
  'text-blue-400':      '#60a5fa',
  'text-blue-300':      '#93c5fd',
  'text-cyan-400':      '#22d3ee',
  'text-cyan-300':      '#67e8f9',
  'text-purple-400':    '#c084fc',
  'text-zinc-300':      '#d4d4d8',
};

function getBestStreak(history, cardioHistory, cardioCountsStreak) {
  const wDates = history.map(h => localDateKey(h.date));
  const cDates = cardioCountsStreak ? cardioHistory.map(c => localDateKey(c.date)) : [];
  const allDates = [...new Set([...wDates, ...cDates])].sort();
  if (allDates.length < 2) return allDates.length;
  let best = 1, cur = 1;
  for (let i = 1; i < allDates.length; i++) {
    const diff = Math.round((new Date(allDates[i]) - new Date(allDates[i - 1])) / 86400000);
    if (diff === 1) { cur++; if (cur > best) best = cur; }
    else cur = 1;
  }
  return best;
}

function generateInsight(state, workouts, streak) {
  const {
    cycleDone = [], cycleGoal = 6, history = [], cardioHistory = [],
    prs = {}, cycleStart, cycleOrder = [], cyclePosition = 0,
    cardioCountsStreak = false, bodyWeights = [], weekPlan = {},
    goal = null,
  } = state;

  // I0. Goal-specific tip — primeiras 10 sessões ou quando sem outros sinais relevantes
  const GOAL_TIPS = {
    hipertrofia:     { icon: 'trending-up', iconClass: 'text-green-400',  label: 'Foco em hipertrofia: progrida a carga a cada treino.',    sub: 'Meta: +2.5kg a cada 2 semanas por exercício composto.'  },
    emagrecimento:   { icon: 'flame',       iconClass: 'text-orange-400', label: 'Déficit calórico + treino = composição corporal real.',    sub: 'Mantenha proteína alta (2.4g/kg) para preservar massa.'  },
    recomposicao:    { icon: 'repeat',      iconClass: 'text-blue-400',   label: 'Recomposição: treino consistente + proteína no ponto.',    sub: 'Coma no TDEE. Ganhos lentos, mas composição muda.'       },
    forca:           { icon: 'zap',         iconClass: 'text-orange-400', label: 'Desenvolvimento de força: compostos primeiro, pesados.',   sub: 'Agachamento, supino, remada — prioridade máxima.'         },
    condicionamento: { icon: 'wind',        iconClass: 'text-cyan-400',   label: 'Combine musculação e cardio para condicionamento real.',   sub: 'Zona 2 dois dias por semana potencializa a recuperação.'  },
  };
  if (goal && history.length < 10 && GOAL_TIPS[goal]) {
    return { ...GOAL_TIPS[goal], priority: 'informative', action: null, payload: null };
  }

  // lookup de nome de exercício
  const exMap = {};
  workouts.forEach(w => (w.exercises ?? []).forEach(ex => { exMap[ex.id] = ex.name; }));

  // ── CRÍTICOS — oportunidade ou ação urgente ──────────────────────────

  // C1. PR ao alcance — progressão linear aponta peso > PR no próximo treino
  if (cycleOrder.length > 0 && Object.keys(prs).length > 0 && history.length >= 3) {
    const nextWId = cycleOrder[cyclePosition] ?? null;
    const nextW   = nextWId ? workouts.find(w => w.id === nextWId && !w.isCardio) : null;
    if (nextW?.exercises?.length) {
      for (const ex of nextW.exercises) {
        const pr = prs[ex.id];
        if (!pr) continue;
        const exSessions = history
          .filter(h => h.workoutId === nextWId && h.sets?.[ex.id]?.some(s => s.done && s.w))
          .slice(0, 3);
        if (exSessions.length < 2) continue;
        const maxW = exSessions.map(h =>
          Math.max(...(h.sets[ex.id] ?? []).filter(s => s.done && !s.warmup && s.w).map(s => parseFloat(s.w) || 0))
        ).filter(w => w > 0);
        if (maxW.length < 2) continue;
        let total = 0;
        for (let i = 0; i < maxW.length - 1; i++) total += maxW[i] - maxW[i + 1];
        const avgDelta = total / (maxW.length - 1);
        if (avgDelta <= 0) continue;
        const loadTarget = Math.round((maxW[0] + avgDelta) * 2) / 2;
        if (loadTarget > pr.weight) {
          const diff = +(loadTarget - pr.weight).toFixed(1);
          return {
            icon: 'zap', iconClass: 'text-yellow-400', priority: 'critical',
            label: `A progressão aponta PR no ${ex.name}. Não deixe passar.`,
            sub: `Meta sugerida: ${loadTarget}kg (+${diff}kg vs PR atual de ${pr.weight}kg)`,
            action: 'goto-workouts', payload: null,
          };
        }
      }
    }
  }

  // C2. Streak próximo do recorde pessoal
  if (streak >= 3) {
    const best = getBestStreak(history, cardioHistory, cardioCountsStreak);
    if (best > streak && streak >= best - 2) {
      const diff = best - streak;
      return {
        icon: 'flame', iconClass: 'text-orange-400', priority: 'critical',
        label: `A ${diff === 1 ? '1 dia' : `${diff} dias`} do recorde pessoal de ${best} dias.`,
        sub: `Streak atual: ${streak} dias. Não pare agora.`,
        action: null, payload: null,
      };
    }
  }

  // C3. Negligência muscular — grupo do próximo treino sem estímulo há > 7 dias
  if (cycleOrder.length > 0 && history.length >= 3) {
    const nextWId = cycleOrder[cyclePosition] ?? null;
    const nextW   = nextWId ? workouts.find(w => w.id === nextWId && !w.isCardio) : null;
    if (nextW?.muscleFocus?.length) {
      const cutoff = Date.now() - 7 * 86400000;
      const recentMuscles = new Set(
        history.filter(h => new Date(h.date).getTime() >= cutoff).flatMap(h => h.muscles ?? [])
      );
      const neglected = nextW.muscleFocus.find(m => !recentMuscles.has(m));
      if (neglected) {
        const lastEntry = history.find(h => (h.muscles ?? []).includes(neglected));
        const daysAgo   = lastEntry ? Math.floor((Date.now() - new Date(lastEntry.date)) / 86400000) : null;
        return {
          icon: 'zap', iconClass: 'text-theme-primary', priority: 'critical',
          label: daysAgo
            ? `${neglected} sem estímulo há ${daysAgo} dias. Hoje seria ideal.`
            : `${neglected} pronto para um novo estímulo.`,
          sub: `Próximo treino: ${nextW.title}`,
          action: 'goto-workouts', payload: null,
        };
      }
    }
  }

  // C4. Deload detector — carga igual/menor em 3 sessões consecutivas
  if (history.length >= 6 && cycleOrder.length > 0) {
    const nextWId = cycleOrder[cyclePosition] ?? null;
    const nextW   = nextWId ? workouts.find(w => w.id === nextWId && !w.isCardio) : null;
    if (nextW?.exercises?.length) {
      for (const ex of nextW.exercises) {
        const sessions = history
          .filter(h => h.workoutId === nextWId && h.sets?.[ex.id]?.length)
          .slice(0, 3);
        if (sessions.length < 3) continue;
        const maxWeights = sessions.map(h =>
          Math.max(...(h.sets[ex.id] ?? []).filter(s => s.done && !s.warmup && s.w).map(s => parseFloat(s.w) || 0))
        ).filter(w => w > 0);
        if (maxWeights.length < 3) continue;
        if (maxWeights[0] <= maxWeights[1] && maxWeights[1] <= maxWeights[2]) {
          return {
            icon: 'alert-triangle', iconClass: 'text-yellow-500', priority: 'critical',
            label: `${ex.name} sem progressão por 3 sessões.`,
            sub: `Mude o estímulo ou planeje um deload. Cargas: ${maxWeights.map(w => `${w}kg`).join(' · ')}`,
            action: 'goto-tab', payload: 'evoluir',
          };
        }
      }
    }
  }

  // ── IMPORTANTES — vale agir, mas sem urgência ─────────────────────────

  // I1. Ciclo quase completo
  if (cycleDone.length > 0 && cycleDone.length === cycleGoal - 1) {
    return {
      icon: 'trophy', iconClass: 'text-amber-400', priority: 'important',
      label: `Falta 1 treino. Feche o ciclo hoje.`,
      sub: `${cycleDone.length}/${cycleGoal} missões concluídas`,
      action: 'goto-workouts', payload: null,
    };
  }

  // I2. PRs batidos neste ciclo
  if (cycleStart && Object.keys(prs).length > 0) {
    const since = new Date(cycleStart).getTime();
    const prCount = Object.values(prs).filter(pr => pr.date && new Date(pr.date).getTime() >= since).length;
    if (prCount >= 1) {
      return {
        icon: 'trending-up', iconClass: 'text-green-400', priority: 'important',
        label: `${prCount} recorde${prCount !== 1 ? 's' : ''} neste ciclo. Sobrecarga funcionando.`,
        sub: 'Continue a progressão de carga',
        action: 'goto-tab', payload: 'evoluir',
      };
    }
  }

  // I3. Exercício mais evoluído do ciclo
  if (cycleStart && history.length >= 4) {
    const since = new Date(cycleStart).getTime();
    const cycleHist = history.filter(h => new Date(h.date).getTime() >= since);
    let bestEx = null, bestGain = 0;
    Object.keys(prs).forEach(exId => {
      const cx = cycleHist.filter(h => h.sets?.[exId]?.some(s => s.done && !s.warmup && s.w)).reverse();
      if (cx.length < 2) return;
      const fw = Math.max(...(cx[0].sets[exId] ?? []).filter(s => s.done && !s.warmup && s.w).map(s => parseFloat(s.w) || 0));
      const lw = Math.max(...(cx[cx.length - 1].sets[exId] ?? []).filter(s => s.done && !s.warmup && s.w).map(s => parseFloat(s.w) || 0));
      const gain = lw - fw;
      if (gain > bestGain && fw > 0) { bestGain = gain; bestEx = { exId, fw, lw }; }
    });
    if (bestEx && bestGain >= 2.5) {
      const name = exMap[bestEx.exId] || bestEx.exId;
      return {
        icon: 'trending-up', iconClass: 'text-emerald-400', priority: 'important',
        label: `${name} avançou mais no ciclo. Mantenha a frequência.`,
        sub: `${bestEx.fw}kg → ${bestEx.lw}kg (+${bestGain.toFixed(1)}kg)`,
        action: 'goto-tab', payload: 'evoluir',
      };
    }
  }

  // I4. Volume semanal em queda ou alta significativa
  if (history.length >= 4) {
    const now7  = Date.now() - 7  * 86400000;
    const now14 = Date.now() - 14 * 86400000;
    const volThis = history.filter(h => new Date(h.date).getTime() >= now7).reduce((s, h) => s + (h.vol || 0), 0);
    const volLast = history.filter(h => { const t = new Date(h.date).getTime(); return t >= now14 && t < now7; }).reduce((s, h) => s + (h.vol || 0), 0);
    if (volLast > 0 && volThis > 0) {
      const delta = Math.round((volThis - volLast) / volLast * 100);
      if (Math.abs(delta) >= 15) {
        return {
          icon: 'bar-chart-2', iconClass: delta > 0 ? 'text-blue-400' : 'text-zinc-400', priority: 'important',
          label: delta > 0
            ? `Volume ${delta}% acima da semana passada.`
            : `Volume ${Math.abs(delta)}% abaixo da semana passada.`,
          sub: delta < 0
            ? `${formatVolume(volThis)} esta semana. Tente recuperar o ritmo.`
            : `${formatVolume(volThis)} acumulados. Bom ritmo.`,
          action: null, payload: null,
        };
      }
    }
  }

  // I5. Lembrete de cardio
  if (cardioHistory.length > 0) {
    const daysSince = Math.floor((Date.now() - new Date(cardioHistory[0].date)) / 86400000);
    if (daysSince >= 5) {
      return {
        icon: 'wind', iconClass: 'text-cyan-400', priority: 'important',
        label: `${daysSince} dias desde o último cardio.`,
        sub: 'Uma corrida leve hoje aceleraria a recuperação muscular.',
        action: 'open-cardio-log', payload: null,
      };
    }
  }

  // I6. Tendência de peso corporal
  if (bodyWeights.length >= 5) {
    const sorted = [...bodyWeights].sort((a, b) => new Date(b.date) - new Date(a.date));
    const avgR = sorted.slice(0, 3).reduce((s, e) => s + e.value, 0) / 3;
    const avgB = sorted.slice(3, 6).reduce((s, e) => s + e.value, 0) / Math.min(3, sorted.slice(3).length);
    const diff = +(avgR - avgB).toFixed(1);
    if (Math.abs(diff) >= 0.3) {
      return {
        icon: 'trending-up', iconClass: diff < 0 ? 'text-green-400' : 'text-orange-400', priority: 'important',
        label: diff < 0 ? `Peso caindo: ${diff}kg nas últimas semanas.` : `Peso subindo: +${diff}kg.`,
        sub: `Média recente: ${avgR.toFixed(1)}kg`,
        action: 'goto-tab', payload: 'corpo',
      };
    }
  }

  // I7. Deslocamento Ativo — narrativa do ciclo atual
  if (state.activeCommute?.enabled && cycleStart) {
    const cycleTs = new Date(cycleStart).getTime();
    const withCommute = h => (h.mission?.commute?.distance ?? 0) > 0;
    const cycleEntries = history.filter(h => new Date(h.date).getTime() >= cycleTs && withCommute(h));
    if (cycleEntries.length >= 2) {
      const commuteKm  = +cycleEntries.reduce((s, h) => s + h.mission.commute.distance, 0).toFixed(1);
      const commuteCal = cycleEntries.reduce((s, h) => s + h.mission.commute.calories, 0);
      const cardioKmCycle = cardioHistory
        .filter(c => new Date(c.date).getTime() >= cycleTs)
        .reduce((s, c) => s + (c.distance || 0), 0);
      const commuteMoreThanCardio = commuteKm > 0 && commuteKm > cardioKmCycle;
      return {
        icon: 'move', iconClass: 'text-cyan-400', priority: 'informative',
        label: commuteMoreThanCardio
          ? `Você caminhou mais até a academia (${commuteKm}km) do que correu (${cardioKmCycle.toFixed(1)}km) neste ciclo.`
          : `${commuteKm}km de deslocamento ativo neste ciclo — ~${commuteCal}kcal no caminho.`,
        sub: commuteMoreThanCardio
          ? `~${commuteCal}kcal estimadas (MET) · deslocamento vira treino`
          : `${cycleEntries.length} sessões com deslocamento registrado`,
        action: null, payload: null,
      };
    }
  }

  // ── INFORMATIVOS — contexto e celebração ────────────────────────────

  // N1. Retrospectiva semanal (segunda-feira)
  if (new Date().getDay() === 1 && history.length >= 2) {
    const lastMonStart = Date.now() - 8 * 86400000;
    const lastSunEnd   = Date.now() - 1 * 86400000;
    const lastWeek = history.filter(h => { const t = new Date(h.date).getTime(); return t >= lastMonStart && t <= lastSunEnd; });
    if (lastWeek.length >= 2) {
      const vol  = lastWeek.reduce((s, h) => s + (h.vol || 0), 0);
      const days = new Set(lastWeek.map(h => h.date.slice(0, 10))).size;
      const weekPRs = Object.values(prs).filter(pr => { const t = pr.date ? new Date(pr.date).getTime() : 0; return t >= lastMonStart && t <= lastSunEnd; }).length;
      const cKm = cardioHistory.filter(c => { const t = new Date(c.date).getTime(); return t >= lastMonStart && t <= lastSunEnd; }).reduce((s, c) => s + (c.distance || 0), 0);
      const extras = [weekPRs > 0 ? `${weekPRs} PR${weekPRs !== 1 ? 's' : ''}` : null, cKm > 0 ? `${cKm.toFixed(1)}km cardio` : null].filter(Boolean).join(' · ');
      return {
        icon: 'calendar-check', iconClass: 'text-purple-400', priority: 'informative',
        label: `Semana passada: ${days} dia${days !== 1 ? 's' : ''} de treino, ${formatVolume(vol)}.`,
        sub: extras || 'Boa semana. Mantenha o ritmo.',
        action: 'goto-tab', payload: 'evoluir',
      };
    }
  }

  // N2. Aderência ao plano semanal
  if (history.length >= 3) {
    const today = new Date();
    const dow = today.getDay();
    const plannedCount = [...Array(dow + 1).keys()].filter(i => weekPlan[i] && weekPlan[i] !== '').length;
    if (plannedCount >= 3) {
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const doneCount = new Set(history.filter(h => new Date(h.date) >= monday).map(h => h.date.slice(0, 10))).size;
      const adherence = Math.round(doneCount / plannedCount * 100);
      if (adherence >= 80) {
        return {
          icon: 'calendar-check', iconClass: 'text-green-400', priority: 'informative',
          label: `${adherence}% de aderência ao plano esta semana.`,
          sub: `${doneCount} de ${plannedCount} dias planejados concluídos`,
          action: null, payload: null,
        };
      }
    }
  }

  // N3. Semana recorde de dias de treino
  if (history.length >= 8) {
    const weekDays = (off) => {
      const lo = Date.now() - (off + 1) * 7 * 86400000;
      const hi = Date.now() - off * 7 * 86400000;
      return new Set(history.filter(h => { const t = new Date(h.date).getTime(); return t >= lo && t < hi; }).map(h => h.date.slice(0, 10))).size;
    };
    const thisWeekCount = weekDays(0);
    if (thisWeekCount >= 4 && thisWeekCount > Math.max(...[1, 2, 3, 4, 5, 6, 7, 8].map(weekDays))) {
      return {
        icon: 'calendar-check', iconClass: 'text-green-400', priority: 'informative',
        label: `${thisWeekCount} dias de treino esta semana — recorde pessoal.`,
        sub: 'Sua melhor semana de consistência',
        action: null, payload: null,
      };
    }
  }

  // N4. Volume total acumulado
  if (history.length >= 5) {
    const totalVol = history.reduce((s, h) => s + (h.vol || 0), 0);
    if (totalVol >= 1000) {
      return {
        icon: 'dumbbell', iconClass: 'text-theme-primary', priority: 'informative',
        label: `${formatVolume(totalVol)} movidas em ${history.length} treinos.`,
        sub: 'Você está construindo algo real.',
        action: null, payload: null,
      };
    }
  }

  return null;
}

function renderInsightCard(insight) {
  if (!insight) return '';
  const isClickable = !!insight.action;
  const tag = isClickable ? 'button' : 'div';
  const actionAttr = isClickable
    ? `data-action="${insight.action}"${insight.payload ? ` data-payload="${insight.payload}"` : ''}`
    : '';

  const p = insight.priority ?? 'informative';
  const cardBorder = p === 'critical'    ? 'border-amber-800/50'
                   : p === 'important'   ? 'border-theme-dim/70'
                                         : 'border-zinc-800/40';
  const cardBg     = p === 'critical'    ? 'bg-amber-950/10'
                   : p === 'important'   ? 'bg-theme-dark/10'
                                         : '';
  const iconBg     = p === 'critical'    ? 'bg-amber-900/20 border-amber-800/30'
                   : p === 'important'   ? 'bg-theme-dim/60 border-theme-dim/50'
                                         : 'bg-zinc-800/60 border-zinc-700/40';
  const labelColor = p === 'informative' ? 'text-zinc-200' : 'text-white';
  const pulseDot   = p === 'critical'
    ? `<span class="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>`
    : '';

  return `
    <${tag} ${actionAttr}
            class="ripple-target w-full glass-card px-4 py-3 rounded-2xl border ${cardBorder} ${cardBg}
                   flex items-center gap-3 text-left
                   ${isClickable ? 'active:scale-[0.98] transition-transform' : ''}
                   relative overflow-hidden">
      ${pulseDot}
      <div class="absolute inset-0 bg-gradient-to-r from-white/[0.02] to-transparent pointer-events-none"></div>
      <div class="w-9 h-9 rounded-xl ${iconBg} border flex items-center justify-center shrink-0">
        <i data-lucide="${insight.icon}" class="w-4 h-4 ${insight.iconClass}"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-bold ${labelColor} leading-snug">${insight.label}</div>
        ${insight.sub ? `<div class="text-[10px] ${p === 'critical' ? 'text-zinc-400' : 'text-zinc-500'} mt-0.5 leading-snug">${insight.sub}</div>` : ''}
      </div>
      ${isClickable ? `<i data-lucide="chevron-right" class="w-4 h-4 text-zinc-700 shrink-0 pointer-events-none"></i>` : ''}
    </${tag}>
  `;
}

/* ─── Próxima Conquista ─────────────────────────────────────────────── */

function renderNextAchievement(state, streak) {
  const {
    history = [], achievements = [], cardioHistory = [], completedCycles = 0,
  } = state;

  const earned     = new Set(achievements);
  const sessions   = history.length;
  const totalVol   = history.reduce((s, h) => s + (h.vol || 0), 0);
  const cardioSess = cardioHistory.length;
  const cardioKm   = cardioHistory.reduce((s, c) => s + (c.distance || 0), 0);

  const milestones = [
    { id: 'session_1',     cur: sessions,   target: 1      },
    { id: 'session_10',    cur: sessions,   target: 10     },
    { id: 'session_25',    cur: sessions,   target: 25     },
    { id: 'session_50',    cur: sessions,   target: 50     },
    { id: 'session_100',   cur: sessions,   target: 100    },
    { id: 'session_200',   cur: sessions,   target: 200    },
    { id: 'vol_1t',        cur: totalVol,   target: 1000   },
    { id: 'vol_10t',       cur: totalVol,   target: 10000  },
    { id: 'vol_100t',      cur: totalVol,   target: 100000 },
    { id: 'vol_500t',      cur: totalVol,   target: 500000 },
    { id: 'streak_7',      cur: streak,     target: 7      },
    { id: 'streak_30',     cur: streak,     target: 30     },
    { id: 'streak_100',    cur: streak,     target: 100    },
    { id: 'cycle_1',       cur: completedCycles, target: 1 },
    { id: 'cycle_5',       cur: completedCycles, target: 5 },
    { id: 'cardio_first',  cur: cardioSess, target: 1      },
    { id: 'cardio_5',      cur: cardioSess, target: 5      },
    { id: 'cardio_10',     cur: cardioSess, target: 10     },
    { id: 'cardio_25',     cur: cardioSess, target: 25     },
    { id: 'cardio_50',     cur: cardioSess, target: 50     },
    { id: 'cardio_10km',   cur: cardioKm,   target: 10     },
    { id: 'cardio_50km',   cur: cardioKm,   target: 50     },
    { id: 'cardio_100km',  cur: cardioKm,   target: 100    },
    { id: 'cardio_250km',  cur: cardioKm,   target: 250    },
  ];

  const nearest = milestones
    .filter(m => !earned.has(m.id) && m.cur > 0)
    .map(m => ({ ...m, pct: Math.min(99, (m.cur / m.target) * 100) }))
    .filter(m => m.pct >= 20)
    .sort((a, b) => b.pct - a.pct)[0];

  if (!nearest) return '';
  const def = ACHIEVEMENT_MAP[nearest.id];
  if (!def) return '';

  const pct = nearest.pct;
  const rem = nearest.target - nearest.cur;
  let remStr;
  if (nearest.id.startsWith('vol_'))          remStr = `faltam ${formatVolume(rem)}`;
  else if (nearest.id.startsWith('streak_'))  remStr = `faltam ${Math.ceil(rem)} dia${Math.ceil(rem) !== 1 ? 's' : ''}`;
  else if (nearest.id.includes('km'))         remStr = `faltam ${rem.toFixed(1)}km`;
  else                                         remStr = `faltam ${Math.ceil(rem)}`;

  const barColor = ACH_BAR_COLOR[def.color] ?? 'var(--theme-primary)';

  return `
    <button data-action="goto-tab" data-payload="corpo"
            class="ripple-target w-full glass-card px-4 py-3 rounded-2xl border border-zinc-800/70
                   text-left active:scale-[0.98] transition-transform relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-white/[0.015] to-transparent pointer-events-none"></div>
      <div class="flex items-center gap-3 mb-2.5">
        <div class="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center shrink-0">
          <i data-lucide="${def.icon}" class="w-3.5 h-3.5 ${def.color}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[9px] text-zinc-600 uppercase tracking-widest font-bold mb-0.5">Próxima Conquista</div>
          <div class="text-xs font-black text-white truncate">${def.name}</div>
        </div>
        <div class="text-right shrink-0">
          <div class="text-sm font-black font-mono ${def.color}">${pct.toFixed(0)}%</div>
          <div class="text-[9px] text-zinc-600 font-mono">${remStr}</div>
        </div>
      </div>
      <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-700"
             style="width:${pct.toFixed(1)}%;background:${barColor}"></div>
      </div>
    </button>
  `;
}

/* ─── Progresso do Objetivo (Sprint 7.1) ────────────────────────────── */

function renderGoalProgressCard(history, cardioHistory, goal) {
  if (!goal || history.length < 3) return '';

  const now            = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const thisMo = history.filter(h => new Date(h.date).getTime() >= thisMonthStart);
  const lastMo = history.filter(h => { const t = new Date(h.date).getTime(); return t >= lastMonthStart && t < thisMonthStart; });

  if (!thisMo.length) return '';

  const avgVol = arr => arr.length ? Math.round(arr.reduce((s, h) => s + (h.vol ?? 0), 0) / arr.length) : 0;

  const GOAL_CFG = {
    hipertrofia:     { icon: 'trending-up', color: 'text-green-400',  label: 'Hipertrofia',    getThis: () => avgVol(thisMo), getLast: () => avgVol(lastMo), metricLabel: 'vol. médio/sessão', fmt: v => `${(v/1000).toFixed(1)}t`, good: d => d >= 0 },
    emagrecimento:   { icon: 'flame',       color: 'text-orange-400', label: 'Emagrecimento',  getThis: () => thisMo.length,  getLast: () => lastMo.length,  metricLabel: 'sessões este mês',  fmt: v => `${v}×`,                  good: d => d >= 0 },
    recomposicao:    { icon: 'repeat',      color: 'text-blue-400',   label: 'Recomposição',   getThis: () => avgVol(thisMo), getLast: () => avgVol(lastMo), metricLabel: 'vol. médio/sessão', fmt: v => `${(v/1000).toFixed(1)}t`, good: d => d >= 0 },
    forca:           { icon: 'zap',         color: 'text-amber-400',  label: 'Força',          getThis: () => avgVol(thisMo), getLast: () => avgVol(lastMo), metricLabel: 'vol. médio/sessão', fmt: v => `${(v/1000).toFixed(1)}t`, good: d => d >= 0 },
    condicionamento: { icon: 'wind',        color: 'text-cyan-400',   label: 'Condicionamento',getThis: () => thisMo.length,  getLast: () => lastMo.length,  metricLabel: 'sessões este mês',  fmt: v => `${v}×`,                  good: d => d >= 0 },
  };

  const cfg = GOAL_CFG[goal];
  if (!cfg) return '';

  const vThis   = cfg.getThis();
  const vLast   = cfg.getLast();
  const delta   = vThis - vLast;
  const pct     = vLast > 0 ? Math.round(delta / vLast * 100) : null;
  const isGood  = cfg.good(delta);
  const arrow   = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const valColor = isGood ? cfg.color : 'text-rose-400';

  return `
    <button data-action="goto-tab" data-payload="evoluir"
            class="ripple-target w-full glass-card p-3.5 rounded-2xl border border-zinc-800/60 text-left active:scale-[0.98] transition-all">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="${cfg.icon}" class="w-4 h-4 ${cfg.color} shrink-0"></i>
          <div class="min-w-0">
            <div class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">${cfg.label} · ${cfg.metricLabel}</div>
            <div class="flex items-baseline gap-1.5 mt-0.5">
              <span class="text-sm font-black font-mono text-white">${cfg.fmt(vThis)}</span>
              ${vLast > 0 ? `<span class="text-[10px] font-bold ${valColor}">${arrow} ${pct !== null ? `${pct > 0 ? '+' : ''}${pct}%` : ''} vs mês ant.</span>` : `<span class="text-[9px] text-zinc-600">primeiro mês</span>`}
            </div>
          </div>
        </div>
        <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-700 shrink-0"></i>
      </div>
    </button>
  `;
}

/* ─── Volume por Grupo Muscular (Ciclo Atual) ───────────────────────── */

function renderMuscleVolumeCard(cycleDone, history, cycleStart, workouts) {
  if (!cycleDone?.length) return '';

  // Entradas do ciclo atual
  const cycleStartMs = cycleStart ? new Date(cycleStart).getTime() : 0;
  const cycleEntries = history
    .filter(h => cycleStart ? new Date(h.date).getTime() >= cycleStartMs : true)
    .filter(h => cycleDone.includes(h.workoutId));

  if (!cycleEntries.length) return '';

  // Conta sessões por grupo muscular
  const counts = {};
  cycleEntries.forEach(h => {
    const w = workouts.find(x => x.id === h.workoutId);
    (w?.muscleFocus ?? []).forEach(m => { counts[m] = (counts[m] ?? 0) + 1; });
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '';
  const max = entries[0][1];

  const MUSCLE_COLOR = {
    'Peito':   'bg-red-500',
    'Costas':  'bg-cyan-500',
    'Ombros':  'bg-blue-400',
    'Braços':  'bg-purple-400',
    'Pernas':  'bg-green-400',
    'Core':    'bg-amber-400',
    'Cardio':  'bg-sky-400',
  };

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/70">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-1.5">
          <i data-lucide="bar-chart-2" class="w-3.5 h-3.5 text-zinc-500"></i>
          <span class="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Volume — Ciclo Atual</span>
        </div>
        <span class="text-[9px] font-mono text-zinc-600">${cycleDone.length} treino${cycleDone.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="space-y-2">
        ${entries.map(([muscle, count]) => {
          const pct  = Math.round(count / max * 100);
          const barCls = MUSCLE_COLOR[muscle] ?? 'bg-zinc-500';
          return `
            <div class="flex items-center gap-2">
              <span class="text-[9px] font-bold text-zinc-400 w-16 shrink-0 truncate">${muscle}</span>
              <div class="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div class="h-full ${barCls} rounded-full transition-all duration-700" style="width:${pct}%"></div>
              </div>
              <span class="text-[9px] font-mono text-zinc-500 shrink-0 w-12 text-right">${count} sessão${count !== 1 ? 'ões' : ''}</span>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

/* ─── Quick Weight Widget ────────────────────────────────────────────── */

function renderQuickWeightWidget(bodyWeights, biometrics) {
  const last = bodyWeights?.[0];
  const lastVal  = last?.value ?? biometrics?.weight ?? null;
  const lastDate = last?.date  ?? biometrics?.date   ?? null;
  const daysAgo  = lastDate ? Math.floor((Date.now() - new Date(lastDate)) / 86400000) : null;
  const daysStr  = daysAgo === null ? '' : daysAgo === 0 ? 'hoje' : daysAgo === 1 ? 'ontem' : `há ${daysAgo}d`;

  return `
    <div class="glass-card p-3.5 rounded-2xl border border-zinc-800/70">
      <div class="flex items-center justify-between mb-2.5">
        <div class="flex items-center gap-1.5">
          <i data-lucide="dumbbell" class="w-3.5 h-3.5 text-zinc-500"></i>
          <span class="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Peso Corporal</span>
        </div>
        ${lastVal ? `<span class="text-[10px] font-mono text-zinc-400">${lastVal}kg <span class="text-zinc-700">${daysStr}</span></span>` : ''}
      </div>
      <div class="flex gap-2">
        <input id="home-weight-input" type="tel" inputmode="decimal"
               placeholder="${lastVal ? lastVal : 'kg'}"
               class="input-ninja flex-1 py-2.5 rounded-xl text-sm font-bold text-center" />
        <button data-action="quick-save-weight"
                class="ripple-target px-4 py-2.5 btn-akatsuki rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all whitespace-nowrap">
          Log
        </button>
      </div>
    </div>`;
}

/* ─── Render principal ─────────────────────────────────────────────── */

export function renderHome(state, workouts, protocols = []) {
  const {
    cycleDone = [], history, theme, workoutStartTime, workoutId,
    cycleGoal = 6, biometrics = null, bodyWeights = [], bioHistory = [],
    cycleOrder = [], cyclePosition = 0, cardioHistory = [],
    cardioCountsStreak = false, defaultCardioProtocol = 'zona2-30',
    prs = {}, achievements = [], cycleStart = null, completedCycles = 0,
    goal = null,
  } = state;

  const L         = getLabels(state.appMode);
  const weekCount = cycleDone.length;
  const now       = getNow(L);
  const quote     = getTimedQuote();
  const streak    = getStreak(history, cardioHistory, cardioCountsStreak);
  const chakra    = getChakraLevel(weekCount, cycleGoal, L);

  // Próximo treino: exclusivamente cycle-based — calendário nunca decide progressão
  let nextWorkout = null;
  let nextIsOff   = false;
  if (cycleOrder.length > 0) {
    const nextWId = cycleOrder[cyclePosition] ?? null;
    nextIsOff     = nextWId === null;
    nextWorkout   = nextWId ? workouts.find(w => w.id === nextWId && !w.isCardio) ?? null : null;
  }

  // Protocolo padrão de cardio
  const defaultProtocol = protocols.find(p => p.id === defaultCardioProtocol) ?? protocols[0] ?? null;

  const resumeBanner    = workoutStartTime && workoutId
    ? renderResumeBanner(workoutId, workoutStartTime, workouts)
    : '';
  const cycleBanner     = renderCycleCompleteBanner(weekCount, cycleGoal);
  const streakBanner    = !cycleBanner ? renderStreakRisk(streak, history, cardioHistory, cardioCountsStreak, L, nextIsOff) : '';
  const staleBanner     = !cycleBanner && !streakBanner && !nextIsOff ? renderStaleWeekBanner(cycleDone, history, cardioHistory) : '';
  const bioOverdueBannerHtml = !cycleBanner && !streakBanner && !staleBanner ? renderBioOverdueBanner(biometrics) : '';
  const onboardBanner   = renderOnboardingBanner(history, cycleDone, L);

  const insight         = generateInsight(state, workouts, streak);
  const insightHtml     = renderInsightCard(insight);
  const nextAchHtml     = renderNextAchievement({ history, achievements, cardioHistory, completedCycles }, streak);

  const segments = Array.from({ length: cycleGoal }, (_, i) => {
    const filled = i < weekCount;
    return `<div class="flex-1 h-1.5 rounded-full transition-all duration-700 ${filled ? `${chakra.barColor} shadow-[0_0_6px_var(--theme-primary)]` : 'bg-zinc-800'}"></div>`;
  }).join('');

  return `
    <div class="stagger-enter space-y-4 pb-4">

      <!-- Hero: Data + Saudação ──────────────────────────────────── -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/70 relative overflow-hidden">
        <div class="absolute right-2 top-2 opacity-[0.07] pointer-events-none">
          ${renderSharingan('w-20 h-20', false, theme)}
        </div>
        <div class="relative z-10 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 mb-1">
              <i data-lucide="${now.icon}" class="w-3.5 h-3.5 text-zinc-500 shrink-0"></i>
              <span class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">${now.text}</span>
            </div>
            <div class="text-4xl font-black font-mono text-white leading-none tracking-tighter">${now.hora}</div>
            <div class="text-[11px] text-zinc-400 font-medium mt-1.5">${now.dia}</div>
            <div class="text-[10px] text-zinc-600 font-mono">${now.data}</div>
          </div>
          <div class="w-12 h-12 rounded-full bg-theme-dim border border-theme-dim flex items-center justify-center shrink-0 shadow-[0_0_16px_var(--theme-dim)] mt-0.5">
            ${renderSharingan('w-7 h-7', true, theme)}
          </div>
        </div>
        <div class="mt-3 pt-3 border-t border-zinc-800/60">
          <p class="text-[11px] text-zinc-500 italic leading-relaxed">"${quote.text}"</p>
          ${quote.author ? `<p class="text-[10px] text-zinc-600 font-mono mt-1 text-right">— ${quote.author}</p>` : ''}
          ${goal ? (() => {
            const GOAL_CHIP = {
              hipertrofia:     { icon: 'trending-up', label: 'Hipertrofia',    cls: 'text-green-400  border-green-800/60  bg-green-900/10'  },
              emagrecimento:   { icon: 'flame',       label: 'Emagrecimento',  cls: 'text-orange-400 border-orange-800/60 bg-orange-900/10' },
              recomposicao:    { icon: 'repeat',      label: 'Recomposição',   cls: 'text-blue-400   border-blue-800/60   bg-blue-900/10'   },
              forca:           { icon: 'zap',         label: 'Força',          cls: 'text-amber-400  border-amber-800/60  bg-amber-900/10'  },
              condicionamento: { icon: 'wind',        label: 'Condicionamento',cls: 'text-cyan-400   border-cyan-800/60   bg-cyan-900/10'   },
            };
            const g = GOAL_CHIP[goal];
            return g ? `
              <div class="mt-2 flex items-center gap-1.5 w-fit">
                <div class="flex items-center gap-1 px-2 py-1 rounded-lg border ${g.cls}">
                  <i data-lucide="${g.icon}" class="w-3 h-3"></i>
                  <span class="text-[9px] font-bold uppercase tracking-wider">${g.label}</span>
                </div>
              </div>` : '';
          })() : ''}
        </div>
      </div>

      ${resumeBanner}
      ${cycleBanner}
      ${streakBanner}
      ${staleBanner}
      ${bioOverdueBannerHtml}
      ${onboardBanner}
      ${renderMissionBlock(nextWorkout, cycleDone, history, defaultProtocol, cardioHistory, workoutStartTime, L, nextIsOff)}
      ${insightHtml}
      ${renderGoalProgressCard(history, cardioHistory, goal)}

      <!-- Stats ──────────────────────────────────────────────────── -->
      <div class="grid grid-cols-3 gap-2">

        <button data-action="goto-tab" data-payload="treinar"
                class="ripple-target glass-card p-3 rounded-2xl border border-zinc-800/70 text-center relative overflow-hidden w-full active:scale-95 transition-all">
          <div class="absolute inset-0 ${weekCount >= cycleGoal ? 'bg-green-900/10' : ''} pointer-events-none"></div>
          <div class="text-[22px] font-black font-mono ${weekCount >= cycleGoal ? 'text-green-400' : 'text-white'} leading-none">
            ${weekCount}<span class="text-zinc-600 text-xs font-normal">/${cycleGoal}</span>
          </div>
          <div class="text-[9px] text-zinc-500 uppercase tracking-wider mt-1 font-bold">${L.progressLabel}</div>
          <div class="text-[8px] mt-0.5 font-bold ${weekCount >= cycleGoal ? 'text-green-500' : 'text-zinc-700'}">
            ${weekCount >= cycleGoal ? 'COMPLETA' : `${cycleGoal-weekCount} restante${cycleGoal-weekCount!==1?'s':''}`}
          </div>
        </button>

        <button data-action="goto-tab" data-payload="treinar"
                class="ripple-target glass-card p-3 rounded-2xl border border-zinc-800/70 text-center w-full active:scale-95 transition-all">
          <div class="text-[22px] font-black font-mono ${chakra.color} leading-none">
            ${chakra.pct}<span class="text-xs font-normal">%</span>
          </div>
          <div class="text-[9px] text-zinc-500 uppercase tracking-wider mt-1 font-bold">${L.chakra.label}</div>
          <div class="text-[8px] mt-0.5 font-bold ${chakra.color} truncate">${chakra.label}</div>
        </button>

        <button data-action="open-calendar"
                class="ripple-target glass-card p-3 rounded-2xl border border-zinc-800/70 text-center relative overflow-hidden w-full active:scale-95 transition-all">
          ${streak > 2 ? '<div class="absolute inset-0 bg-orange-900/10 pointer-events-none"></div>' : ''}
          <div class="text-[22px] font-black font-mono ${streak > 0 ? 'text-orange-400' : 'text-zinc-600'} leading-none">
            ${streak}
          </div>
          <div class="flex items-center justify-center gap-1 mt-1">
            <div class="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">${L.streakLabel}</div>
            <button data-action="show-hint" data-payload="streak"
                    class="w-3.5 h-3.5 rounded-full border border-zinc-700 text-zinc-600 flex items-center justify-center text-[8px] font-black leading-none hover:text-zinc-400 active:scale-90 transition-all pointer-events-auto"
                    onclick="event.stopPropagation()">i</button>
          </div>
          <div class="text-[8px] mt-0.5 font-bold ${streak > 2 ? 'text-orange-500' : 'text-zinc-700'}">
            ${streak === 0 ? 'INATIVO' : streak === 1 ? '1 DIA' : `${streak} DIAS 🔥`}
          </div>
        </button>
      </div>

      <!-- Progresso Semanal ──────────────────────────────────────── -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/70">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">${L.weekLabel}</span>
            <button data-action="show-hint" data-payload="cycles"
                    class="w-3.5 h-3.5 rounded-full border border-zinc-700 text-zinc-600 flex items-center justify-center text-[8px] font-black leading-none hover:text-zinc-400 active:scale-90 transition-all">i</button>
          </div>
          <span class="text-[10px] font-mono text-zinc-600">${weekCount}/${cycleGoal} ${L.weekUnit}</span>
        </div>
        <div class="flex gap-1">${segments}</div>
      </div>

      <!-- Próxima Conquista ──────────────────────────────────────── -->
      ${nextAchHtml}

      <!-- Volume por Grupo Muscular ──────────────────────────────── -->
      ${renderMuscleVolumeCard(cycleDone, history, cycleStart, workouts)}

      <!-- Atividade Recente ──────────────────────────────────────── -->
      ${renderRecentActivity(history, cardioHistory)}

      <!-- Última Evolução ────────────────────────────────────────── -->
      ${renderLastEvolution(history)}

      <!-- Meta de Peso ───────────────────────────────────────────── -->
      ${renderGoalGauge(bodyWeights, biometrics, bioHistory)}

      <!-- Registro Rápido de Peso ────────────────────────────────── -->
      ${renderQuickWeightWidget(bodyWeights, biometrics)}

    </div>
  `;
}

/* ─── Mount ─────────────────────────────────────────────────────────── */

export function mountHome(container, handler) {
  delegate(container, '[data-action="resume-workout"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('resume-workout', el.dataset.workoutId);
  });

  delegate(container, '[data-action="start-workout"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('start-workout', el.dataset.workoutId);
  });

  delegate(container, '[data-action="goto-workouts"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('goto-workouts');
  });

  delegate(container, '[data-action="register-off-day"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('register-off-day');
  });

  delegate(container, '[data-action="goto-profile"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('goto-profile');
  });

  delegate(container, '[data-action="start-new-week"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('start-new-week');
  });

  delegate(container, '[data-action="start-cardio-protocol"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('start-cardio-protocol', el.dataset.protocolId);
  });

  delegate(container, '[data-action="open-cardio-log"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('open-cardio-log');
  });

  delegate(container, '[data-action="open-calendar"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('open-calendar');
  });

  delegate(container, '[data-action="goto-tab"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('goto-tab', el.dataset.payload);
  });

  delegate(container, '[data-action="quick-save-weight"]', 'click', (e, el) => {
    createRipple(e, el);
    const input = container.querySelector('#home-weight-input');
    const val   = parseFloat(input?.value ?? '');
    if (!isNaN(val) && val > 0) {
      handler('quick-save-weight', val);
      if (input) input.value = '';
    }
  });
}
