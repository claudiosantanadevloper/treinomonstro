import { delegate, createRipple, sectionHideBtn } from '../utils/dom.js';
import { formatDate, formatVolume, formatDuration } from '../utils/format.js';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP } from '../data/achievements.js';

/* ─── Helpers ──────────────────────────────────────────────────────── */

function localDateKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

/* ─── Calendar Heatmap (12 semanas) ───────────────────────────────── */

function renderCalendarHeatmap(history, hiddenSections = []) {
  if (!history.length) return '';

  const dayMap = {};
  history.forEach(h => {
    const key = localDateKey(new Date(h.date));
    dayMap[key] = (dayMap[key] ?? 0) + 1;
  });

  const today = new Date();
  const cells = [];
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    const isToday = i === 0;
    cells.push({ key, count: dayMap[key] ?? 0, isToday });
  }

  while (cells.length % 7 !== 0) cells.unshift({ key: '', count: 0, isToday: false });

  const weeks = [];
  for (let w = 0; w < Math.ceil(cells.length / 7); w++) {
    weeks.push(cells.slice(w * 7, (w + 1) * 7));
  }

  const cellStyle = (count, isToday) => {
    if (count === 0) return isToday ? 'background:#3f3f46' : 'background:#1c1c1e';
    const op = count === 1 ? 0.5 : count === 2 ? 0.75 : 1;
    return `background:var(--theme-primary);opacity:${op}`;
  };

  const totalDays = Object.keys(dayMap).length;
  const hidden = hiddenSections.includes('section-heatmap');

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <i data-lucide="calendar" class="w-4 h-4"></i>
          Consistência
        </h3>
        <div class="flex items-center gap-1">
          <span class="text-[10px] font-mono text-zinc-600">${totalDays} dias</span>
          ${sectionHideBtn('section-heatmap', hiddenSections)}
        </div>
      </div>
      ${hidden ? '' : `
      <div class="flex gap-[3px]">
        ${weeks.map(week => `
          <div class="flex-1 flex flex-col gap-[3px]">
            ${week.map(cell => `
              <div class="h-[10px] rounded-[2px] transition-all duration-500"
                   style="${cellStyle(cell.count, cell.isToday)}"></div>
            `).join('')}
          </div>
        `).join('')}
      </div>

      <div class="flex items-center justify-between mt-2">
        <span class="text-[9px] text-zinc-700 font-mono">90 dias</span>
        <div class="flex items-center gap-1">
          <span class="text-[9px] text-zinc-700">0</span>
          ${[0.3, 0.5, 0.75, 1].map(op => `
            <div class="w-[10px] h-[10px] rounded-[2px]"
                 style="background:var(--theme-primary);opacity:${op}"></div>
          `).join('')}
          <span class="text-[9px] text-zinc-700">3+</span>
        </div>
      </div>`}
    </div>
  `;
}

/* ─── Sparkline SVG ───────────────────────────────────────────────── */

export function renderSparkline(values, w = 60, h = 22) {
  if (values.length < 2) return '';
  const vmax = Math.max(...values);
  const vmin = Math.min(...values);
  const range = vmax - vmin || 1;

  const px = i => ((i / (values.length - 1)) * w).toFixed(1);
  const py = v  => (h - 2 - ((v - vmin) / range) * (h - 5)).toFixed(1);

  const pts = values.map((v, i) => `${px(i)},${py(v)}`).join(' ');
  const lx  = px(values.length - 1);
  const ly  = py(values[values.length - 1]);
  const trend = values[values.length - 1] - values[0];
  const stroke = trend > 0 ? '#4ade80' : trend < 0 ? '#f87171' : '#71717a';

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
    <circle cx="${lx}" cy="${ly}" r="2.5" fill="${stroke}"/>
  </svg>`;
}

/* ─── Evolução de Carga (sparklines por exercício) ────────────────── */

function renderExerciseProgress(history, workouts, hiddenSections = []) {
  if (history.length < 2) return '';

  const exMap = {};
  workouts.forEach(w => w.exercises.forEach(ex => { exMap[ex.id] = ex.name; }));

  const exProgress = {};
  history.forEach(h => {
    if (!h.sets) return;
    Object.keys(h.sets).forEach(exId => {
      const sets = h.sets[exId] || [];
      const ws = sets.filter(s => s?.done && s?.w).map(s => parseFloat(s.w)).filter(Boolean);
      if (!ws.length) return;
      if (!exProgress[exId]) exProgress[exId] = [];
      exProgress[exId].push(Math.max(...ws));
    });
  });

  const eligible = Object.entries(exProgress)
    .filter(([, pts]) => pts.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6);

  if (!eligible.length) return '';

  const hidden = hiddenSections.includes('section-exercise-progress');

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <i data-lucide="trending-up" class="w-4 h-4"></i>
          Evolução de Carga
        </h3>
        ${sectionHideBtn('section-exercise-progress', hiddenSections)}
      </div>
      ${hidden ? '' : `
      <div class="space-y-2">
        ${eligible.map(([exId, pts]) => {
          const chron = [...pts].reverse();
          const last  = chron[chron.length - 1];
          const first = chron[0];
          const delta = last - first;
          return `
            <button data-action="open-exercise-detail" data-ex-id="${exId}" data-ex-name="${exMap[exId] || exId}"
                    class="ripple-target w-full flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/50 px-3 py-2.5 rounded-xl text-left active:scale-[0.98] transition-transform">
              <div class="flex-1 min-w-0">
                <div class="text-xs font-bold text-white truncate">${exMap[exId] || exId}</div>
                <div class="text-[10px] font-mono mt-0.5 flex items-center gap-1.5">
                  <span class="text-zinc-600">${pts.length}× · ${last}kg</span>
                  <span class="font-bold ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-zinc-600'}">
                    ${delta > 0 ? '+' : ''}${delta !== 0 ? `${delta}kg` : '= estável'}
                  </span>
                </div>
              </div>
              <div class="shrink-0">${renderSparkline(chron)}</div>
            </button>
          `;
        }).join('')}
      </div>`}
    </div>
  `;
}

/* ─── Volume Semanal (bar chart) ──────────────────────────────────── */

function renderWeeklyChart(history) {
  if (history.length < 2) return '';

  const weekMap = {};
  history.forEach(h => {
    const d    = new Date(h.date);
    const year = d.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    const key  = `${year}-W${String(week).padStart(2, '0')}`;
    weekMap[key] = (weekMap[key] ?? 0) + (h.vol ?? 0);
  });

  const weeks  = Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b)).slice(-8);
  if (weeks.length < 2) return '';

  const maxVol = Math.max(...weeks.map(([, v]) => v));
  const BAR_H  = 72;

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <h3 class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <i data-lucide="bar-chart-2" class="w-4 h-4"></i>
        Volume por Semana
      </h3>
      <div class="flex items-end justify-between gap-1 px-1" style="height:${BAR_H + 28}px">
        ${weeks.map(([key, vol], i) => {
          const pct    = maxVol > 0 ? vol / maxVol : 0;
          const h      = Math.max(4, Math.round(pct * BAR_H));
          const isLast = i === weeks.length - 1;
          const label  = key.slice(5);
          return `
            <div class="flex-1 flex flex-col items-center gap-1">
              <div class="text-[8px] font-mono text-theme-primary/70 font-bold truncate" style="opacity:${pct > 0.4 ? 1 : 0}">
                ${pct > 0.4 ? formatVolume(vol) : ''}
              </div>
              <div class="w-full rounded-t-md transition-all duration-700
                          ${isLast ? 'bg-theme-primary shadow-[0_0_8px_var(--theme-primary)]' : 'bg-zinc-700'}"
                   style="height:${h}px"></div>
              <div class="text-[8px] font-mono ${isLast ? 'text-theme-primary font-bold' : 'text-zinc-600'}">${label}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* ─── Volume Mensal (bar chart 6 meses) ──────────────────────────── */

function renderMonthlyChart(history) {
  if (history.length < 2) return '';

  const monthMap = {};
  history.forEach(h => {
    const d   = new Date(h.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap[key]) monthMap[key] = { vol: 0, sessions: 0 };
    monthMap[key].vol += h.vol ?? 0;
    monthMap[key].sessions++;
  });

  const ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const now  = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { label: ABR[d.getMonth()], vol: monthMap[key]?.vol ?? 0, sessions: monthMap[key]?.sessions ?? 0, isCurrent: i === 5 };
  });

  if (!months.some(m => m.vol > 0)) return '';

  const maxVol = Math.max(...months.map(m => m.vol), 1);
  const BAR_H  = 64;

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <h3 class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <i data-lucide="bar-chart-2" class="w-4 h-4"></i>
        Volume Mensal
      </h3>
      <div class="flex items-end justify-between gap-2 px-1" style="height:${BAR_H + 36}px">
        ${months.map(({ vol, sessions, label, isCurrent }) => {
          const pct = vol / maxVol;
          const h   = Math.max(vol > 0 ? 4 : 0, Math.round(pct * BAR_H));
          return `
            <div class="flex-1 flex flex-col items-center gap-0.5">
              <div class="text-[9px] font-mono font-bold text-theme-primary/70" style="opacity:${sessions > 0 && pct > 0.15 ? 1 : 0}">
                ${sessions > 0 ? sessions + '×' : ''}
              </div>
              <div class="w-full rounded-t-md transition-all duration-700
                          ${isCurrent ? 'bg-theme-primary shadow-[0_0_8px_var(--theme-primary)]' : vol > 0 ? 'bg-zinc-600' : 'bg-zinc-800/30'}"
                   style="height:${h}px"></div>
              <div class="text-[9px] font-mono ${isCurrent ? 'text-theme-primary font-bold' : 'text-zinc-600'} mt-0.5">${label}</div>
              <div class="text-[7px] font-mono text-zinc-700">${vol > 0 ? formatVolume(vol) : ''}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* ─── Mini bar ─────────────────────────────────────────────────────── */

function miniBar(value, max) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return `<div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
    <div class="h-full bg-theme-primary rounded-full transition-all duration-700 shadow-[0_0_4px_var(--theme-primary)]"
         style="width:${pct}%"></div>
  </div>`;
}

/* ─── Foco Muscular ───────────────────────────────────────────────── */

function renderMuscleTotals(history) {
  const totals = {};
  history.forEach(h => {
    (h.muscles ?? []).forEach(m => { totals[m] = (totals[m] ?? 0) + 1; });
  });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '';
  const max = entries[0][1];

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <h3 class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <i data-lucide="activity" class="w-4 h-4"></i>
        Foco Muscular
      </h3>
      <div class="space-y-2.5">
        ${entries.map(([muscle, count]) => `
          <div class="flex items-center gap-3">
            <div class="text-xs text-zinc-400 w-20 shrink-0 font-medium">${muscle}</div>
            <div class="flex-1">
              <div class="flex justify-between mb-0.5">
                <span class="text-[10px] text-zinc-600 font-mono">${count}×</span>
                <span class="text-[10px] text-zinc-700 font-mono">${Math.round(count/max*100)}%</span>
              </div>
              ${miniBar(count, max)}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ─── Helpers de histórico por exercício ──────────────────────────── */

function getExerciseWeightHistory(history, exId, limit = 8) {
  const points = [];
  for (const entry of history) {
    if (!entry.sets?.[exId]) continue;
    const sets = Object.values(entry.sets[exId]);
    const done = sets.filter(s => s.done && !s.warmup);
    if (!done.length) continue;
    const maxW = Math.max(...done.map(s => parseFloat(s.w) || 0));
    if (maxW > 0) points.push(maxW);
    if (points.length >= limit) break;
  }
  return points.reverse(); // oldest → newest
}

function renderMiniSparkline(values) {
  if (values.length < 2) return '';
  const W = 52, H = 22;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = ((i / (values.length - 1)) * W).toFixed(1);
    const y = (H - 2 - ((v - min) / range) * (H - 6)).toFixed(1);
    return `${x},${y}`;
  }).join(' ');
  const [lastX, lastY] = pts.split(' ').at(-1).split(',');
  const color = values.at(-1) > values[0] ? '#4ade80' : values.at(-1) < values[0] ? '#fb7185' : '#71717a';
  return `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="shrink-0 opacity-80">
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lastX}" cy="${lastY}" r="2.5" fill="${color}"/>
    </svg>`;
}

/* ─── Destaques: exercícios em evolução ───────────────────────────── */

function renderExerciseTrend(history, prs, workouts) {
  if (history.length < 2) return '';

  const exMap = {};
  workouts.forEach(w => w.exercises.forEach(ex => { exMap[ex.id] = ex.name; }));

  const rising = [];
  for (const exId of Object.keys(prs)) {
    const pts = getExerciseWeightHistory(history, exId, 2);
    if (pts.length < 2) continue;
    const delta = parseFloat((pts[1] - pts[0]).toFixed(1));
    if (delta <= 0) continue;
    const pct = Math.round(delta / pts[0] * 100);
    rising.push({ exId, name: exMap[exId] || exId, delta, pct, curW: pts[1] });
  }
  if (!rising.length) return '';

  rising.sort((a, b) => b.pct - a.pct);

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <i data-lucide="trending-up" class="w-3.5 h-3.5 text-green-400"></i>
        Em Evolução — Última Sessão
      </h3>
      <div class="space-y-2">
        ${rising.slice(0, 3).map((e, i) => `
          <div class="flex items-center gap-3 px-3 py-2 rounded-xl bg-zinc-900/40 border border-zinc-800/40">
            <span class="text-[9px] font-mono text-zinc-700 w-4 text-center shrink-0">${i + 1}</span>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold text-white truncate">${e.name}</div>
              <div class="text-[9px] font-mono text-zinc-500">${e.curW}kg agora</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-xs font-bold text-green-400 font-mono">+${e.delta}kg</div>
              <div class="text-[9px] font-mono text-green-600">+${e.pct}%</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ─── Personal Records ────────────────────────────────────────────── */

function renderPRSection(prs, workouts, history = []) {
  const prEntries = Object.entries(prs);
  if (!prEntries.length) return '';

  const exMap     = {};
  const muscleMap = {};
  workouts.forEach(w => w.exercises.forEach(ex => {
    exMap[ex.id]     = ex.name;
    muscleMap[ex.id] = w.muscleFocus?.[0] ?? null;
  }));

  // Group by muscle
  const grouped = {};
  prEntries
    .sort((a, b) => b[1].weight - a[1].weight)
    .forEach(([exId, pr]) => {
      const muscle = muscleMap[exId] || 'Outros';
      if (!grouped[muscle]) grouped[muscle] = [];
      grouped[muscle].push([exId, pr]);
    });

  const sections = Object.entries(grouped).map(([muscle, entries]) => `
    <div class="mb-3 last:mb-0">
      <div class="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5 flex items-center gap-1">
        <div class="w-3 h-px bg-zinc-700"></div>${muscle}<div class="flex-1 h-px bg-zinc-800"></div>
      </div>
      <div class="space-y-1.5">
        ${entries.map(([exId, pr]) => {
          const oneRM  = Math.round(pr.weight * (1 + pr.reps / 30));
          const wHist  = getExerciseWeightHistory(history, exId);
          const spark  = renderMiniSparkline(wHist);
          const last2  = getExerciseWeightHistory(history, exId, 2);
          const delta  = last2.length >= 2 ? parseFloat((last2[1] - last2[0]).toFixed(1)) : 0;
          const trendCls = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-rose-400' : 'text-zinc-600';
          const trendTxt = delta > 0 ? `↑ +${delta}kg` : delta < 0 ? `↓ ${delta}kg` : '';
          return `
            <button data-action="open-exercise-detail" data-ex-id="${exId}" data-ex-name="${exMap[exId] || exId}"
                    class="ripple-target w-full bg-zinc-900/40 border border-zinc-800/60 px-3 py-2.5 rounded-xl text-left active:scale-[0.98] transition-transform">
              <div class="flex items-center gap-2">
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-bold text-white truncate">${exMap[exId] || exId}</div>
                  <div class="text-[9px] text-zinc-600 font-mono mt-0.5 flex items-center gap-1.5">
                    ${formatDate(pr.date)}
                    ${trendTxt ? `<span class="font-bold ${trendCls}">${trendTxt}</span>` : ''}
                  </div>
                </div>
                ${spark}
                <div class="text-right shrink-0 ml-1">
                  <div class="text-sm font-bold text-yellow-400 font-mono">${pr.weight}kg × ${pr.reps}</div>
                  <div class="text-[9px] text-zinc-600 font-mono">1RM ~${oneRM}kg</div>
                </div>
              </div>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <i data-lucide="trophy" class="w-4 h-4 text-yellow-500"></i>
          Personal Records
        </h3>
        <span class="text-[10px] font-mono text-zinc-600">${prEntries.length} exercício${prEntries.length !== 1 ? 's' : ''}</span>
      </div>
      ${sections}
    </div>
  `;
}

/* ─── Volume por Músculo (últimos 30 dias) ───────────────────────── */

function renderMuscleVolumeChart(history) {
  const cutoff = Date.now() - 30 * 86400000;
  const muscleVol = {};
  history
    .filter(h => new Date(h.date).getTime() >= cutoff)
    .forEach(h => {
      const muscles = h.muscles ?? [];
      if (!muscles.length || !h.vol) return;
      const share = h.vol / muscles.length;
      muscles.forEach(m => { muscleVol[m] = (muscleVol[m] ?? 0) + share; });
    });

  const entries = Object.entries(muscleVol).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '';
  const max = entries[0][1];

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <i data-lucide="layers" class="w-4 h-4"></i>
          Volume / Músculo — 30 dias
        </h3>
      </div>
      <div class="space-y-2.5">
        ${entries.map(([muscle, vol]) => `
          <div class="flex items-center gap-3">
            <div class="text-xs text-zinc-400 w-20 shrink-0 font-medium truncate">${muscle}</div>
            <div class="flex-1">
              <div class="flex justify-between mb-0.5">
                <span class="text-[9px] font-mono text-zinc-600">${Math.round(vol / 1000 * 10) / 10}t</span>
                <span class="text-[9px] font-mono text-zinc-700">${Math.round(vol / max * 100)}%</span>
              </div>
              ${miniBar(vol, max)}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ─── Render principal ─────────────────────────────────────────────── */

const HISTORY_PAGE_SIZE = 20;

function renderCardioSection(cardioHistory = []) {

  /* ── Pace helpers ── */
  function paceStrToDecimal(paceStr) {
    if (!paceStr) return null;
    const [m, s] = paceStr.split(':').map(Number);
    if (isNaN(m) || isNaN(s)) return null;
    return m + s / 60;
  }
  function computePaceDecimal(c) {
    if (c.pace) return paceStrToDecimal(c.pace);
    if (c.duration && c.distance && c.distance > 0) return c.duration / c.distance;
    return null;
  }
  function paceDecimalToStr(dec) {
    if (!dec || dec <= 0) return null;
    const m = Math.floor(dec);
    const s = Math.round((dec - m) * 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  function fmtDurMin(dec) {
    const m = Math.floor(dec);
    const s = Math.round((dec - m) * 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  const isRun = c => (c.type || '').toLowerCase().includes('corrid');

  /* ── Weekly stats ── */
  const cutoff7 = Date.now() - 7 * 86400000;
  const thisWeek     = cardioHistory.filter(c => new Date(c.date).getTime() >= cutoff7);
  const weekSessions = thisWeek.length;
  const weekKm       = thisWeek.reduce((s, c) => s + (c.distance || 0), 0);
  let weekAvgPaceStr = null;
  const corridaWeek  = thisWeek.filter(isRun);
  if (corridaWeek.length > 0) {
    let sumPD = 0, sumD = 0;
    corridaWeek.forEach(c => {
      const p = computePaceDecimal(c);
      if (p && c.distance) { sumPD += p * c.distance; sumD += c.distance; }
    });
    if (sumD > 0) weekAvgPaceStr = paceDecimalToStr(sumPD / sumD);
  }

  const weekStatsHtml = weekSessions > 0 ? (() => {
    const items = [
      { label: 'Esta semana', val: weekSessions,              sub: 'sessões', color: 'text-white' },
      weekKm > 0        && { label: 'Distância',   val: `${weekKm.toFixed(1)}km`, sub: 'esta semana', color: 'text-theme-primary' },
      weekAvgPaceStr    && { label: 'Ritmo médio',  val: weekAvgPaceStr,           sub: 'min/km',      color: 'text-white' },
    ].filter(Boolean);
    return `
      <div class="flex gap-2 mb-3">
        ${items.map(s => `
          <div class="flex-1 bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-2 text-center">
            <div class="text-[8px] text-zinc-600 uppercase font-bold tracking-wider leading-tight">${s.label}</div>
            <div class="text-base font-mono font-black ${s.color} leading-snug">${s.val}</div>
            <div class="text-[8px] text-zinc-700 leading-tight">${s.sub}</div>
          </div>
        `).join('')}
      </div>
    `;
  })() : '';

  /* ── Pace trend (last 8 corrida runs, oldest → newest) ── */
  const corridaRuns = cardioHistory.filter(isRun);
  const trendRuns   = corridaRuns.slice(0, 8).reverse();
  let trendHtml = '';
  if (trendRuns.length >= 2) {
    const paces = trendRuns.map(computePaceDecimal);
    const valid = paces.filter(Boolean);
    if (valid.length >= 2) {
      const minP = Math.min(...valid), maxP = Math.max(...valid);
      const range = maxP - minP || 0.1;
      const delta = valid[valid.length - 1] - valid[0]; // negative = faster = better
      const deltaSec = Math.round(Math.abs(delta) * 60);
      const improved  = delta < -0.05;
      const regressed = delta >  0.05;
      const trendText  = improved  ? `↑ ${deltaSec}s/km mais rápido`
                       : regressed ? `↓ ${deltaSec}s/km mais lento`
                       : '→ ritmo estável';
      const trendColor = improved  ? 'text-green-400'
                       : regressed ? 'text-red-400'
                       : 'text-zinc-500';
      const MAX_H = 36;
      const bars = trendRuns.map((c, i) => {
        const p   = paces[i];
        const pct = p ? Math.max(8, Math.round(((maxP - p) / range) * 100)) : 8;
        const isLast = i === trendRuns.length - 1;
        return `
          <div class="flex-1 flex flex-col items-center gap-0.5">
            <div class="text-[8px] font-mono leading-none mb-0.5 ${isLast ? 'text-theme-primary font-bold' : 'text-transparent'}">
              ${isLast && p ? paceDecimalToStr(p) : '.'}
            </div>
            <div class="w-full flex flex-col-reverse" style="height:${MAX_H}px">
              <div class="w-full rounded-t-sm ${isLast ? 'bg-theme-primary shadow-[0_0_5px_var(--theme-primary)]' : 'bg-zinc-700'}"
                   style="height:${Math.round(pct * MAX_H / 100)}px"></div>
            </div>
            <div class="text-[7px] font-mono text-zinc-700 mt-0.5">${c.distance ? `${c.distance}k` : ''}</div>
          </div>
        `;
      }).join('');
      trendHtml = `
        <div class="mt-3 bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Tendência de Ritmo</span>
            <span class="text-[9px] font-bold ${trendColor}">${trendText}</span>
          </div>
          <div class="flex items-end gap-1">${bars}</div>
        </div>
      `;
    }
  }

  /* ── Corrida PRs ── */
  let prBest5km = null, prBestPace = null, prLongest = null;
  corridaRuns.forEach(c => {
    const p = computePaceDecimal(c);
    if (p && c.distance >= 1 && (!prBestPace || p < computePaceDecimal(prBestPace))) prBestPace = c;
    if (c.distance >= 4.9 && c.distance <= 5.1 && c.duration && (!prBest5km || c.duration < prBest5km.duration)) prBest5km = c;
    if (c.distance && (!prLongest || c.distance > prLongest.distance)) prLongest = c;
  });
  const prItems = [
    prBest5km  && { label: 'Melhor 5km',     val: fmtDurMin(prBest5km.duration),                                          sub: formatDate(prBest5km.date) },
    prBestPace && { label: 'Melhor Ritmo',   val: `${prBestPace.pace || paceDecimalToStr(computePaceDecimal(prBestPace))}/km`, sub: `${prBestPace.distance}km · ${formatDate(prBestPace.date)}` },
    prLongest  && { label: 'Maior Dist.',    val: `${prLongest.distance}km`,                                               sub: formatDate(prLongest.date) },
  ].filter(Boolean);
  const prsHtml = prItems.length ? `
    <div class="mt-3 grid grid-cols-3 gap-1.5">
      ${prItems.map(pr => `
        <div class="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-2 text-center">
          <div class="text-[8px] text-zinc-600 uppercase font-bold tracking-wider mb-1 leading-tight">${pr.label}</div>
          <div class="text-sm font-mono font-black text-yellow-400 leading-none">${pr.val}</div>
          <div class="text-[8px] text-zinc-700 font-mono mt-1 leading-tight">${pr.sub}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  /* ── Accumulated stats ── */
  const cutoff30 = Date.now() - 30 * 86400000;
  const totalKm     = cardioHistory.reduce((s, c) => s + (c.distance || 0), 0);
  const totalMin    = cardioHistory.reduce((s, c) => s + (c.duration || 0), 0);
  const monthKm     = cardioHistory.filter(c => new Date(c.date).getTime() >= cutoff30).reduce((s, c) => s + (c.distance || 0), 0);
  const monthSess   = cardioHistory.filter(c => new Date(c.date).getTime() >= cutoff30).length;

  const typeDist = { corrida: 0, bike: 0, outro: 0 };
  cardioHistory.forEach(c => {
    const t = (c.type || 'outro').toLowerCase();
    typeDist[t] = (typeDist[t] || 0) + 1;
  });
  const typeTotal = cardioHistory.length || 1;

  const accumulatedHtml = cardioHistory.length > 0 ? `
    <div class="mt-3 bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3">
      <div class="text-[9px] font-bold text-zinc-600 uppercase tracking-wider mb-2">Acumulado Geral</div>
      <div class="grid grid-cols-3 gap-1.5 mb-2">
        <div class="text-center">
          <div class="text-base font-black text-white font-mono leading-none">${totalKm.toFixed(1)}<span class="text-[9px] text-zinc-600 ml-0.5">km</span></div>
          <div class="text-[8px] text-zinc-600 mt-0.5">Total</div>
        </div>
        <div class="text-center">
          <div class="text-base font-black text-white font-mono leading-none">${Math.round(totalMin)}<span class="text-[9px] text-zinc-600 ml-0.5">min</span></div>
          <div class="text-[8px] text-zinc-600 mt-0.5">Tempo</div>
        </div>
        <div class="text-center">
          <div class="text-base font-black text-white font-mono leading-none">${cardioHistory.length}</div>
          <div class="text-[8px] text-zinc-600 mt-0.5">Sessões</div>
        </div>
      </div>
      ${monthKm > 0 || monthSess > 0 ? `
      <div class="pt-2 border-t border-zinc-800/60 flex justify-around text-center">
        <div>
          <div class="text-sm font-black text-theme-primary font-mono leading-none">${monthKm.toFixed(1)}km</div>
          <div class="text-[8px] text-zinc-600 mt-0.5">Últimos 30d</div>
        </div>
        <div>
          <div class="text-sm font-black text-zinc-400 font-mono leading-none">${monthSess}</div>
          <div class="text-[8px] text-zinc-600 mt-0.5">Sessões/mês</div>
        </div>
      </div>
      ` : ''}
      ${cardioHistory.length > 0 ? `
      <div class="pt-2 border-t border-zinc-800/60 mt-2">
        <div class="text-[8px] text-zinc-600 mb-1.5 font-bold uppercase tracking-wider">Distribuição por tipo</div>
        <div class="flex gap-1.5">
          ${[['corrida','Corrida','text-theme-primary'],['bike','Bike','text-blue-400'],['outro','Outro','text-zinc-500']].map(([key, label, color]) => {
            const count = typeDist[key] || 0;
            const pct = Math.round((count / typeTotal) * 100);
            return count > 0 ? `
              <div class="flex items-center gap-1">
                <div class="w-2 h-2 rounded-full flex-shrink-0 ${color === 'text-theme-primary' ? 'bg-[var(--theme-primary)]' : key === 'bike' ? 'bg-blue-400' : 'bg-zinc-500'}"></div>
                <span class="text-[8px] ${color} font-bold">${label} ${pct}%</span>
              </div>
            ` : '';
          }).join('')}
        </div>
      </div>
      ` : ''}
    </div>
  ` : '';

  /* ── Effort badge + type label ── */
  function effortBadge(effort) {
    const MAP = {
      'fácil':    ['Fácil',    'text-green-400 bg-green-900/20'],
      'moderado': ['Moderado', 'text-amber-400 bg-amber-900/20'],
      'forte':    ['Forte',    'text-rose-400 bg-rose-900/20'],
    };
    const [label, cls] = MAP[effort] ?? ['', ''];
    return label ? `<span class="text-[8px] font-bold px-1.5 py-0.5 rounded ${cls}">${label}</span>` : '';
  }
  function typeLabel(type) {
    const MAP = { corrida: 'Corrida', bike: 'Bike', outro: 'Outro' };
    return MAP[(type || '').toLowerCase()] || type || 'Cardio';
  }

  /* ── Recent list (last 8) ── */
  const recent  = cardioHistory.slice(0, 8);
  const listHtml = recent.length === 0
    ? `<p class="text-[10px] text-zinc-700 text-center font-mono py-2">Nenhuma sessão registrada</p>`
    : `<div class="space-y-1.5">
        ${recent.map((c, i) => {
          const pace      = c.pace || (c.duration && c.distance ? paceDecimalToStr(c.duration / c.distance) : null);
          const localLbl  = c.local === 'rua' ? 'Rua' : c.local === 'esteira' ? 'Esteira' : null;
          return `
            <div class="flex items-center gap-2 ${i > 0 ? 'opacity-75' : ''}">
              <div class="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <i data-lucide="activity" class="w-3.5 h-3.5 text-theme-primary/70"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                  ${typeLabel(c.type)}
                  ${localLbl ? `<span class="text-[8px] text-zinc-600 font-normal">${localLbl}</span>` : ''}
                  ${effortBadge(c.effort)}
                </div>
                <div class="text-[9px] text-zinc-600 font-mono flex items-center gap-1 flex-wrap">
                  <span>${formatDate(c.date)}</span>
                  ${c.distance ? `<span class="text-zinc-700">·</span><span>${c.distance}km</span>` : ''}
                  ${pace
                    ? `<span class="text-zinc-700">·</span><span class="text-theme-primary">${pace}/km</span>`
                    : c.duration ? `<span class="text-zinc-700">·</span><span>${Math.round(c.duration)}min</span>` : ''}
                </div>
              </div>
              <button data-action="delete-cardio" data-date="${c.date}"
                      class="w-6 h-6 flex items-center justify-center rounded text-zinc-700
                             hover:text-red-400 hover:bg-red-900/20 transition-all active:scale-90 shrink-0">
                <i data-lucide="x" class="w-3 h-3 pointer-events-none"></i>
              </button>
            </div>
          `;
        }).join('')}
      </div>`;

  const hasAnalytics = weekStatsHtml || trendHtml || prsHtml || accumulatedHtml;

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="activity" class="w-3.5 h-3.5"></i>
          Cardio
          ${cardioHistory.length > 0 ? `<span class="text-zinc-700 font-mono">&nbsp;${cardioHistory.length} sessões</span>` : ''}
        </h3>
        <button data-action="open-cardio-log"
                class="ripple-target flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-dim border border-theme-accent
                       text-theme-primary text-[10px] font-black uppercase tracking-wider active:scale-90 transition-all">
          <i data-lucide="plus" class="w-3 h-3"></i> Log
        </button>
      </div>

      ${weekStatsHtml}
      ${trendHtml}
      ${prsHtml}
      ${accumulatedHtml}

      <div class="${hasAnalytics || accumulatedHtml ? 'mt-3 border-t border-zinc-800/50 pt-3' : ''}">
        ${hasAnalytics || accumulatedHtml ? `<div class="text-[9px] font-bold text-zinc-600 uppercase tracking-wider mb-2">Últimas sessões</div>` : ''}
        ${listHtml}
      </div>
    </div>
  `;
}

/* ─── Achievements Tab ─────────────────────────────────────────────── */

function renderAchievementsTab(earnedIds = [], state = {}) {
  const earnedSet = new Set(earnedIds);
  const { history = [], cardioHistory = [], completedCycles = 0 } = state;

  const totalVol = history.reduce((s, h) => s + (h.vol ?? 0), 0);
  const totalKm  = cardioHistory.reduce((s, c) => s + (c.distance ?? 0), 0);

  // Próximas: milestones não conquistadas com progresso > 0
  const milestones = [
    ...[1,10,25,50,100,200].map(n => ({
      id: `session_${n}`, cur: history.length, tgt: n,
      label: v => `${v}/${n} sessões`,
    })),
    ...[{id:'vol_1t',tgt:1e3},{id:'vol_10t',tgt:1e4},{id:'vol_100t',tgt:1e5},{id:'vol_500t',tgt:5e5}].map(m => ({
      ...m, cur: totalVol,
      label: v => `${(v/1000).toFixed(1)}/${(m.tgt/1000).toFixed(0)}t`,
    })),
    {id:'cycle_1',cur:completedCycles,tgt:1,label:v=>`${v}/1 ciclo`},
    {id:'cycle_5',cur:completedCycles,tgt:5,label:v=>`${v}/5 ciclos`},
    (() => {
      const { cycleGoal: cg = 6 } = state;
      const wm = {};
      for (const h of history) {
        const d = new Date(h.date);
        const day = d.getDay();
        const mon = new Date(d);
        mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        mon.setHours(0,0,0,0);
        const k = mon.toISOString().slice(0,10);
        wm[k] = (wm[k] ?? 0) + 1;
      }
      const best = Math.max(0, ...Object.values(wm));
      return {id:'week_perfect',cur:best,tgt:cg,label:v=>`${v}/${cg} em uma semana`};
    })(),
    ...[{id:'cardio_first',tgt:1},{id:'cardio_5',tgt:5},{id:'cardio_10',tgt:10},{id:'cardio_25',tgt:25},{id:'cardio_50',tgt:50}].map(m => ({
      ...m, cur: cardioHistory.length, label: v => `${v}/${m.tgt} sess. cardio`,
    })),
    ...[{id:'cardio_10km',tgt:10},{id:'cardio_50km',tgt:50},{id:'cardio_100km',tgt:100},{id:'cardio_250km',tgt:250}].map(m => ({
      ...m, cur: totalKm, label: v => `${v.toFixed(1)}/${m.tgt}km`,
    })),
  ]
    .filter(m => !earnedSet.has(m.id) && m.tgt > 0)
    .map(m => ({ ...m, pct: Math.min(99, Math.round(m.cur / m.tgt * 100)) }))
    .filter(m => m.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  const nextHtml = milestones.length ? `
    <div class="glass-card p-4 rounded-2xl border border-theme-accent/30 bg-theme-dim/10">
      <div class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <i data-lucide="target" class="w-3 h-3"></i>
        Próximas Conquistas
      </div>
      <div class="space-y-3">
        ${milestones.map(m => {
          const a = ACHIEVEMENT_MAP[m.id];
          if (!a) return '';
          return `
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-zinc-900 border border-zinc-800">
                <i data-lucide="${a.icon}" class="w-3.5 h-3.5 ${a.color} opacity-60"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[10px] font-bold text-zinc-400 truncate">${a.name}</span>
                  <span class="text-[9px] font-mono text-theme-primary font-bold ml-2 shrink-0">${m.pct}%</span>
                </div>
                <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div class="h-full rounded-full bg-theme-primary transition-all duration-700 shadow-[0_0_4px_var(--theme-primary)]"
                       style="width:${m.pct}%"></div>
                </div>
                <div class="text-[8px] font-mono text-zinc-600 mt-0.5">${m.label(m.cur)}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  const groups = [
    { label: 'Sessões',              items: ACHIEVEMENTS.filter(a => a.id.startsWith('session_')) },
    { label: 'Tonelagem',            items: ACHIEVEMENTS.filter(a => a.id.startsWith('vol_')) },
    { label: 'Streak',               items: ACHIEVEMENTS.filter(a => a.id.startsWith('streak_')) },
    { label: 'Ciclos',               items: ACHIEVEMENTS.filter(a => a.id.startsWith('cycle_') || a.id === 'week_perfect') },
    { label: 'Cardio — Sessões',     items: ACHIEVEMENTS.filter(a => ['cardio_first','cardio_5','cardio_10','cardio_25','cardio_50'].includes(a.id)) },
    { label: 'Cardio — Distância',   items: ACHIEVEMENTS.filter(a => a.id.includes('km')) },
    { label: 'Cardio — Performance', items: ACHIEVEMENTS.filter(a => a.id.startsWith('cardio_') && !['cardio_first','cardio_5','cardio_10','cardio_25','cardio_50'].includes(a.id) && !a.id.includes('km')) },
    { label: 'Recordes',             items: ACHIEVEMENTS.filter(a => a.id === 'first_pr') },
  ].filter(g => g.items.length > 0);

  const achievementItem = a => {
    const earned = earnedSet.has(a.id);
    return `
      <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
                  ${earned ? 'bg-zinc-900/50 border-zinc-700/60' : 'bg-zinc-900/20 border-zinc-800/30 opacity-40'}">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${earned ? 'bg-zinc-800' : 'bg-zinc-900'}">
          <i data-lucide="${a.icon}" class="w-4 h-4 ${earned ? a.color : 'text-zinc-700'}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-bold ${earned ? 'text-white' : 'text-zinc-600'} truncate">${a.name}</div>
          <div class="text-[10px] text-zinc-600 font-mono mt-0.5">${a.desc}</div>
        </div>
        ${earned
          ? `<i data-lucide="check-circle" class="w-4 h-4 text-theme-primary shrink-0"></i>`
          : `<i data-lucide="eye-off" class="w-4 h-4 text-zinc-800 shrink-0"></i>`}
      </div>
    `;
  };

  return `
    <div class="space-y-4">
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/60 flex items-center justify-between">
        <div class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total desbloqueado</div>
        <div class="text-2xl font-black text-theme-primary font-mono">
          ${earnedIds.length}<span class="text-base text-zinc-600">/${ACHIEVEMENTS.length}</span>
        </div>
      </div>
      ${nextHtml}
      ${groups.map(g => `
        <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
          <h3 class="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">${g.label}</h3>
          <div class="grid grid-cols-1 gap-2">
            ${g.items.map(achievementItem).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/* ─── Calendário de Adesão ──────────────────────────────────────────── */

function renderAdherenceCalendar(history, cycleGoal) {
  if (!history.length) return '';

  const getMonday = d => {
    const dt = new Date(d);
    const day = dt.getDay();
    dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
    dt.setHours(0, 0, 0, 0);
    return dt;
  };

  const weekMap = {};
  for (const h of history) {
    const key = getMonday(h.date).toISOString().slice(0, 10);
    weekMap[key] = (weekMap[key] ?? 0) + 1;
  }

  const thisMon = getMonday(new Date());
  const weeks = Array.from({ length: 16 }, (_, i) => {
    const mon = new Date(thisMon);
    mon.setDate(thisMon.getDate() - (15 - i) * 7);
    const key = mon.toISOString().slice(0, 10);
    return { key, count: weekMap[key] ?? 0, mon };
  });

  const metCount = weeks.filter(w => w.count >= cycleGoal).length;

  const cellCls = count => {
    if (count >= cycleGoal) return 'bg-theme-primary shadow-[0_0_4px_var(--theme-dim)]';
    if (count >= Math.ceil(cycleGoal / 2)) return 'bg-amber-600/70';
    if (count > 0) return 'bg-zinc-600/60';
    return 'bg-zinc-800/50';
  };

  const monthLabels = weeks.map((w, i) =>
    (i === 0 || w.mon.getMonth() !== weeks[i - 1].mon.getMonth())
      ? w.mon.toLocaleDateString('pt-BR', { month: 'short' })
      : ''
  );

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="calendar-days" class="w-3.5 h-3.5"></i>
          Adesão — 16 Semanas
        </h3>
        <span class="text-[10px] font-mono ${metCount >= 12 ? 'text-theme-primary' : metCount >= 8 ? 'text-amber-400' : 'text-zinc-500'}">
          ${metCount}/16 na meta
        </span>
      </div>
      <div class="grid gap-1 mb-0.5" style="grid-template-columns:repeat(16,minmax(0,1fr))">
        ${monthLabels.map(l => `<div class="text-[7px] text-zinc-600 font-mono text-center truncate">${l}</div>`).join('')}
      </div>
      <div class="grid gap-1" style="grid-template-columns:repeat(16,minmax(0,1fr))">
        ${weeks.map(w => `<div class="aspect-square rounded-sm ${cellCls(w.count)}"></div>`).join('')}
      </div>
      <div class="flex items-center gap-3 mt-3 flex-wrap">
        <div class="flex items-center gap-1.5">
          <div class="w-2.5 h-2.5 rounded-sm bg-theme-primary"></div>
          <span class="text-[8px] text-zinc-600">Meta (≥${cycleGoal})</span>
        </div>
        <div class="flex items-center gap-1.5">
          <div class="w-2.5 h-2.5 rounded-sm bg-amber-600/70"></div>
          <span class="text-[8px] text-zinc-600">Parcial</span>
        </div>
        <div class="flex items-center gap-1.5">
          <div class="w-2.5 h-2.5 rounded-sm bg-zinc-600/60"></div>
          <span class="text-[8px] text-zinc-600">Algum</span>
        </div>
      </div>
    </div>
  `;
}

/* ─── Comparação de Ciclo Atual vs Período Anterior ───────────────── */

function renderCycleComparison(state) {
  const { history = [], prs = {}, cycleStart } = state;
  if (!cycleStart || history.length < 4) return '';

  const start    = new Date(cycleStart).getTime();
  const now      = Date.now();
  const duration = now - start;
  if (duration < 7 * 86400000) return ''; // ciclo com < 7 dias: sem comparação

  const curSessions  = history.filter(h => new Date(h.date).getTime() >= start);
  const prevSessions = history.filter(h => {
    const t = new Date(h.date).getTime();
    return t >= start - duration && t < start;
  });
  if (curSessions.length < 2 || prevSessions.length < 2) return '';

  const curVol   = curSessions.reduce((s, h)  => s + (h.vol  || 0), 0);
  const prevVol  = prevSessions.reduce((s, h) => s + (h.vol  || 0), 0);
  const volPct   = prevVol > 0 ? Math.round((curVol - prevVol) / prevVol * 100) : 0;
  const curDays  = new Set(curSessions.map(h  => h.date.slice(0, 10))).size;
  const prevDays = new Set(prevSessions.map(h => h.date.slice(0, 10))).size;
  const daysDiff = curDays - prevDays;
  const curPRs   = Object.values(prs).filter(pr => pr.date && new Date(pr.date).getTime() >= start).length;
  const cycleWeeks = Math.max(1, Math.round(duration / (7 * 86400000)));

  const delta = (v, suffix = '') => {
    if (v > 0) return `<span class="text-green-400 font-bold">↑+${v}${suffix}</span>`;
    if (v < 0) return `<span class="text-red-400 font-bold">↓${v}${suffix}</span>`;
    return `<span class="text-zinc-600">=</span>`;
  };

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <i data-lucide="layers" class="w-4 h-4"></i>
          Ciclo vs Período Anterior
        </h3>
        <span class="text-[9px] font-mono text-zinc-600">${cycleWeeks} sem</span>
      </div>
      <div class="grid grid-cols-3 gap-2">
        ${[
          { label: 'Treinos',  cur: curDays,           prev: prevDays,          diff: daysDiff,  unit: '',  pctSuffix: '' },
          { label: 'Volume',   cur: formatVolume(curVol), prev: formatVolume(prevVol), diff: volPct, unit: '', pctSuffix: '%' },
          { label: 'PRs ciclo', cur: curPRs,           prev: '—',               diff: null,      unit: '',  pctSuffix: '' },
        ].map(m => `
          <div class="bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-2 py-2.5 text-center">
            <div class="text-[9px] text-zinc-500 uppercase tracking-wide font-bold mb-1">${m.label}</div>
            <div class="text-sm font-black font-mono text-white">${m.cur}</div>
            <div class="text-[9px] font-mono mt-0.5">
              ${m.diff !== null ? delta(m.diff, m.pctSuffix) : `<span class="text-zinc-600">${curPRs > 0 ? '🔥' : '—'}</span>`}
            </div>
            <div class="text-[8px] text-zinc-700 font-mono">ant. ${m.prev}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

/* ─── Frequência Muscular (4 semanas × grupos) ────────────────────── */

function renderMuscleFrequencyGrid(history) {
  if (history.length < 3) return '';

  const now   = new Date();
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const dowOffset = now.getDay() === 0 ? 7 : now.getDay();
    const dayOffset = (3 - i) * 7 + (dowOffset - 1);
    const start = new Date(now); start.setDate(now.getDate() - dayOffset); start.setHours(0,0,0,0);
    const end   = new Date(start); end.setDate(start.getDate() + 7);
    return { start: start.getTime(), end: end.getTime(), label: i === 3 ? 'Esta' : `-${3 - i}s` };
  });

  const muscleSet = new Set();
  history.forEach(h => (h.muscles ?? []).forEach(m => muscleSet.add(m)));
  if (!muscleSet.size) return '';
  const muscles = [...muscleSet].slice(0, 8);

  const grid = {};
  muscles.forEach(m => {
    grid[m] = weeks.map(w =>
      history.filter(h => {
        const t = new Date(h.date).getTime();
        return t >= w.start && t < w.end && (h.muscles ?? []).includes(m);
      }).length
    );
  });

  const maxCount = Math.max(...Object.values(grid).flatMap(v => v), 1);

  const cell = (count) => {
    if (count === 0) return 'bg-zinc-800/40 text-zinc-700';
    const r = count / maxCount;
    if (r < 0.4) return 'bg-theme-primary/25 text-theme-primary/70';
    if (r < 0.75) return 'bg-theme-primary/55 text-white/80';
    return 'bg-theme-primary text-white shadow-[0_0_5px_var(--theme-primary)]';
  };

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <i data-lucide="calendar-days" class="w-3.5 h-3.5"></i>
        Frequência Muscular — 4 Semanas
      </h3>
      <div class="overflow-x-auto">
        <table class="w-full text-[9px] font-mono" style="min-width:200px">
          <thead>
            <tr>
              <th class="text-left text-zinc-700 pb-1.5 pr-2 font-bold w-20"></th>
              ${weeks.map(w => `<th class="text-zinc-600 pb-1.5 font-bold text-center px-1">${w.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="space-y-1">
            ${muscles.map(m => `
              <tr>
                <td class="text-zinc-500 pr-2 py-0.5 font-bold truncate max-w-[80px]">${m}</td>
                ${grid[m].map(c => `
                  <td class="py-0.5 px-1 text-center">
                    <div class="w-full rounded-md py-1 font-black ${cell(c)}">${c > 0 ? c : '·'}</div>
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p class="text-[8px] text-zinc-700 font-mono mt-2 text-right">sessões por grupo muscular</p>
    </div>
  `;
}

/* ─── Rumo ao Objetivo (Sprint 7.1) ─────────────────────────────────── */

function renderGoalSection(history, cardioHistory, goal) {
  if (!goal || history.length < 5) return '';

  const now            = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

  const thisMo = history.filter(h => new Date(h.date).getTime() >= thisMonthStart);
  const lastMo = history.filter(h => {
    const t = new Date(h.date).getTime();
    return t >= lastMonthStart && t < thisMonthStart;
  });

  const avgVol = arr => arr.length ? arr.reduce((s, h) => s + (h.vol ?? 0), 0) / arr.length : 0;
  const kmMonth = (arr) => arr.filter(c => new Date(c.date).getTime() >= thisMonthStart).reduce((s, c) => s + (c.distance ?? 0), 0);

  const GOAL_CFG = {
    hipertrofia:     { icon: 'trending-up', color: 'text-green-400',  border: 'border-green-800/40',  bg: 'bg-green-900/10',  label: 'Hipertrofia',    metricLabel: 'Volume médio/sessão', getThis: () => avgVol(thisMo),  getLast: () => avgVol(lastMo),  fmt: v => formatVolume(v), good: d => d > 0 },
    emagrecimento:   { icon: 'flame',       color: 'text-orange-400', border: 'border-orange-800/40', bg: 'bg-orange-900/10', label: 'Emagrecimento',  metricLabel: 'Sessões este mês',   getThis: () => thisMo.length,   getLast: () => lastMo.length,   fmt: v => `${v} treinos`, good: d => d >= 0 },
    recomposicao:    { icon: 'repeat',      color: 'text-blue-400',   border: 'border-blue-800/40',   bg: 'bg-blue-900/10',   label: 'Recomposição',   metricLabel: 'Volume médio/sessão', getThis: () => avgVol(thisMo),  getLast: () => avgVol(lastMo),  fmt: v => formatVolume(v), good: d => d >= 0 },
    forca:           { icon: 'zap',         color: 'text-amber-400',  border: 'border-amber-800/40',  bg: 'bg-amber-900/10',  label: 'Força',          metricLabel: 'Volume médio/sessão', getThis: () => avgVol(thisMo),  getLast: () => avgVol(lastMo),  fmt: v => formatVolume(v), good: d => d > 0 },
    condicionamento: { icon: 'wind',        color: 'text-cyan-400',   border: 'border-cyan-800/40',   bg: 'bg-cyan-900/10',   label: 'Condicionamento',metricLabel: 'Sessões este mês',   getThis: () => thisMo.length,   getLast: () => lastMo.length,   fmt: v => `${v} treinos`, good: d => d >= 0 },
  };

  const cfg = GOAL_CFG[goal];
  if (!cfg) return '';

  const vThis = cfg.getThis();
  const vLast = cfg.getLast();
  if (vLast === 0 && vThis === 0) return '';

  const delta   = +(vThis - vLast).toFixed(1);
  const deltaPct = vLast > 0 ? Math.round((vThis - vLast) / vLast * 100) : null;
  const isGood  = cfg.good(delta);
  const cardioKm = kmMonth(cardioHistory);

  const trendIcon  = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const trendColor = isGood ? cfg.color : 'text-rose-400';

  return `
    <div class="glass-card p-4 rounded-2xl border ${cfg.border} ${cfg.bg}">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="${cfg.icon}" class="w-3.5 h-3.5 ${cfg.color}"></i>
          Rumo ao Objetivo · ${cfg.label}
        </h3>
      </div>

      <div class="grid grid-cols-2 gap-2 mb-3">
        <div class="rounded-xl bg-black/20 border border-zinc-800/40 p-3">
          <div class="text-[8px] text-zinc-600 font-bold uppercase tracking-wider mb-1">Este Mês</div>
          <div class="text-base font-black font-mono ${cfg.color}">${cfg.fmt(vThis)}</div>
          <div class="text-[8px] text-zinc-700 font-mono">${cfg.metricLabel}</div>
        </div>
        <div class="rounded-xl bg-black/20 border border-zinc-800/40 p-3">
          <div class="text-[8px] text-zinc-600 font-bold uppercase tracking-wider mb-1">Mês Anterior</div>
          <div class="text-base font-black font-mono text-zinc-400">${vLast > 0 ? cfg.fmt(vLast) : '—'}</div>
          <div class="text-[8px] text-zinc-700 font-mono">${cfg.metricLabel}</div>
        </div>
      </div>

      ${vLast > 0 ? `
      <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/20 border border-zinc-800/30">
        <span class="font-black text-sm ${trendColor}">${trendIcon}</span>
        <div class="flex-1">
          <span class="text-xs font-bold ${trendColor}">
            ${delta > 0 ? '+' : ''}${typeof delta === 'number' && delta % 1 !== 0 ? delta.toFixed(1) : delta}
            ${deltaPct !== null ? `(${deltaPct > 0 ? '+' : ''}${deltaPct}%)` : ''}
          </span>
          <span class="text-[9px] text-zinc-600 ml-1">vs mês anterior</span>
        </div>
        <span class="text-[9px] font-bold ${isGood ? 'text-green-500' : 'text-zinc-600'}">${isGood ? 'Em rota' : 'Ajustar'}</span>
      </div>` : ''}

      ${goal === 'condicionamento' && cardioKm > 0 ? `
      <div class="mt-2 flex items-center gap-1.5 text-[9px] text-cyan-400 font-mono">
        <i data-lucide="wind" class="w-3 h-3"></i>
        ${cardioKm.toFixed(1)} km de cardio este mês
      </div>` : ''}
    </div>
  `;
}

/* ─── Comparação Inter-Ciclos ──────────────────────────────────────── */

function renderInterCycleCard(history, cycleDone, cycleStart, workouts) {
  if (!cycleDone?.length || !cycleStart) return '';

  const cycleStartMs = new Date(cycleStart).getTime();

  // Entradas do ciclo atual (mais recentes primeiro)
  const current = history.filter(h => new Date(h.date).getTime() >= cycleStartMs);
  // Entradas do ciclo anterior (mais recentes primeiro antes do cycleStart)
  const prev    = history.filter(h => new Date(h.date).getTime() <  cycleStartMs);

  if (!current.length || !prev.length) return '';

  // Agrupa por workoutId — pega a última sessão de cada ciclo por treino
  const grouped = {};
  current.forEach(h => { if (!grouped[h.workoutId]) grouped[h.workoutId] = { cur: h, prev: null }; });
  prev.forEach(h => {
    if (grouped[h.workoutId] && !grouped[h.workoutId].prev) grouped[h.workoutId].prev = h;
  });

  const rows = Object.values(grouped).filter(g => g.prev);
  if (!rows.length) return '';

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/70">
      <div class="flex items-center gap-1.5 mb-3">
        <i data-lucide="repeat" class="w-3.5 h-3.5 text-zinc-500"></i>
        <span class="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Ciclo Atual vs Anterior</span>
      </div>
      <div class="space-y-2">
        ${rows.map(({ cur, prev: prv }) => {
          const volDelta  = prv.vol > 0 ? Math.round((cur.vol - prv.vol) / prv.vol * 100) : null;
          const deltaCls  = volDelta > 0 ? 'text-green-400' : volDelta < 0 ? 'text-red-400' : 'text-zinc-500';
          return `
            <div class="bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-3 py-2.5">
              <div class="flex items-center justify-between gap-2 mb-1.5">
                <span class="text-[10px] font-black text-white truncate">${cur.title}</span>
                ${volDelta !== null ? `<span class="text-[10px] font-black font-mono shrink-0 ${deltaCls}">${volDelta > 0 ? '+' : ''}${volDelta}%</span>` : ''}
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <div class="text-[8px] text-zinc-600 uppercase font-bold mb-0.5">Atual</div>
                  <div class="text-[10px] font-mono text-white font-bold">${formatVolume(cur.vol)}</div>
                  ${cur.duration ? `<div class="text-[9px] text-zinc-500 font-mono">${cur.duration}min</div>` : ''}
                </div>
                <div>
                  <div class="text-[8px] text-zinc-600 uppercase font-bold mb-0.5">Anterior</div>
                  <div class="text-[10px] font-mono text-zinc-400">${formatVolume(prv.vol)}</div>
                  ${prv.duration ? `<div class="text-[9px] text-zinc-600 font-mono">${prv.duration}min</div>` : ''}
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

/* ─── Musculação Tab ───────────────────────────────────────────────── */

function renderBodyFatTrend(biometrics, bioHistory = []) {
  const all = [...bioHistory, biometrics].filter(b => b?.bodyFat && b?.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (all.length < 2) return '';

  const vals = all.map(b => b.bodyFat);
  const vMin = Math.min(...vals);
  const vMax = Math.max(...vals);
  const range = vMax - vMin || 1;
  const W = 300, H = 60, PAD = 8;
  const x = i => PAD + (i / (all.length - 1)) * (W - PAD * 2);
  const y = v => H - PAD - ((v - vMin) / range) * (H - PAD * 2);
  const pts = all.map((b, i) => `${x(i)},${y(b.bodyFat)}`).join(' ');
  const pathD = all.map((b, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(b.bodyFat)}`).join(' ');
  const areaD = `${pathD} L${x(all.length-1)},${H} L${x(0)},${H} Z`;
  const first = all[0], last = all[all.length - 1];
  const delta = +(last.bodyFat - first.bodyFat).toFixed(2);
  const deltaColor = delta <= 0 ? 'text-green-400' : 'text-red-400';
  const deltaSign  = delta > 0 ? '+' : '';
  const trend = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const fmt = d => { const dt = new Date(d); return `${dt.getMonth()+1}/${String(dt.getFullYear()).slice(2)}`; };

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="activity" class="w-3.5 h-3.5 text-orange-400"></i> Tendência — % Gordura
        </h3>
        <span class="${deltaColor} font-black font-mono text-xs">${trend} ${deltaSign}${delta}pp</span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" class="w-full" preserveAspectRatio="none" style="height:60px">
        <defs>
          <linearGradient id="fat-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f97316" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#f97316" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${areaD}" fill="url(#fat-grad)"/>
        <polyline points="${pts}" fill="none" stroke="#f97316" stroke-width="1.5" stroke-linejoin="round"/>
        ${all.map((b, i) => `<circle cx="${x(i)}" cy="${y(b.bodyFat)}" r="2.5" fill="#f97316"/>`).join('')}
      </svg>
      <div class="flex justify-between text-[8px] font-mono text-zinc-600 mt-1">
        <span>${fmt(first.date)} · ${first.bodyFat}%</span>
        <span>${all.length} avaliações</span>
        <span class="${deltaColor} font-bold">${fmt(last.date)} · ${last.bodyFat}%</span>
      </div>
    </div>`;
}

function renderMusculacaoTab(state, workouts) {
  const { history, prs, historyPage = 0, cardioHistory = [], hiddenSections = [], cycleGoal = 6, goal = null, cycleDone = [], cycleStart = null, biometrics = null, bioHistory = [] } = state;
  const totalVol  = history.reduce((a, h) => a + (h.vol ?? 0), 0);
  const avgVol    = history.length ? totalVol / history.length : 0;
  const thisWeek  = history.filter(h => {
    const diff = (Date.now() - new Date(h.date)) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });
  const bestMonth = (() => {
    const monthMap = {};
    history.forEach(h => {
      const d = new Date(h.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthMap[key] = (monthMap[key] ?? 0) + 1;
    });
    return Math.max(0, ...Object.values(monthMap));
  })();

  return `
    <div class="space-y-4">

      <!-- Métricas principais -->
      <div class="grid grid-cols-2 gap-2.5">
        ${[
          { label: 'Missões',       value: history.length,              sub: `${thisWeek.length} esta semana` },
          { label: 'Tonelagem',     value: formatVolume(totalVol),      sub: 'total acumulada',   accent: true },
          { label: 'Média/Treino',  value: formatVolume(avgVol),        sub: 'por sessão' },
          { label: 'Melhor Mês',    value: bestMonth,                   sub: `treino${bestMonth !== 1 ? 's' : ''}` },
        ].map(m => `
          <div class="glass-card p-4 rounded-2xl border-l-2 border-theme-accent">
            <div class="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mb-1">${m.label}</div>
            <div class="text-xl font-mono font-black tracking-tighter ${m.accent ? 'text-theme-primary' : 'text-white'}">${m.value}</div>
            ${m.sub ? `<div class="text-[10px] text-zinc-600 mt-0.5">${m.sub}</div>` : ''}
          </div>
        `).join('')}
      </div>

      ${renderBodyFatTrend(biometrics, bioHistory)}
      ${renderGoalSection(history, cardioHistory, goal)}
      ${renderCalendarHeatmap(history, hiddenSections)}
      ${renderWeeklyChart(history)}
      ${renderMonthlyChart(history)}
      ${renderAdherenceCalendar(history, cycleGoal)}
      ${renderMuscleFrequencyGrid(history)}
      ${renderExerciseProgress(history, workouts, hiddenSections)}
      ${renderCycleComparison(state)}
      ${renderMuscleVolumeChart(history)}
      ${renderMuscleTotals(history)}
      ${renderExerciseTrend(history, prs, workouts)}
      ${renderPRSection(prs, workouts, history)}

      <!-- Comparação inter-ciclos -->
      ${renderInterCycleCard(history, cycleDone, cycleStart, workouts)}

      <!-- Histórico (musculação + cardio unificado) -->
      ${renderUnifiedHistory(history, cardioHistory, historyPage, hiddenSections)}

    </div>
  `;
}

/* ─── Unified History (extracted for reuse) ───────────────────────── */

function renderUnifiedHistory(history, cardioHistory, historyPage, hiddenSections = []) {
  const workoutByDate = {};
  history.forEach(h => {
    const k = localDateKey(new Date(h.date));
    (workoutByDate[k] = workoutByDate[k] || []).push(h);
  });
  const cardioByDate = {};
  cardioHistory.forEach(c => {
    const k = localDateKey(new Date(c.date));
    (cardioByDate[k] = cardioByDate[k] || []).push(c);
  });

  const allDates = [...new Set([
    ...Object.keys(workoutByDate),
    ...Object.keys(cardioByDate),
  ])].sort((a, b) => b.localeCompare(a));

  if (!allDates.length) return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <h3 class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Histórico</h3>
      <div class="text-center text-zinc-600 text-xs py-8 font-mono border border-dashed border-zinc-800 rounded-xl">
        Nenhum dado de combate encontrado.
      </div>
    </div>`;

  const visibleDates = allDates.slice(0, (historyPage + 1) * HISTORY_PAGE_SIZE);
  const hasMore = allDates.length > visibleDates.length;

  const TYPE_LBL  = { corrida: 'Corrida', bike: 'Bike', outro: 'Outro' };
  const LOCAL_LBL = { rua: 'Rua', esteira: 'Esteira' };
  const EFFORT_CLS = {
    'fácil':    'text-green-400',
    'moderado': 'text-amber-400',
    'forte':    'text-rose-400',
  };
  const EFFORT_LBL = { 'fácil': 'Fácil', 'moderado': 'Moderado', 'forte': 'Forte' };

  const days = visibleDates.map((dateKey, i) => {
    const ws = workoutByDate[dateKey] || [];
    const cs = cardioByDate[dateKey]  || [];
    const refDate = ws[0]?.date || cs[0]?.date;

    const wRows = ws.map(h => `
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-start gap-1.5 min-w-0 flex-1">
          <i data-lucide="dumbbell" class="w-3 h-3 text-theme-primary/50 mt-0.5 shrink-0"></i>
          <div class="min-w-0">
            <div class="text-xs font-bold text-white truncate">${h.title}</div>
            <div class="text-[9px] text-zinc-500 font-mono flex items-center gap-1.5 flex-wrap mt-0.5">
              ${h.duration ? `<span>${formatDuration(h.duration)}</span>` : ''}
              ${h.reps    ? `<span class="text-zinc-700">·</span><span>${h.reps} reps</span>` : ''}
              ${h.mission?.commute ? `<span class="text-zinc-700">·</span><span class="text-cyan-600 flex items-center gap-0.5"><i data-lucide="move" class="w-2.5 h-2.5"></i>${h.mission.commute.distance}km</span>` : ''}
              ${h.notes   ? `<span class="text-zinc-700">·</span><span class="italic text-zinc-600 truncate">"${h.notes}"</span>` : ''}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <div class="text-[10px] font-mono text-theme-primary font-bold bg-theme-dim px-2 py-0.5
                      rounded border border-theme-dim">
            ${formatVolume(h.vol ?? 0)}
          </div>
          <button data-action="delete-workout-history" data-entry-id="${h.id}"
                  class="p-1 rounded text-zinc-700 hover:text-rose-500 active:scale-90 transition-all">
            <i data-lucide="trash-2" class="w-3 h-3"></i>
          </button>
        </div>
      </div>`).join('');

    const cRows = cs.map(c => {
      const typeLbl  = TYPE_LBL[(c.type || '').toLowerCase()] || c.type || 'Cardio';
      const localLbl = LOCAL_LBL[c.local] || null;
      const efLbl    = EFFORT_LBL[c.effort] || null;
      const efCls    = EFFORT_CLS[c.effort] || 'text-zinc-500';
      const paceDisp = c.pace
        ? `<span class="text-zinc-700">·</span><span class="text-theme-primary/80">${c.pace}/km</span>`
        : c.duration ? `<span class="text-zinc-700">·</span><span>${Math.round(c.duration)}min</span>` : '';
      return `
      <div class="flex items-start gap-1.5">
        <i data-lucide="activity" class="w-3 h-3 text-theme-primary/50 mt-0.5 shrink-0"></i>
        <div class="min-w-0 flex-1">
          <div class="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
            ${typeLbl}
            ${localLbl ? `<span class="text-[8px] text-zinc-600 font-normal">${localLbl}</span>` : ''}
            ${efLbl    ? `<span class="text-[8px] font-bold ${efCls}">${efLbl}</span>`           : ''}
          </div>
          <div class="text-[9px] text-zinc-500 font-mono flex items-center gap-1 flex-wrap mt-0.5">
            ${c.distance ? `<span>${c.distance}km</span>` : ''}
            ${paceDisp}
          </div>
        </div>
      </div>`;
    }).join('');

    const divider = ws.length && cs.length
      ? `<div class="border-t border-zinc-800/50 my-2"></div>`
      : '';

    return `
      <div class="bg-zinc-900/30 border border-zinc-800/50 p-3 rounded-xl mb-2 last:mb-0 stagger-enter"
           style="animation-delay:${Math.min(i, 5) * 30}ms">
        <div class="text-[9px] font-mono text-zinc-600 mb-2 flex items-center gap-1.5">
          <i data-lucide="calendar" class="w-3 h-3"></i>
          ${formatDate(refDate)}
          ${ws.length && cs.length ? `<span class="ml-auto text-[8px] text-zinc-700 uppercase tracking-wider font-bold">Força + Cardio</span>` : ''}
        </div>
        <div class="space-y-2">
          ${wRows}
          ${divider}
          ${cRows}
        </div>
      </div>`;
  }).join('');

  const hiddenHist = hiddenSections.includes('section-history');
  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-bold text-zinc-500 uppercase tracking-widest">Histórico</h3>
        <div class="flex items-center gap-1">
          <span class="text-[10px] font-mono text-zinc-700">${allDates.length} dias</span>
          ${sectionHideBtn('section-history', hiddenSections)}
        </div>
      </div>
      ${hiddenHist ? '' : `
      ${days}
      ${hasMore ? `
        <button data-action="load-more-history"
                class="ripple-target w-full py-2.5 mt-1 rounded-xl bg-black/40 border border-zinc-800
                       text-xs text-zinc-500 font-bold hover:bg-theme-dim hover:text-theme-primary
                       hover:border-theme-dim transition-all uppercase flex items-center justify-center gap-2 active:scale-[0.98]">
          <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
          Carregar mais (${allDates.length - visibleDates.length} restantes)
        </button>` : ''}`}
    </div>`;
}

export function renderAnalytics(state, workouts) {
  const { analyticsTab = 'musculacao', cardioHistory = [], achievements = [] } = state;

  const tabs = [
    { id: 'musculacao', label: 'Musculação', icon: 'dumbbell' },
    { id: 'cardio',     label: 'Cardio',     icon: 'activity'  },
    { id: 'conquistas', label: 'Conquistas', icon: 'trophy'    },
  ];

  const tabBar = `
    <div class="flex gap-1 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-1">
      ${tabs.map(t => `
        <button data-action="set-analytics-tab" data-payload="${t.id}"
                class="flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95
                       ${analyticsTab === t.id
                         ? 'bg-theme-dim border border-theme-accent text-theme-primary shadow-[0_0_8px_var(--theme-primary)]/20'
                         : 'text-zinc-600 hover:text-zinc-400'}">
          <i data-lucide="${t.icon}" class="w-3.5 h-3.5 shrink-0"></i>
          <span>${t.label}</span>
        </button>
      `).join('')}
    </div>
  `;

  let content = '';
  if (analyticsTab === 'musculacao') content = renderMusculacaoTab(state, workouts);
  else if (analyticsTab === 'cardio') content = renderCardioSection(cardioHistory);
  else if (analyticsTab === 'conquistas') content = renderAchievementsTab(achievements, state);

  return `
    <div class="stagger-enter space-y-4 pb-4">
      ${tabBar}
      <div id="analytics-tab-content">
        ${content}
      </div>
    </div>
  `;
}

export function patchAnalyticsTab(container, state, workouts) {
  const { analyticsTab = 'musculacao', cardioHistory = [], achievements = [] } = state;

  container.querySelectorAll('[data-action="set-analytics-tab"]').forEach(btn => {
    const active = btn.dataset.payload === analyticsTab;
    btn.className = [
      'flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl',
      'text-[10px] font-black uppercase tracking-wider transition-all active:scale-95',
      active
        ? 'bg-theme-dim border border-theme-accent text-theme-primary shadow-[0_0_8px_var(--theme-primary)]/20'
        : 'text-zinc-600 hover:text-zinc-400',
    ].join(' ');
  });

  const contentEl = container.querySelector('#analytics-tab-content');
  if (!contentEl) return;

  let content = '';
  if (analyticsTab === 'musculacao')   content = renderMusculacaoTab(state, workouts);
  else if (analyticsTab === 'cardio')  content = renderCardioSection(cardioHistory);
  else if (analyticsTab === 'conquistas') content = renderAchievementsTab(achievements, state);

  contentEl.innerHTML = content;
}

export function mountAnalytics(container, handler) {
  delegate(container, '[data-action="set-analytics-tab"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('set-analytics-tab', el.dataset.payload);
  });

  delegate(container, '[data-action="toggle-section"]', 'click', (e, el) => {
    handler('toggle-section', el.dataset.section);
  });

  delegate(container, '[data-action="load-more-history"]', 'click', (e, el) => {
    handler('load-more-history');
  });

  delegate(container, '[data-action="open-cardio-log"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('open-cardio-log');
  });

  delegate(container, '[data-action="delete-cardio"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('delete-cardio', el.dataset.date);
  });

  delegate(container, '[data-action="delete-workout-history"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('delete-workout-history', el.dataset.entryId);
  });

  delegate(container, '[data-action="open-exercise-detail"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('open-exercise-detail', { exId: el.dataset.exId, exName: el.dataset.exName });
  });
}
