import { delegate, createRipple, $ } from '../utils/dom.js';
import { formatDuration, formatVolume, parseTimedReps } from '../utils/format.js';
import { getExerciseMedia } from '../data/exerciseMedia.js';

/** Conta séries considerando override explícito (_c) ou chaves numéricas. */
export function countSets(exLogs = {}, defaultSets) {
  if (exLogs._c != null) return Math.max(1, exLogs._c);
  const keys = Object.keys(exLogs).map(Number).filter(n => Number.isInteger(n) && n >= 0);
  return keys.length ? Math.max(defaultSets, Math.max(...keys) + 1) : defaultSets;
}

/* ─── Feature: Detecção de Estagnação ─────────────────────────────────
   Retorna true se o exercício não teve aumento de carga em 3+ sessões.
   ─────────────────────────────────────────────────────────────────── */
function detectStagnation(workoutHistory, exId) {
  const sessions = workoutHistory
    .filter(h => Array.isArray(h.sets?.[exId]) && h.sets[exId].some(s => s.done && !s.warmup && s.w))
    .slice(0, 3);
  if (sessions.length < 3) return false;
  const maxW = sessions.map(h =>
    Math.max(...h.sets[exId].filter(s => s.done && !s.warmup && s.w).map(s => parseFloat(s.w)))
  );
  return maxW[0] <= maxW[1] && maxW[1] <= maxW[2];
}

/* ─── Feature: Sugestão de Carga ──────────────────────────────────────
   Analisa até 3 sessões anteriores do mesmo treino e calcula o peso
   alvo via progressão linear. Arredonda para 0.5kg.
   ─────────────────────────────────────────────────────────────────── */
function computeLoadTarget(workoutHistory, exId) {
  const sessions = workoutHistory
    .filter(h => h.sets?.[exId]?.some(s => s.done && !s.warmup && s.w))
    .slice(0, 3);
  if (!sessions.length) return null;

  const maxWeights = sessions.map(h =>
    Math.max(...h.sets[exId].filter(s => s.done && !s.warmup && s.w).map(s => parseFloat(s.w)))
  );

  const last = maxWeights[0];
  if (maxWeights.length < 2) return last;

  // Média das progressões entre sessões consecutivas (mais recente – anterior)
  let totalDelta = 0;
  for (let i = 0; i < maxWeights.length - 1; i++) {
    totalDelta += maxWeights[i] - maxWeights[i + 1];
  }
  const avgDelta = totalDelta / (maxWeights.length - 1);
  if (avgDelta <= 0) return last;

  return Math.round((last + avgDelta) * 2) / 2; // arredonda para 0.5kg
}

/* ─── Feature: Índice de Progressão ───────────────────────────────────
   Compara o maior peso da sessão atual com o da última sessão.
   Retorna um badge { text, color, bg } ou null se não houver dados.
   ─────────────────────────────────────────────────────────────────── */
function getProgressionBadge(exLogs, lastExSets = []) {
  const currWeights = Object.values(exLogs)
    .filter(s => s.done && s.w)
    .map(s => parseFloat(s.w))
    .filter(Boolean);
  if (!currWeights.length) return null;

  const lastWeights = lastExSets
    .filter(s => s?.done && s?.w)
    .map(s => parseFloat(s.w))
    .filter(Boolean);
  if (!lastWeights.length) return null;

  const diff = Math.max(...currWeights) - Math.max(...lastWeights);
  if (diff > 0) return { text: `↑ +${diff}kg`,  color: 'text-green-400', bg: 'bg-green-900/20 border-green-900/30' };
  if (diff < 0) return { text: `↓ ${diff}kg`,   color: 'text-red-400',   bg: 'bg-red-900/20 border-red-900/30'    };
  return               { text: '= Mantido',      color: 'text-zinc-400',  bg: 'bg-zinc-800 border-zinc-700'         };
}

/* ─── Contexto de Progressão: última sessão por exercício ─────────── */
function renderLastSessionContext(exSets, lastDate) {
  const done = (exSets ?? []).filter(s => s?.done && !s?.warmup && s?.w);
  if (!done.length || !lastDate) return null;
  const days = Math.floor((Date.now() - new Date(lastDate)) / 86400000);
  const timeAgo = days === 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`;
  return { done, timeAgo };
}

/* ─── Feature: Sugestão de carga baseada em 1RM + faixa de reps ───── */
function suggestWeight(pr, repsStr) {
  if (!pr) return null;
  const match = String(repsStr ?? '').match(/(\d+)(?:\s*[-–]\s*(\d+))?/);
  if (!match) return null;
  const lo  = parseInt(match[1]);
  const hi  = match[2] ? parseInt(match[2]) : lo;
  const tgt = Math.round((lo + hi) / 2);
  const oneRM = pr.weight * (1 + pr.reps / 30);
  const sug   = oneRM / (1 + tgt / 30);
  return Math.round(sug * 2) / 2; // arredonda para 0.5kg
}

/* ─── Linha de série ───────────────────────────────────────────────── */
function repsPresets(repsStr) {
  const nums = String(repsStr || '').match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return [6, 8, 10, 12];
  const lo = nums[0], hi = nums[1] ?? nums[0];
  return [...new Set([lo, hi, hi + 2, hi + 4].filter(n => n > 0 && n <= 50))].slice(0, 4);
}


function renderSetRow(wId, ex, idx, log = {}, lastSet = null) {
  const done      = log.done || false;
  const warmup    = log.warmup || false;
  const w         = parseFloat(log.w);
  const r         = parseFloat(log.r);
  const oneRM     = done && !warmup && w > 0 && r > 0 ? Math.round(w * (1 + r / 30)) : null;
  const presets   = repsPresets(ex.reps);
  const timedSec  = parseTimedReps(ex.reps);
  const isTimed   = timedSec !== null;
  const key       = `${wId}|${ex.id}|${idx}`;

  return `
    <div class="mb-3 last:mb-0${warmup ? ' opacity-70' : ''}" data-set-key="${key}"
         data-last-w="${lastSet?.w ?? ''}" data-last-r="${lastSet?.r ?? ''}">
      <div class="flex items-center gap-3">
        <button data-action="toggle-warmup" data-wid="${wId}" data-exid="${ex.id}" data-idx="${idx}"
                title="Série de aquecimento"
                class="w-8 h-8 flex items-center justify-center text-xs font-mono font-bold select-none transition-all active:scale-90 rounded
                       ${warmup ? 'text-yellow-500 bg-yellow-900/20' : 'text-zinc-600 hover:text-zinc-400'}">
          ${warmup ? 'W' : idx + 1}
        </button>

        ${isTimed ? `
        <!-- Timed exercise: no weight stepper, just the timer control -->
        <div class="flex-1 min-w-0" data-timed-reps="${key}">
          ${done ? `
            <div class="py-2 flex items-center justify-center gap-2">
              <i data-lucide="timer" class="w-4 h-4 text-green-500/70"></i>
              <span class="text-sm font-mono font-bold text-green-400">${timedSec}s ✓</span>
            </div>
          ` : `
            <button data-action="start-set-timer"
                    data-wid="${wId}" data-exid="${ex.id}" data-idx="${idx}"
                    data-seconds="${timedSec}" data-rest="${ex.rest ?? 60}"
                    class="ripple-target w-full py-3 rounded-xl bg-zinc-900/70 border border-zinc-700
                           text-theme-primary font-black text-sm flex items-center justify-center gap-2
                           active:scale-95 transition-all hover:border-theme-dim hover:bg-theme-dim/30">
              <i data-lucide="timer" class="w-4 h-4"></i> ${timedSec}s — Iniciar
            </button>
          `}
        </div>
        ` : `
        <!-- Normal exercise: weight stepper + reps input -->
        <div class="flex items-center gap-1">
          <button data-action="adjust-weight" data-payload="${key}|-2.5"
                  class="ripple-target w-8 h-10 rounded-lg bg-zinc-800/60 border border-zinc-700/50
                         text-zinc-500 hover:text-theme-primary hover:border-theme-dim
                         flex items-center justify-center font-bold transition-all active:scale-90
                         ${done ? 'opacity-30 pointer-events-none' : ''}"
                  ${done ? 'disabled' : ''}>−</button>
          <input
            type="text" inputmode="numeric"
            value="${log.w ?? ''}"
            placeholder="${lastSet?.w || 'KG'}"
            data-field="w" data-wid="${wId}" data-exid="${ex.id}" data-idx="${idx}"
            class="input-ninja w-14 min-w-0 py-3 rounded-lg text-sm font-bold text-center ${done ? 'opacity-30' : ''}"
            ${done ? 'disabled' : ''}
          />
          <button data-action="adjust-weight" data-payload="${key}|+2.5"
                  class="ripple-target w-8 h-10 rounded-lg bg-zinc-800/60 border border-zinc-700/50
                         text-zinc-500 hover:text-theme-primary hover:border-theme-dim
                         flex items-center justify-center font-bold transition-all active:scale-90
                         ${done ? 'opacity-30 pointer-events-none' : ''}"
                  ${done ? 'disabled' : ''}>+</button>
        </div>
        <input
          type="text" inputmode="numeric"
          value="${log.r ?? ''}"
          placeholder="${lastSet?.r || ex.reps}"
          data-field="r" data-wid="${wId}" data-exid="${ex.id}" data-idx="${idx}"
          class="input-ninja flex-1 min-w-0 py-3 rounded-lg text-sm text-center ${done ? 'opacity-30' : ''}"
          ${done ? 'disabled' : ''}
        />
        `}

        <button
          data-action="toggle-set"
          data-wid="${wId}" data-exid="${ex.id}" data-idx="${idx}" data-rest="${ex.rest ?? 60}"
          class="ripple-target shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90
                 ${done
                   ? 'bg-green-900/30 text-green-400 border-2 border-green-700/60 shadow-[0_0_12px_rgba(34,197,94,0.25)]'
                   : 'bg-zinc-900 text-zinc-200 border-2 border-zinc-500 hover:border-theme-primary hover:text-theme-primary'}"
        >
          <i data-lucide="${done ? 'check' : 'circle'}" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- Presets rápidos de reps (só para exercícios normais) -->
      ${!isTimed ? `
      <div data-reps-presets${done || warmup ? ' hidden' : ''}
           class="ml-9 mt-1.5 flex items-center gap-1.5">
        ${presets.map(n => `
          <button data-action="quick-reps" data-payload="${key}|${n}"
                  class="ripple-target text-[9px] font-mono font-bold text-zinc-600
                         hover:text-theme-primary hover:border-theme-dim
                         border border-zinc-800 rounded px-2 py-0.5
                         transition-all active:scale-90">
            ${n}
          </button>`).join('')}
        <span class="text-[8px] text-zinc-700 ml-0.5">reps</span>
      </div>` : ''}

      ${oneRM ? `
        <div class="ml-9 mt-1 flex items-center gap-1">
          <i data-lucide="zap" class="w-2.5 h-2.5 text-yellow-600"></i>
          <span class="text-[9px] font-mono font-bold text-yellow-600/80">1RM estimado: ~${oneRM}kg</span>
        </div>` : ''}

      <!-- RPE chips (visível só quando done, não-timed) -->
      ${!isTimed ? `
      <div data-rpe-row="${key}" class="${done && !warmup ? 'flex' : 'hidden'} ml-9 mt-1.5 items-center gap-1.5 flex-wrap">
        <span class="text-[8px] text-zinc-700 font-bold uppercase tracking-wider mr-0.5">RPE</span>
        ${[6,7,8,9,10].map(n => `
          <button data-action="set-rpe" data-payload="${key}|${n}" data-rpe-val="${n}"
                  class="ripple-target text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border transition-all active:scale-90
                         ${(log.rpe ?? null) === n
                           ? 'bg-theme-dim border-theme-accent text-theme-primary'
                           : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-600 hover:text-zinc-400'}">
            ${n}
          </button>`).join('')}
        ${log.rpe ? `<span class="text-[8px] text-zinc-600 ml-0.5 font-bold">${log.rpe >= 10 ? 'máximo' : log.rpe >= 9 ? 'muito pesado' : log.rpe >= 8 ? 'pesado' : log.rpe >= 7 ? 'moderado' : 'fácil'}</span>` : ''}
      </div>` : ''}
    </div>
  `;
}

/* ─── Card de exercício ────────────────────────────────────────────── */
function renderExerciseCard(wId, ex, idx, wLogs, lastSets, prs, loadTarget = null, lastDate = null, exNote = '', stagnant = false) {
  const exLogs    = wLogs[ex.id] ?? {};
  const sets      = countSets(exLogs, ex.sets);
  const doneCount = Object.values(exLogs).filter(s => s.done).length;
  const allDone   = doneCount >= sets;
  const pr        = prs[ex.id];
  const lastCtx   = renderLastSessionContext(lastSets[ex.id], lastDate);
  const oneRM     = pr ? Math.round(pr.weight * (1 + pr.reps / 30)) : null;
  const suggested = (pr && ex.reps) ? suggestWeight(pr, ex.reps) : null;
  const prog      = getProgressionBadge(exLogs, lastSets[ex.id] ?? []);

  // Delta para o chip de meta: diferença entre loadTarget e último peso
  const lastExSets = lastSets[ex.id] ?? [];
  const lastMaxW = lastExSets.length
    ? Math.max(0, ...lastExSets.filter(s => s?.done && s?.w).map(s => parseFloat(s.w)).filter(Boolean))
    : 0;
  const targetDelta = loadTarget && lastMaxW > 0 && loadTarget > lastMaxW
    ? +(loadTarget - lastMaxW).toFixed(1) : null;

  let rows = '';
  for (let i = 0; i < sets; i++) {
    rows += renderSetRow(wId, ex, i, exLogs[i], (lastSets[ex.id] ?? [])[i]);
  }

  return `
    <div
      class="glass-card p-5 rounded-2xl stagger-enter transition-all duration-500 border
             ${allDone ? 'border-green-900/30 opacity-60' : 'border-theme-dim'}"
      data-exercise-card="${wId}|${ex.id}"
      style="animation-delay: ${idx * 80}ms"
    >
      <!-- cabeçalho -->
      <div class="flex justify-between items-start mb-4">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-theme-dim to-black border border-theme-dim
                      flex items-center justify-center text-theme-primary shadow-lg shrink-0">
            <i data-lucide="${ex.icon || 'activity'}" class="w-5 h-5"></i>
          </div>
          <div class="min-w-0 flex-1">

            <!-- Nome + badges: PR (com 1RM) e Progressão -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <button data-action="open-exercise-detail" data-ex-id="${ex.id}" data-ex-name="${ex.name}"
                      class="ripple-target font-bold text-sm leading-tight ${allDone ? 'text-green-400' : 'text-white'}
                             text-left active:opacity-70 transition-opacity">${ex.name}</button>
              ${(() => {
                const hasMedia = !!getExerciseMedia(ex.name);
                return `<button data-action="open-exercise-demo" data-ex-id="${ex.id}" data-ex-name="${ex.name}"
                      title="${hasMedia ? 'Ver demonstração' : 'Sem demonstração — adicione um WebM'}"
                      class="w-5 h-5 rounded-full border flex items-center justify-center active:scale-90 transition-all shrink-0
                             ${hasMedia
                               ? 'bg-theme-dim/70 border-theme-accent/50 text-theme-primary/80 hover:text-theme-primary hover:bg-theme-dim'
                               : 'bg-zinc-800/40 border-zinc-700/30 text-zinc-700 hover:text-zinc-500'}">
                  <i data-lucide="zap" class="w-2.5 h-2.5"></i>
                </button>`;
              })()}

              ${pr ? `
                <span class="text-[9px] font-bold text-yellow-400 bg-yellow-900/20 border border-yellow-900/30 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                  <i data-lucide="trophy" class="w-2.5 h-2.5"></i> ${pr.weight}kg
                  <span class="text-yellow-700/80 ml-0.5">~${oneRM}RM</span>
                </span>` : ''}

              ${stagnant ? `
                <span class="text-[9px] font-bold text-amber-400 bg-amber-900/20 border border-amber-900/30 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                  <i data-lucide="alert-triangle" class="w-2.5 h-2.5"></i> Carga estagnada
                </span>` : ''}

              <span data-progression="${wId}|${ex.id}"
                    class="${prog ? `text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${prog.color} ${prog.bg}` : 'hidden'}">
                ${prog?.text ?? ''}
              </span>
            </div>

            <!-- Nota técnica -->
            ${ex.note ? `
              <div class="text-[10px] text-yellow-500/80 mt-0.5 font-bold flex items-center gap-1">
                <i data-lucide="zap" class="w-3 h-3"></i> ${ex.note}
              </div>` : ''}

            <!-- Banner de foco de assimetria -->
            ${ex.asymmetryFocus ? `
              <div class="mt-1.5 px-2 py-1 bg-amber-950/40 border border-amber-800/30 rounded-lg flex items-center gap-1.5">
                <i data-lucide="alert-triangle" class="w-3 h-3 text-amber-500 shrink-0"></i>
                <p class="text-[9px] text-amber-300/80 font-bold">Foco no lado ${ex.asymmetryFocus} — déficit de 1,5cm (coxa D/E)</p>
              </div>` : ''}

            <!-- Contexto de Progressão: última sessão -->
            ${lastCtx ? `
              <div class="mt-2 px-2.5 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
                <div class="flex items-center justify-between gap-2 mb-1">
                  <span class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    <i data-lucide="history" class="w-3 h-3"></i>
                    Última · ${lastCtx.timeAgo}
                  </span>
                  <button data-action="auto-fill" data-wid="${wId}" data-exid="${ex.id}"
                          class="text-[9px] font-bold text-theme-primary/70 hover:text-theme-primary
                                 flex items-center gap-1 active:scale-90 transition-all
                                 bg-theme-dim/60 px-2 py-0.5 rounded-lg border border-theme-dim/40">
                    <i data-lucide="copy" class="w-2.5 h-2.5"></i> Repetir
                  </button>
                </div>
                <div class="flex items-center gap-x-3 flex-wrap">
                  ${lastCtx.done.map((s, i) => `
                    <span class="text-[11px] font-mono font-bold text-zinc-300">
                      <span class="text-zinc-600 text-[9px] mr-0.5">${i + 1}×</span>${s.w}<span class="text-zinc-600">kg</span>
                      <span class="text-zinc-700 mx-0.5">·</span>${s.r}<span class="text-zinc-600">rep</span>
                    </span>`).join('')}
                </div>
              </div>` : ''}

            <!-- Meta de carga / sugestão -->
            ${loadTarget || suggested ? `
              <div class="mt-1.5 flex items-center gap-2 flex-wrap">
                ${loadTarget ? `
                  <div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border bg-theme-dim/60 border-theme-dim text-theme-primary">
                    <i data-lucide="target" class="w-2.5 h-2.5"></i>
                    ${loadTarget}kg
                    ${targetDelta ? `<span class="text-theme-primary/50 font-normal ml-0.5">+${targetDelta}</span>` : ''}
                  </div>` : `
                  <div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border bg-zinc-800/60 border-zinc-700/60 text-zinc-400">
                    <i data-lucide="cpu" class="w-2.5 h-2.5"></i>
                    ~${suggested}kg${ex.reps ? ` · ${ex.reps}` : ''}
                  </div>`}
                <button data-action="show-hint" data-payload="progressive_overload"
                        class="w-3 h-3 rounded-full border border-zinc-700 text-zinc-600 flex items-center justify-center text-[7px] font-black leading-none active:scale-90 transition-all">i</button>
                <button data-action="open-warmup" data-wid="${wId}" data-exid="${ex.id}"
                        data-weight="${loadTarget || suggested}" data-reps="${ex.reps || ''}"
                        title="Aquecimento sugerido"
                        class="w-5 h-5 rounded-full border border-orange-900/40 bg-orange-950/30 text-orange-500/70 flex items-center justify-center active:scale-90 transition-all">
                  <i data-lucide="flame" class="w-2.5 h-2.5"></i>
                </button>
              </div>` : ''}

          </div>
        </div>

        <!-- Botão pular exercício -->
        <button data-action="toggle-skip-exercise" data-wid="${wId}" data-exid="${ex.id}"
                title="${exLogs._skip ? 'Retomar exercício' : 'Pular exercício'}"
                class="ripple-target ml-auto w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                       ${exLogs._skip ? 'bg-red-900/30 border border-red-800/50 text-red-400' : 'bg-zinc-800/40 border border-zinc-700/40 text-zinc-600'}
                       active:scale-90 transition-all">
          <i data-lucide="${exLogs._skip ? 'rotate-ccw' : 'x'}" class="w-3 h-3"></i>
        </button>

        <!-- Botão de nota rápida -->
        <button data-action="open-ex-note" data-exid="${ex.id}" data-wid="${wId}"
                class="ripple-target ml-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                       ${exNote ? 'bg-amber-900/30 border border-amber-800/50 text-amber-400' : 'bg-zinc-800/40 border border-zinc-700/40 text-zinc-600'}
                       active:scale-90 transition-all">
          <i data-lucide="pencil" class="w-3 h-3"></i>
        </button>

        <!-- Lado direito: contador de progresso + controles de séries -->
        <div class="flex flex-col items-end gap-1 shrink-0 ml-2">
          ${doneCount > 0 && !allDone
            ? `<div class="text-[10px] font-mono font-bold text-theme-primary/80 bg-theme-dim px-2 py-0.5 rounded-full border border-theme-dim"
                    data-progress="${wId}|${ex.id}">
                 ${doneCount}/${sets}
               </div>`
            : allDone
              ? `<div class="text-[10px] font-bold text-green-400 flex items-center gap-1"
                      data-progress="${wId}|${ex.id}">
                   <i data-lucide="check-circle" class="w-3 h-3"></i> COMPLETO
                 </div>`
              : `<div data-progress="${wId}|${ex.id}" class="hidden"></div>`}

          ${!allDone ? `
          <div class="flex flex-col items-end gap-0.5">
            <div class="text-[7px] text-zinc-700 font-bold uppercase tracking-wider">Séries</div>
            <div class="flex items-center gap-0.5 bg-black/40 rounded-lg p-1 border border-zinc-800"
                 data-sets-ctrl="${wId}|${ex.id}">
              <button data-action="mod-sets" data-wid="${wId}" data-exid="${ex.id}" data-delta="-1"
                      title="Remover série"
                      class="w-10 h-10 flex items-center justify-center text-zinc-500 hover:bg-zinc-800 rounded-md active:scale-90 text-xl font-bold">−</button>
              <span class="text-xs font-mono w-6 text-center font-bold text-white" data-sets-label="${wId}|${ex.id}">${sets}</span>
              <button data-action="mod-sets" data-wid="${wId}" data-exid="${ex.id}" data-delta="1"
                      title="Adicionar série"
                      class="w-10 h-10 flex items-center justify-center text-white hover:bg-zinc-800 rounded-md active:scale-90 text-xl font-bold">+</button>
            </div>
          </div>` : ''}
        </div>
      </div>

      <!-- Nota rápida do exercício -->
      <div id="ex-note-${ex.id}" class="${exNote ? '' : 'hidden'}">
        ${exNote ? `
        <div class="mx-0 mb-2 px-3 py-1.5 bg-amber-950/30 border border-amber-900/30 rounded-lg flex items-start gap-2">
          <i data-lucide="pencil" class="w-3 h-3 text-amber-600 shrink-0 mt-0.5"></i>
          <p class="text-[10px] text-amber-300/80 leading-relaxed flex-1 min-w-0">${exNote}</p>
        </div>` : ''}
      </div>

      <!-- Badge PULADO (visível só quando exercício for pulado) -->
      ${exLogs._skip ? `
      <div class="flex items-center justify-center gap-2 py-3 text-red-400/70 border border-dashed border-red-900/40 rounded-xl">
        <i data-lucide="x" class="w-4 h-4"></i>
        <span class="text-xs font-black tracking-widest uppercase">Pulado</span>
      </div>` : ''}

      <!-- Labels + séries (oculto quando pulado) -->
      <div data-sets-section="${wId}|${ex.id}" class="${exLogs._skip ? 'hidden' : ''}">
        ${parseTimedReps(ex.reps) !== null ? `
        <div class="flex items-center gap-3 mb-2" data-set-labels>
          <div class="w-8 text-center text-[8px] text-zinc-700 font-bold uppercase" title="Série">SÉR.</div>
          <div class="flex-1 text-center text-[9px] text-zinc-600 uppercase tracking-wider font-bold">TEMPO</div>
          <div class="w-12 text-center text-[8px] text-zinc-700 font-bold uppercase">OK</div>
        </div>` : `
        <div class="flex items-center gap-3 mb-2" data-set-labels>
          <div class="w-8 text-center text-[8px] text-zinc-700 font-bold uppercase" title="Série (toque para marcar aquecimento)">SÉR.</div>
          <div class="w-20 text-center text-[9px] text-zinc-600 uppercase tracking-wider font-bold">PESO (kg)</div>
          <div class="flex-1 text-center text-[9px] text-zinc-600 uppercase tracking-wider font-bold">REPS</div>
          <div class="w-12 text-center text-[8px] text-zinc-700 font-bold uppercase">OK</div>
        </div>`}

        <!-- Séries -->
        <div data-sets-container="${wId}|${ex.id}">
          ${rows}
        </div>
      </div>
    </div>
  `;
}

/* ─── View principal ───────────────────────────────────────────────── */

export function renderWorkout(state, workout) {
  const { logs, history, prs } = state;
  const wLogs       = logs[workout.id] ?? {};
  const lastSession = history.find(h => h.workoutId === workout.id);
  const lastSets    = lastSession?.sets ?? {};

  // Feature: Sugestão de Carga + Estagnação — pré-computa para todos os exercícios
  const workoutHistory = history.filter(h => h.workoutId === workout.id);
  const loadTargets    = {};
  const stagnationFlags = {};
  workout.exercises.forEach(ex => {
    loadTargets[ex.id]    = computeLoadTarget(workoutHistory, ex.id);
    stagnationFlags[ex.id] = detectStagnation(workoutHistory, ex.id);
  });

  // Progresso geral
  const totalEx = workout.exercises.length;
  let totalSetsInit = 0, doneSetsInit = 0;
  const doneEx  = workout.exercises.filter(ex => {
    const exLogs = wLogs[ex.id] ?? {};
    const sets   = countSets(exLogs, ex.sets);
    totalSetsInit += sets;
    doneSetsInit  += Object.values(exLogs).filter(s => s.done).length;
    return sets > 0 && Object.values(exLogs).filter(s => s.done).length >= sets;
  }).length;
  const progressPct = totalEx > 0 ? Math.round((doneEx / totalEx) * 100) : 0;
  const elapsed = state.workoutStartTime
    ? Math.round((Date.now() - state.workoutStartTime) / 60000)
    : 0;

  // Volume ao vivo: soma séries concluídas não-warmup
  let liveVol = 0;
  workout.exercises.forEach(ex => {
    Object.values(wLogs[ex.id] ?? {}).forEach(s => {
      if (s.done && !s.warmup) {
        const w = parseFloat(s.w), r = parseFloat(s.r);
        if (w && r) liveVol += w * r;
      }
    });
  });
  const lastVol = lastSession?.vol ?? 0;

  const hasLastSession = history.some(h => h.workoutId === workout.id);

  return `
    <div class="stagger-enter space-y-6">
      <div class="border-l-4 border-theme-accent pl-4 py-2 bg-gradient-to-r from-theme-dim to-transparent">
        <div class="flex items-start justify-between">
          <h1 class="text-3xl font-black uppercase italic tracking-tighter text-white">${workout.title}</h1>
          <div class="flex items-center gap-2 shrink-0 ml-2 mt-1">
            <span id="workout-ex-counter" class="text-xs font-mono text-zinc-500">${doneEx}/${totalEx} · ${doneSetsInit}/${totalSetsInit}s</span>
            <button data-action="navigate-from-workout" data-payload="treinar"
                    title="Pausar e voltar ao dashboard"
                    class="ripple-target flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-700/50
                           text-zinc-600 text-[9px] font-bold hover:text-zinc-400 hover:border-zinc-600
                           active:scale-90 transition-all whitespace-nowrap">
              <i data-lucide="chevron-left" class="w-3 h-3"></i> Pausar
            </button>
          </div>
        </div>
        <p class="text-xs text-theme-primary font-mono tracking-widest uppercase flex items-center gap-2 mt-1">
          <span class="w-2 h-2 bg-theme-primary rounded-full animate-pulse inline-block"></span>
          Sistema Ativo
          <span class="text-zinc-600">·</span>
          <span class="text-zinc-600 text-[10px] uppercase font-bold tracking-widest">treino</span>
          <span id="elapsed-workout" class="text-zinc-400 normal-case tracking-normal font-mono">${elapsed > 0 ? formatDuration(elapsed) : '0 min'}</span>
        </p>
        <div class="h-1 bg-zinc-800 rounded-full overflow-hidden mt-2">
          <div id="workout-progress-bar"
               class="h-full bg-theme-primary rounded-full transition-all duration-700 shadow-[0_0_6px_var(--theme-primary)]"
               style="width:${progressPct}%"></div>
        </div>
        <div id="workout-live-vol" class="mt-2 flex items-center gap-3 min-h-[24px]">
          ${liveVol > 0 ? `
            <div>
              <div class="flex items-center gap-1">
                <div class="text-[8px] text-zinc-600 uppercase tracking-widest font-bold">Volume</div>
                <button data-action="show-hint" data-payload="volume"
                        class="w-3 h-3 rounded-full border border-zinc-700 text-zinc-600 flex items-center justify-center text-[7px] font-black leading-none active:scale-90 transition-all">i</button>
              </div>
              <div class="text-base font-black font-mono text-white leading-none">${formatVolume(liveVol)}</div>
            </div>
            ${lastVol > 0 ? `
            <div class="text-[10px] font-mono leading-tight ${liveVol >= lastVol ? 'text-green-400' : 'text-zinc-600'}">
              ${liveVol >= lastVol
                ? `↑ +${formatVolume(liveVol - lastVol)} superou!`
                : `${formatVolume(lastVol - liveVol)} para superar`}
            </div>` : ''}
          ` : ''}
        </div>
        ${hasLastSession ? `
        <div class="flex justify-end">
          <button data-action="auto-fill-all" data-payload="${workout.id}"
                  class="ripple-target flex items-center gap-1.5 text-[9px] font-mono font-bold
                         text-zinc-600 hover:text-theme-primary transition-all active:scale-90">
            <i data-lucide="copy" class="w-3 h-3"></i>Repetir sessão anterior
          </button>
        </div>` : ''}
        ${state.activeCommute?.enabled ? (() => {
          const ac = state.activeCommute;
          const weightKg    = state.biometrics?.weight ?? 80;
          const returnMode  = state.commuteReturnOverride?.mode ?? ac.mode;
          const goIcon      = ac.mode === 'bike' ? 'activity' : ac.mode === 'run' ? 'zap' : 'move';
          const labels      = { walk: 'pé', run: 'correr', bike: 'bike' };
          const MET_MAP     = { walk: 3.5, run: 7.0, bike: 6.0 };
          const SPEED_MAP   = { walk: 4.8, run: 8.0, bike: 15.0 };

          const goMET      = MET_MAP[ac.mode]   ?? 3.5;
          const goDuration = Math.round((ac.oneWayDistanceKm / ac.estimatedSpeed) * 60);
          const goCal      = Math.round(goMET * weightKg * (goDuration / 60));

          const retSpeed   = returnMode === ac.mode ? ac.estimatedSpeed : (SPEED_MAP[returnMode] ?? 4.8);
          const retMET     = MET_MAP[returnMode] ?? 3.5;
          const retDuration = Math.round((ac.oneWayDistanceKm / retSpeed) * 60);
          const retCal      = Math.round(retMET * weightKg * (retDuration / 60));

          const totalMin = goDuration + retDuration;
          const totalCal = goCal + retCal;

          const chips = ['walk', 'run', 'bike'].map(m => `
            <button data-action="set-commute-return" data-payload="${m}"
                    class="text-[9px] px-2 py-1 rounded-lg border font-bold transition-all active:scale-90
                           ${returnMode === m
                             ? 'bg-cyan-900/40 border-cyan-700/60 text-cyan-300'
                             : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-400'}">
              ${labels[m]}
            </button>`).join('');

          return `
          <div id="workout-commute-line" class="mt-3 rounded-xl border border-cyan-900/30 bg-gradient-to-r from-cyan-950/30 to-transparent px-3 py-2.5">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Ida</span>
                <i data-lucide="${goIcon}" class="w-3 h-3 text-cyan-600/80"></i>
                <span class="text-[10px] font-bold font-mono text-cyan-400">${ac.oneWayDistanceKm}km · ~${goDuration}min</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Volta</span>
                <div class="flex gap-1">${chips}</div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-cyan-900/20">
              <i data-lucide="timer" class="w-3 h-3 text-zinc-600 shrink-0"></i>
              <span class="text-[9px] font-mono text-zinc-400">~${totalMin}min · ~${totalCal}kcal</span>
              <span class="text-[8px] text-zinc-700 ml-1">estimado</span>
              ${returnMode !== ac.mode ? `<span class="text-[8px] text-cyan-700/70 ml-auto font-bold">volta: ${labels[returnMode]}</span>` : ''}
            </div>
          </div>`;
        })() : ''}
      </div>

      <div class="space-y-4">
        ${workout.exercises.map((ex, i) =>
          renderExerciseCard(workout.id, ex, i, wLogs, lastSets, prs, loadTargets[ex.id], lastSession?.date, state.exerciseNotes?.[workout.id]?.[ex.id] ?? '', stagnationFlags[ex.id] ?? false)
        ).join('')}
      </div>

      <div class="pt-4 pb-4 space-y-3">
        <button
          data-action="finish-workout"
          class="ripple-target w-full py-4 rounded-2xl bg-theme-primary text-black text-sm font-black
                 uppercase flex items-center justify-center gap-2 active:scale-95
                 shadow-[0_0_20px_var(--theme-primary)] transition-all"
        >
          <i data-lucide="check-circle" class="w-5 h-5"></i> Finalizar Treino
        </button>
        <button
          data-action="reset-workout" data-wid="${workout.id}"
          class="ripple-target w-full py-3 rounded-xl border border-zinc-800 text-zinc-600 text-xs font-bold
                 uppercase hover:border-theme-dim hover:text-theme-primary transition-colors flex items-center justify-center gap-2 active:scale-95"
        >
          <i data-lucide="refresh-cw" class="w-4 h-4"></i> Reiniciar Protocolo
        </button>
      </div>
    </div>
  `;
}

/* ─── Patches cirúrgicos (sem re-render total) ─────────────────────── */

export function patchSetRow(wId, exId, idx, log, ex, vibrationEnabled = true, pr = null) {
  const row = $(`[data-set-key="${wId}|${exId}|${idx}"]`);
  if (!row) return;

  const done   = log.done || false;
  const warmup = log.warmup || false;

  // Warmup row styling
  row.classList.toggle('opacity-70', warmup);

  // Warmup button
  const warmupBtn = row.querySelector('[data-action="toggle-warmup"]');
  if (warmupBtn) {
    warmupBtn.className = `w-8 h-8 flex items-center justify-center text-xs font-mono font-bold select-none transition-all active:scale-90 rounded ${
      warmup ? 'text-yellow-500 bg-yellow-900/20' : 'text-zinc-600 hover:text-zinc-400'
    }`;
    warmupBtn.textContent = warmup ? 'W' : String(idx + 1);
  }

  const inputs = row.querySelectorAll('input');
  // Sincroniza valores da store → DOM quando set não está ativo (pré-preenchimento da série anterior)
  if (!done) {
    if (inputs[0] && document.activeElement !== inputs[0] && log.w != null && log.w !== '')
      inputs[0].value = log.w;
    if (inputs[1] && document.activeElement !== inputs[1] && log.r != null && log.r !== '')
      inputs[1].value = log.r;
  }
  inputs.forEach(inp => {
    inp.disabled = done;
    inp.classList.toggle('opacity-30', done);
  });
  // Toggle steppers
  row.querySelectorAll('[data-action="adjust-weight"]').forEach(b => {
    b.disabled = done;
    b.classList.toggle('opacity-30', done);
    b.classList.toggle('pointer-events-none', done);
  });

  const btn = row.querySelector('[data-action="toggle-set"]');
  if (!btn) return;
  const wasDone = btn.classList.contains('text-green-400') || btn.dataset.undoWindow === '1';
  btn.className = `ripple-target shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
    done
      ? 'bg-green-900/30 text-green-400 border-2 border-green-700/60 shadow-[0_0_12px_rgba(34,197,94,0.25)]'
      : 'bg-zinc-900 text-zinc-200 border-2 border-zinc-500 hover:border-theme-primary hover:text-theme-primary'
  }`;
  btn.innerHTML = `<i data-lucide="${done ? 'check' : 'circle'}" class="w-5 h-5"></i>`;
  if (!done) delete btn.dataset.undoWindow;
  if (window.lucide) lucide.createIcons({ nodes: [btn] });

  // Toggle reps presets visibility
  const presetsEl = row.querySelector('[data-reps-presets]');
  if (presetsEl) presetsEl.hidden = done || warmup;

  // Timed exercise: update display when done state changes
  const timedArea = row.querySelector('[data-timed-reps]');
  if (timedArea && ex) {
    const timedSec = parseTimedReps(ex.reps);
    if (timedSec !== null) {
      if (done) {
        timedArea.innerHTML = `
          <div class="py-2 flex items-center justify-center gap-2">
            <i data-lucide="timer" class="w-4 h-4 text-green-500/70"></i>
            <span class="text-sm font-mono font-bold text-green-400">${timedSec}s ✓</span>
          </div>`;
        if (window.lucide) lucide.createIcons({ nodes: [timedArea] });
      } else if (!timedArea.querySelector('[data-action="start-set-timer"]') && !timedArea.querySelector('[data-timer-display]')) {
        // Restore start button if area is empty (e.g. after undo)
        timedArea.innerHTML = `
          <button data-action="start-set-timer"
                  data-wid="${wId}" data-exid="${exId}" data-idx="${idx}"
                  data-seconds="${timedSec}" data-rest="${ex.rest ?? 60}"
                  class="ripple-target w-full py-3 rounded-xl bg-zinc-900/70 border border-zinc-700
                         text-theme-primary font-black text-sm flex items-center justify-center gap-2
                         active:scale-95 transition-all hover:border-theme-dim hover:bg-theme-dim/30">
            <i data-lucide="timer" class="w-4 h-4"></i> ${timedSec}s — Iniciar
          </button>`;
        if (window.lucide) lucide.createIcons({ nodes: [timedArea] });
      }
    }
  }

  if (done && !wasDone && !warmup) {
    if (vibrationEnabled) navigator.vibrate?.(45);
    btn.classList.add('set-done-pop');
    // Após animação: janela de desfazer de 3s (botão ↩)
    setTimeout(() => {
      btn.classList.remove('set-done-pop');
      btn.className = `ripple-target shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 bg-rose-900/30 text-rose-400 border-2 border-rose-700/50`;
      btn.innerHTML = `<i data-lucide="rotate-ccw" class="w-4 h-4"></i>`;
      btn.dataset.undoWindow = '1';
      if (window.lucide) lucide.createIcons({ nodes: [btn] });
    }, 400);
    // Auto-scroll para próxima série pendente
    setTimeout(() => {
      const allRows = [...document.querySelectorAll('[data-set-key]')];
      const thisIdx = allRows.indexOf(row);
      const next = allRows.slice(thisIdx + 1).find(r => {
        const b = r.querySelector('[data-action="toggle-set"]');
        return b && !b.classList.contains('text-green-500') && !b.dataset.undoWindow;
      });
      if (next) next.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 420);
  } else if (!done && wasDone) {
    if (vibrationEnabled) navigator.vibrate?.(20);
  }

  // RPE row: toggle visibility + atualiza chip ativo
  const rpeRow = row.querySelector('[data-rpe-row]');
  if (rpeRow) {
    if (done && !warmup) {
      rpeRow.classList.remove('hidden');
      rpeRow.classList.add('flex');
      const activeRpe = log.rpe ?? null;
      rpeRow.querySelectorAll('[data-rpe-val]').forEach(btn => {
        const n = parseInt(btn.dataset.rpeVal);
        btn.className = `ripple-target text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border transition-all active:scale-90 ${
          activeRpe === n
            ? 'bg-theme-dim border-theme-accent text-theme-primary'
            : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-600 hover:text-zinc-400'
        }`;
      });
      // Atualiza label de intensidade
      let labelEl = rpeRow.querySelector('[data-rpe-label]');
      if (activeRpe) {
        const lbl = activeRpe >= 10 ? 'máximo' : activeRpe >= 9 ? 'muito pesado' : activeRpe >= 8 ? 'pesado' : activeRpe >= 7 ? 'moderado' : 'fácil';
        if (!labelEl) {
          labelEl = document.createElement('span');
          labelEl.setAttribute('data-rpe-label', '');
          labelEl.className = 'text-[8px] text-zinc-600 ml-0.5 font-bold';
          rpeRow.appendChild(labelEl);
        }
        labelEl.textContent = lbl;
      } else if (labelEl) {
        labelEl.remove();
      }
    } else {
      rpeRow.classList.remove('flex');
      rpeRow.classList.add('hidden');
    }
  }

  // Update 1RM line
  const w = parseFloat(log.w);
  const r = parseFloat(log.r);
  const oneRM = done && !warmup && w > 0 && r > 0 ? Math.round(w * (1 + r / 30)) : null;
  let oneRMEl = row.querySelector('[data-1rm]');
  if (oneRM) {
    if (!oneRMEl) {
      oneRMEl = document.createElement('div');
      oneRMEl.setAttribute('data-1rm', '');
      oneRMEl.className = 'ml-9 mt-1 flex items-center gap-1';
      row.appendChild(oneRMEl);
    }
    oneRMEl.innerHTML = `<i data-lucide="zap" class="w-2.5 h-2.5 text-yellow-600"></i><span class="text-[9px] font-mono font-bold text-yellow-600/80">1RM estimado: ~${oneRM}kg</span>`;
    if (window.lucide) lucide.createIcons({ nodes: [oneRMEl] });
  } else if (oneRMEl) {
    oneRMEl.remove();
  }

  // Compare hint vs última sessão (aparece em tempo real enquanto digita)
  const lastW  = parseFloat(row.dataset.lastW);
  const curW   = parseFloat(log.w);
  const lastR  = parseFloat(row.dataset.lastR);
  const curR   = parseFloat(log.r);
  let hintEl = row.querySelector('[data-compare-hint]');

  if (!done && !warmup && lastW > 0 && curW > 0) {
    const wDelta = parseFloat((curW - lastW).toFixed(1));
    const fmtN   = n => n % 1 === 0 ? String(Math.abs(n)) : Math.abs(n).toFixed(1);
    let text, cls;
    if (wDelta > 0) {
      text = `↑ +${fmtN(wDelta)}kg`; cls = 'text-green-400';
    } else if (wDelta < 0) {
      text = `↓ -${fmtN(wDelta)}kg`; cls = 'text-rose-400';
    } else if (lastR > 0 && curR > 0) {
      const rDelta = curR - lastR;
      if      (rDelta > 0) { text = `+${rDelta} rep${rDelta !== 1 ? 's' : ''}`; cls = 'text-blue-400'; }
      else if (rDelta < 0) { text = `${rDelta} rep${Math.abs(rDelta) !== 1 ? 's' : ''}`; cls = 'text-rose-400/70'; }
      else                 { text = '= mesmo'; cls = 'text-zinc-500'; }
    } else {
      text = '= mesmo peso'; cls = 'text-zinc-500';
    }

    if (!hintEl) {
      hintEl = document.createElement('div');
      hintEl.setAttribute('data-compare-hint', '');
      hintEl.className = 'ml-9 mt-1';
      row.appendChild(hintEl);
    }
    hintEl.innerHTML = `<span class="text-[9px] font-mono font-bold ${cls}">${text}</span>`;
  } else if (hintEl) {
    hintEl.remove();
  }

  // Hint de PR em tempo real (quase PR ou novo PR)
  let prHintEl = row.querySelector('[data-pr-hint]');
  if (!done && !warmup && pr && curW > 0 && curR > 0) {
    const curEpley = curW * (1 + curR / 30);
    const prEpley  = pr.weight * (1 + pr.reps / 30);
    let hText = null, hCls = '';
    if (curEpley > prEpley)              { hText = '🔥 Novo PR!';   hCls = 'text-yellow-400 font-black'; }
    else if (curEpley >= prEpley * 0.94) { hText = '🔥 Quase PR!'; hCls = 'text-amber-400/90 font-bold'; }
    if (hText) {
      if (!prHintEl) {
        prHintEl = document.createElement('div');
        prHintEl.setAttribute('data-pr-hint', '');
        prHintEl.className = 'ml-9 mt-0.5';
        row.appendChild(prHintEl);
      }
      prHintEl.innerHTML = `<span class="text-[9px] font-mono ${hCls}">${hText}</span>`;
      prHintEl.hidden = false;
    } else if (prHintEl) {
      prHintEl.hidden = true;
    }
  } else if (prHintEl) {
    prHintEl.hidden = true;
  }
}

export function patchExerciseCardState(wId, exId, allDone, doneCount = null, total = null) {
  const card = $(`[data-exercise-card="${wId}|${exId}"]`);
  if (!card) return;

  card.classList.toggle('border-green-900/30', allDone);
  card.classList.toggle('opacity-60',          allDone);
  card.classList.toggle('border-theme-dim',    !allDone);

  const title = card.querySelector('h3');
  if (title) {
    title.classList.toggle('text-green-400', allDone);
    title.classList.toggle('text-white',     !allDone);
  }

  const progressEl = card.querySelector(`[data-progress="${wId}|${exId}"]`);
  if (progressEl && doneCount !== null && total !== null) {
    if (allDone) {
      progressEl.className = 'text-[10px] font-bold text-green-400 flex items-center gap-1';
      progressEl.innerHTML = `<i data-lucide="check-circle" class="w-3 h-3"></i> COMPLETO`;
      if (window.lucide) lucide.createIcons({ nodes: [progressEl] });
    } else if (doneCount > 0) {
      progressEl.className = 'text-[10px] font-mono font-bold text-theme-primary/80 bg-theme-dim px-2 py-0.5 rounded-full border border-theme-dim';
      progressEl.textContent = `${doneCount}/${total}`;
    } else {
      progressEl.className = 'hidden';
      progressEl.textContent = '';
    }
  }

  // Colapso automático ao completar
  const setsContainer = card.querySelector(`[data-sets-container="${wId}|${exId}"]`);
  const setLabels     = card.querySelector('[data-set-labels]');
  const wasCollapsed  = card.dataset.collapsed === 'true';
  if (allDone && card.dataset.collapsed !== 'false') {
    card.dataset.collapsed = 'true';
    if (setsContainer) setsContainer.style.display = 'none';
    if (setLabels)     setLabels.style.display = 'none';
    let summary = card.querySelector('[data-done-summary]');
    if (!summary) {
      summary = document.createElement('div');
      summary.setAttribute('data-done-summary', '');
      summary.className = 'mt-2 text-center text-[9px] text-green-600/50 font-mono cursor-pointer select-none';
      summary.textContent = '↕ toque para expandir';
      card.appendChild(summary);
    }
    if (!wasCollapsed) {
      setTimeout(() => {
        const allCards = Array.from(document.querySelectorAll('[data-exercise-card]'));
        const thisIdx  = allCards.indexOf(card);
        const nextCard = allCards.slice(thisIdx + 1).find(c => c.dataset.collapsed !== 'true');
        if (nextCard) nextCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);
    }
  } else if (!allDone && card.dataset.collapsed !== 'false') {
    card.dataset.collapsed = '';
    if (setsContainer) setsContainer.style.display = '';
    if (setLabels)     setLabels.style.display = '';
    const summary = card.querySelector('[data-done-summary]');
    if (summary) summary.remove();
  }
}

/** Patch cirúrgico do badge de progressão (↑↓=). Chamado a cada mudança de log. */
export function patchProgressionBadge(wId, exId, exLogs, lastExSets = []) {
  const el = $(`[data-progression="${wId}|${exId}"]`);
  if (!el) return;
  const badge = getProgressionBadge(exLogs, lastExSets);
  if (!badge) {
    el.className = 'hidden';
    el.textContent = '';
    return;
  }
  el.className = `text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badge.color} ${badge.bg}`;
  el.textContent = badge.text;
}

export function patchSetsContainer(wId, workout, exId, wLogs, lastSets, prs) {
  const ex = workout.exercises.find(e => e.id === exId);
  if (!ex) return;

  const container = $(`[data-sets-container="${wId}|${exId}"]`);
  if (!container) return;

  const exLogs     = wLogs[exId] ?? {};
  const sets       = countSets(exLogs, ex.sets);
  const lastExSets = lastSets[exId] ?? [];

  let rows = '';
  for (let i = 0; i < sets; i++) {
    rows += renderSetRow(wId, ex, i, exLogs[i], lastExSets[i]);
  }
  container.innerHTML = rows;
  if (window.lucide) lucide.createIcons({ nodes: [container] });

  const label = $(`[data-sets-label="${wId}|${exId}"]`);
  if (label) label.textContent = sets;
}

/** Patch cirúrgico: atualiza o countdown display de uma série cronometrada. */
export function patchTimedSetCountdown(key, remaining, total) {
  const area = $(`[data-timed-reps="${key}"]`);
  if (!area) return;
  const display = area.querySelector('[data-timer-display]');
  if (!display) return;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  display.textContent = `${m}:${String(s).padStart(2, '0')}`;
  // Visual urgency: last 10s
  display.classList.toggle('text-red-400', remaining <= 10);
  display.classList.toggle('text-theme-primary', remaining > 10);
  // Progress ring arc (optional — just update label)
  const pct = area.querySelector('[data-timer-pct]');
  if (pct) pct.textContent = `${Math.round((remaining / total) * 100)}%`;
}

/* ─── Montagem de eventos ──────────────────────────────────────────── */

export function mountWorkout(container, handler) {
  delegate(container, '[data-action="start-set-timer"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('start-set-timer', {
      wId:     el.dataset.wid,
      exId:    el.dataset.exid,
      idx:     parseInt(el.dataset.idx),
      seconds: parseInt(el.dataset.seconds),
      rest:    parseInt(el.dataset.rest) || 60,
    });
  });

  delegate(container, '[data-action="cancel-set-timer"]', 'click', (e, el) => {
    handler('cancel-set-timer', null);
  });

  delegate(container, '[data-action="set-rpe"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('set-rpe', el.dataset.payload);
  });

  delegate(container, '[data-action="toggle-set"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('toggle-set', {
      wId:  el.dataset.wid,
      exId: el.dataset.exid,
      idx:  parseInt(el.dataset.idx),
      rest: parseInt(el.dataset.rest) || 60,
    });
  });

  delegate(container, '[data-action="mod-sets"]', 'click', (e, el) => {
    handler('mod-sets', {
      wId:   el.dataset.wid,
      exId:  el.dataset.exid,
      delta: parseInt(el.dataset.delta),
    });
  });

  delegate(container, '[data-action="auto-fill"]', 'click', (e, el) => {
    e.stopPropagation();
    handler('auto-fill', { wId: el.dataset.wid, exId: el.dataset.exid });
  });

  delegate(container, '[data-action="auto-fill-all"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('auto-fill-all', el.dataset.payload);
  });

  delegate(container, '[data-action="quick-reps"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('quick-reps', el.dataset.payload);
  });

  delegate(container, '[data-action="adjust-weight"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('adjust-weight', el.dataset.payload);
  });

  // Focus-to-confirm: toca no campo de peso vazio → auto-preenche com última sessão
  container.addEventListener('focusin', e => {
    const inp = e.target.closest('input[data-field="w"]');
    if (!inp || inp.value || !inp.placeholder || inp.placeholder === 'KG') return;
    inp.value = inp.placeholder;
    handler('save-log', {
      wId: inp.dataset.wid, exId: inp.dataset.exid,
      idx: parseInt(inp.dataset.idx), field: 'w', value: inp.placeholder,
    });
  });

  delegate(container, '[data-action="toggle-warmup"]', 'click', (e, el) => {
    handler('toggle-warmup', {
      wId:  el.dataset.wid,
      exId: el.dataset.exid,
      idx:  parseInt(el.dataset.idx),
    });
  });

  delegate(container, '[data-action="reset-workout"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('reset-workout', el.dataset.wid);
  });

  delegate(container, '[data-action="finish-workout"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('finish-workout');
  });

  delegate(container, '[data-action="navigate-from-workout"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('navigate-from-workout', { tab: el.dataset.payload ?? 'treinar' });
  });

  container.addEventListener('input', e => {
    const inp = e.target.closest('input[data-field]');
    if (!inp) return;
    handler('save-log', {
      wId:   inp.dataset.wid,
      exId:  inp.dataset.exid,
      idx:   parseInt(inp.dataset.idx),
      field: inp.dataset.field,
      value: inp.value,
    });
  });

  // Feedback visual ao salvar valor (flash verde ao sair do campo)
  container.addEventListener('blur', e => {
    const inp = e.target.closest('input[data-field]');
    if (!inp || !inp.value) return;
    inp.style.borderColor = 'var(--theme-primary)';
    inp.style.boxShadow   = '0 0 8px var(--theme-dim)';
    setTimeout(() => {
      inp.style.borderColor = '';
      inp.style.boxShadow   = '';
    }, 500);
  }, true);

  delegate(container, '[data-action="toggle-skip-exercise"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('toggle-skip-exercise', { wId: el.dataset.wid, exid: el.dataset.exid });
  });

  delegate(container, '[data-action="open-ex-note"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('open-ex-note', { exId: el.dataset.exid, wId: el.dataset.wid });
  });

  delegate(container, '[data-action="open-warmup"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('open-warmup', {
      wId:    el.dataset.wid,
      exId:   el.dataset.exid,
      weight: parseFloat(el.dataset.weight) || 0,
      reps:   el.dataset.reps || '',
    });
  });

  delegate(container, '[data-action="open-exercise-detail"]', 'click', (e, el) => {
    e.stopPropagation();
    createRipple(e, el);
    handler('open-exercise-detail', { exId: el.dataset.exId, exName: el.dataset.exName });
  });

  delegate(container, '[data-action="open-exercise-demo"]', 'click', (e, el) => {
    e.stopPropagation();
    handler('open-exercise-demo', { exId: el.dataset.exId, exName: el.dataset.exName });
  });

  delegate(container, '[data-action="set-commute-return"]', 'click', (e, el) => {
    handler('set-commute-return', el.dataset.payload);
  });

  // Expandir/colapsar exercício concluído ao tocar
  delegate(container, '[data-exercise-card]', 'click', (e, el) => {
    if (el.dataset.collapsed !== 'true') return;
    if (e.target.closest('[data-action]')) return; // não capturar ações internas
    el.dataset.collapsed = 'false';
    const key = el.dataset.exerciseCard;
    const [wId, exId] = key.split('|');
    const sc = el.querySelector(`[data-sets-container="${key}"]`);
    const sl = el.querySelector('[data-set-labels]');
    if (sc) sc.style.display = '';
    if (sl) sl.style.display = '';
    const sum = el.querySelector('[data-done-summary]');
    if (sum) sum.remove();
  });
}

/* ─── Patch cirúrgico de nota rápida ──────────────────────────────── */

export function patchExerciseSkip(container, wId, exId, skipped) {
  const card = container.querySelector(`[data-exercise-card="${wId}|${exId}"]`);
  if (!card) return;

  card.classList.toggle('opacity-50', skipped);

  const sec = card.querySelector(`[data-sets-section="${wId}|${exId}"]`);
  if (sec) sec.classList.toggle('hidden', skipped);

  let badge = card.querySelector('[data-skip-badge]');
  if (skipped) {
    if (!badge) {
      badge = document.createElement('div');
      badge.setAttribute('data-skip-badge', '');
      badge.className = 'flex items-center justify-center gap-2 py-3 text-red-400/70 border border-dashed border-red-900/40 rounded-xl';
      badge.innerHTML = '<i data-lucide="x" class="w-4 h-4"></i><span class="text-xs font-black tracking-widest uppercase">Pulado</span>';
      sec?.insertAdjacentElement('beforebegin', badge);
      if (window.lucide) lucide.createIcons({ nodes: [badge] });
    }
  } else {
    badge?.remove();
  }

  const btn = card.querySelector(`[data-action="toggle-skip-exercise"]`);
  if (btn) {
    btn.title = skipped ? 'Retomar exercício' : 'Pular exercício';
    btn.className = btn.className
      .replace(/bg-red-\S+|border-red-\S+|text-red-\S+|bg-zinc-\S+|border-zinc-\S+|text-zinc-\S+/g, '')
      .trim();
    if (skipped) {
      btn.classList.add('bg-red-900/30', 'border', 'border-red-800/50', 'text-red-400');
    } else {
      btn.classList.add('bg-zinc-800/40', 'border', 'border-zinc-700/40', 'text-zinc-600');
    }
    const icon = btn.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', skipped ? 'rotate-ccw' : 'x');
      if (window.lucide) lucide.createIcons({ nodes: [btn] });
    }
  }
}

export function patchExerciseNote(exId, exNote) {
  const el = document.getElementById(`ex-note-${exId}`);
  if (!el) return;
  if (exNote) {
    el.classList.remove('hidden');
    el.innerHTML = `
      <div class="mx-0 mb-2 px-3 py-1.5 bg-amber-950/30 border border-amber-900/30 rounded-lg flex items-start gap-2">
        <i data-lucide="pencil" class="w-3 h-3 text-amber-600 shrink-0 mt-0.5"></i>
        <p class="text-[10px] text-amber-300/80 leading-relaxed flex-1 min-w-0">${exNote}</p>
      </div>`;
  } else {
    el.classList.add('hidden');
    el.innerHTML = '';
  }
}
