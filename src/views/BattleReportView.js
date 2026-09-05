import { ACHIEVEMENT_MAP } from "../data/achievements.js";
import { formatVolume, formatDuration } from "../utils/format.js";

export function renderBattleReport(s, pName, L, nextW, nextIsOff, prevSession) {
  const motivMsg    = s.quote       ?? 'Você venceu a versão de ontem.';
  const motivAuthor = s.quoteAuthor ?? null;
  const totalDoneSets = s.sets != null && typeof s.sets === 'object'
    ? Object.values(s.sets).reduce((a, b) => a + (Array.isArray(b) ? b.filter(x => x.done).length : 0), 0)
    : 0;

  const breakdownHtml = (s.breakdown ?? [])
    .map((item, i) => `
      <div class="flex justify-between items-start py-2.5 border-b border-white/5 last:border-0 stagger-enter"
           style="animation-delay:${100 + i * 50}ms">
        <div class="flex items-start gap-2 min-w-0 flex-1">
          <div class="w-1.5 h-1.5 rounded-full bg-theme-primary/60 shrink-0 mt-1.5"></div>
          <div class="min-w-0">
            <span class="text-xs text-zinc-300 font-bold truncate">${item.name}</span>
            ${s.exerciseNotes?.[item.exId] ? `<div class="text-[9px] text-amber-400/70 italic mt-0.5 truncate">"${s.exerciseNotes[item.exId]}"</div>` : ''}
          </div>
        </div>
        <div class="text-right shrink-0 ml-4">
          <div class="text-xs font-mono font-bold text-theme-primary">${item.vol.toFixed(0)}kg</div>
          ${item.maxWeight ? `<div class="text-[9px] text-zinc-600 font-mono">pico ${item.maxWeight}kg</div>` : ""}
        </div>
      </div>
    `).join("");

  let comparisonHtml = '';
  if (prevSession) {
    const cmpDays   = Math.floor((Date.now() - new Date(prevSession.date)) / 86400000);
    const cmpAgo    = cmpDays === 0 ? 'hoje' : cmpDays === 1 ? 'ontem' : `há ${cmpDays} dias`;
    const prevMap   = Object.fromEntries((prevSession.breakdown ?? []).map(b => [b.exId, b]));
    const volDelta  = s.vol - (prevSession.vol ?? 0);
    const volPct    = prevSession.vol > 0 ? Math.round(volDelta / prevSession.vol * 100) : 0;
    const repsDelta = (s.reps ?? 0) - (prevSession.reps ?? 0);

    const volBadge = volPct > 0
      ? `<span class="text-[10px] font-bold text-green-400 bg-green-900/20 border border-green-900/30 px-2 py-0.5 rounded">▲ Volume +${volPct}%</span>`
      : volPct < 0
      ? `<span class="text-[10px] font-bold text-red-400 bg-red-900/20 border border-red-900/30 px-2 py-0.5 rounded">▼ Volume ${Math.abs(volPct)}%</span>`
      : `<span class="text-[10px] text-zinc-600 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded">= Volume</span>`;

    const repsBadge = repsDelta > 0
      ? `<span class="text-[10px] font-bold text-green-400 bg-green-900/20 border border-green-900/30 px-2 py-0.5 rounded">▲ +${repsDelta} reps</span>`
      : repsDelta < 0
      ? `<span class="text-[10px] font-bold text-red-400 bg-red-900/20 border border-red-900/30 px-2 py-0.5 rounded">▼ ${Math.abs(repsDelta)} reps</span>`
      : '';

    const exerciseRows = (s.breakdown ?? []).map(item => {
      const prev  = prevMap[item.exId];
      if (!prev) return `
        <div class="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <div class="w-1.5 h-1.5 rounded-full bg-zinc-700 shrink-0"></div>
            <span class="text-[11px] text-zinc-300 truncate">${item.name}</span>
          </div>
          <span class="text-[9px] text-zinc-600 uppercase font-bold shrink-0 ml-3">Novo</span>
        </div>`;
      const wDelta = Math.round((item.maxWeight - prev.maxWeight) * 10) / 10;
      const vPct   = prev.vol > 0 ? Math.round((item.vol - prev.vol) / prev.vol * 100) : 0;
      const dot    = (wDelta > 0 || vPct > 0) ? 'bg-green-500' : (wDelta < 0 || vPct < 0) ? 'bg-red-400' : 'bg-zinc-600';
      const wHtml  = wDelta > 0
        ? `<span class="text-[9px] font-bold text-green-400">▲ +${wDelta}kg</span>`
        : wDelta < 0
        ? `<span class="text-[9px] font-bold text-red-400">▼ ${Math.abs(wDelta)}kg</span>`
        : `<span class="text-[9px] text-zinc-700">= carga</span>`;
      const vHtml  = vPct !== 0
        ? `<span class="text-[9px] font-mono ${vPct > 0 ? 'text-green-700' : 'text-red-700'}">${vPct > 0 ? '↑' : '↓'} ${Math.abs(vPct)}%</span>`
        : '';
      return `
        <div class="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <div class="w-1.5 h-1.5 rounded-full ${dot} shrink-0"></div>
            <span class="text-[11px] text-zinc-300 truncate">${item.name}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0 ml-3">
            ${wHtml}
            ${vHtml}
          </div>
        </div>`;
    }).join('');

    comparisonHtml = `
      <div class="glass-card rounded-2xl border border-theme-dim/40 p-4 mb-4 stagger-enter"
           style="animation-delay:170ms">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <i data-lucide="trending-up" class="w-3.5 h-3.5"></i> vs. Sessão Anterior
          </h3>
          <span class="text-[9px] text-zinc-700 font-mono">${cmpAgo}</span>
        </div>
        <div class="flex items-center gap-2 mb-3 flex-wrap">
          ${volBadge}
          ${repsBadge}
        </div>
        <div>
          ${exerciseRows}
        </div>
      </div>`;
  }

  const progressionChips = s.progressionChips ?? [];
  const progressionHtml = progressionChips.length ? `
    <div class="glass-card rounded-2xl border border-green-900/30 p-4 mb-4 stagger-enter"
         style="animation-delay:210ms">
      <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
        <i data-lucide="trending-up" class="w-3.5 h-3.5 text-green-500"></i> Pronto para subir carga
      </h3>
      <div class="flex flex-wrap gap-2 mb-2">
        ${progressionChips.map(c => `
          <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-900/20 border border-green-900/30">
            <i data-lucide="trending-up" class="w-3 h-3 text-green-400"></i>
            <span class="text-[10px] font-bold text-green-300">${c.name}</span>
            <span class="text-[9px] text-green-700 font-mono">+${c.increment}kg</span>
          </div>`).join('')}
      </div>
      <p class="text-[9px] text-zinc-600">Completou todas as reps no teto — aplique a progressão na próxima sessão.</p>
    </div>` : '';

  return `
    <div class="fixed inset-0 z-[100] overflow-y-auto no-scrollbar"
         style="background:linear-gradient(135deg, #050505 0%, #0a0a0a 60%, rgba(var(--theme-rgb),0.04) 100%)">

      <div class="fixed inset-0 pointer-events-none overflow-hidden">
        <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl animate-pulse"
             style="background:var(--theme-primary)"></div>
      </div>

      <div class="relative min-h-screen flex flex-col px-5 pt-6 pb-10 max-w-md mx-auto">

        <div class="flex justify-between items-center mb-8">
          <div class="text-[10px] font-bold text-zinc-600 uppercase tracking-widest font-mono">
            PROJETO ${pName}
          </div>
          <button id="close-report"
                  class="w-9 h-9 rounded-full bg-zinc-900/80 border border-zinc-800
                         flex items-center justify-center text-zinc-500 hover:text-white
                         active:scale-90 transition-all">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="text-center mb-8 stagger-enter">
          <div class="relative inline-block mb-4">
            <div class="w-24 h-24 rounded-full flex items-center justify-center mx-auto
                        shadow-[0_0_60px_var(--theme-primary)]"
                 style="background:radial-gradient(circle, rgba(var(--theme-rgb),0.2), rgba(var(--theme-rgb),0.05))">
              <i data-lucide="trophy" class="w-12 h-12 text-theme-primary"></i>
            </div>
            <div class="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-yellow-400 border-2 border-black
                        flex items-center justify-center text-[10px] font-black">✓</div>
          </div>
          <h1 class="text-3xl font-black uppercase italic text-white tracking-tighter leading-none mb-1">
            ${L.doneTile}
          </h1>
          <p class="text-sm font-bold text-theme-primary uppercase tracking-widest">${s.title ?? ""}</p>
          ${(s.duration ?? 0) > 0 ? `
          <div class="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full
                      border border-theme-accent/50 bg-theme-dim/40 backdrop-blur-sm">
            <i data-lucide="timer" class="w-4 h-4 text-theme-primary"></i>
            <span class="text-xl font-black font-mono text-white">${formatDuration(s.duration)}</span>
            <span class="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">de treino</span>
          </div>` : ''}
        </div>

        <div class="grid grid-cols-2 gap-3 mb-4 stagger-enter" style="animation-delay:80ms">
          <div class="col-span-2 rounded-2xl border border-theme-accent/40 p-5 text-center"
               style="background:linear-gradient(135deg, rgba(var(--theme-rgb),0.08), rgba(var(--theme-rgb),0.03))">
            <div class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Carga Total</div>
            <div class="text-5xl font-black text-white font-mono tracking-tighter">${formatVolume(s.vol ?? 0)}</div>
          </div>
          <div class="glass-card rounded-2xl p-4 text-center border border-zinc-800/60">
            <i data-lucide="activity" class="w-4 h-4 text-theme-primary mx-auto mb-1.5"></i>
            <div class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Repetições</div>
            <div class="text-xl font-black text-white font-mono">${s.reps ?? 0}</div>
          </div>
          <div class="glass-card rounded-2xl p-4 text-center border border-zinc-800/60">
            <i data-lucide="zap" class="w-4 h-4 text-theme-primary mx-auto mb-1.5"></i>
            <div class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Séries</div>
            <div class="text-xl font-black text-white font-mono">${totalDoneSets}</div>
          </div>
        </div>

        ${s.mission?.commute ? (() => {
          const c = s.mission.commute;
          const modeIcon = { walk: 'move', run: 'zap', bike: 'activity' };
          const modeLabel = { walk: 'a pé', run: 'correndo', bike: 'bike' };
          const hasGoReturn = c.go && c.return && c.go.mode !== c.return.mode;
          const rows = hasGoReturn
            ? `
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5 text-[9px] text-zinc-500">
                    <i data-lucide="${modeIcon[c.go.mode] ?? 'move'}" class="w-3 h-3"></i>
                    <span class="font-bold uppercase">Ida</span>
                    <span class="text-zinc-700">· ${modeLabel[c.go.mode] ?? c.go.mode}</span>
                  </div>
                  <div class="text-[10px] font-mono text-cyan-400 font-bold">
                    ${c.go.distance}km · ${c.go.duration}min · ~${c.go.calories}kcal
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5 text-[9px] text-zinc-500">
                    <i data-lucide="${modeIcon[c.return.mode] ?? 'move'}" class="w-3 h-3"></i>
                    <span class="font-bold uppercase">Volta</span>
                    <span class="text-zinc-700">· ${modeLabel[c.return.mode] ?? c.return.mode}</span>
                  </div>
                  <div class="text-[10px] font-mono text-cyan-400 font-bold">
                    ${c.return.distance}km · ${c.return.duration}min · ~${c.return.calories}kcal
                  </div>
                </div>
              </div>`
            : `
              <div class="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Distância</div>
                  <div class="text-lg font-black font-mono text-cyan-400">${c.distance}km</div>
                </div>
                <div>
                  <div class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Tempo</div>
                  <div class="text-lg font-black font-mono text-cyan-400">${c.duration}min</div>
                </div>
                <div>
                  <div class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Estimativa</div>
                  <div class="text-lg font-black font-mono text-cyan-400">${c.calories}kcal</div>
                </div>
              </div>`;
          return `
          <div class="glass-card rounded-2xl border border-cyan-900/40 p-4 mb-4 stagger-enter"
               style="animation-delay:100ms;background:linear-gradient(135deg,rgba(8,145,178,0.07),transparent)">
            <h3 class="text-[10px] font-bold text-cyan-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <i data-lucide="move" class="w-3.5 h-3.5"></i> Locomoção
            </h3>
            ${rows}
            ${s.mission.totals?.calories > 0 ? `
            <div class="border-t border-cyan-900/30 mt-3 pt-2 text-center">
              <p class="text-[9px] text-zinc-600 font-mono">
                Missão total · <span class="text-zinc-300 font-black">${s.mission.totals.duration}min</span>
                · ~<span class="text-zinc-300 font-black">${s.mission.totals.calories.toLocaleString('pt-BR')} kcal</span>
                <span class="text-zinc-700"> (estimativa MET)</span>
              </p>
            </div>` : ''}
          </div>`;
        })() : ''}

        ${s.mvp?.name ? `
          <div class="glass-card rounded-2xl border border-yellow-900/40 p-4 mb-4 flex items-center gap-3 stagger-enter"
               style="animation-delay:120ms;background:linear-gradient(135deg,rgba(161,128,0,0.08),transparent)">
            <div class="w-10 h-10 rounded-full bg-yellow-900/20 border border-yellow-800/40 flex items-center justify-center shrink-0">
              <i data-lucide="zap" class="w-5 h-5 text-yellow-400"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[9px] font-bold text-yellow-600 uppercase tracking-widest">Exercício MVP</div>
              <div class="text-sm font-black text-white truncate">${s.mvp.name}</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-lg font-black font-mono text-yellow-400">${s.mvp.weight}kg</div>
              <div class="text-[9px] text-zinc-600 font-mono">1RM ~${Math.round(s.mvp.weight * (1 + (s.mvp.reps ?? 1) / 30))}kg</div>
            </div>
          </div>
        ` : ""}

        ${breakdownHtml ? `
          <div class="glass-card rounded-2xl border border-zinc-800/60 p-4 mb-4 stagger-enter"
               style="animation-delay:160ms">
            <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <i data-lucide="list" class="w-3.5 h-3.5"></i> Volume por Exercício
            </h3>
            ${breakdownHtml}
          </div>
        ` : ""}

        ${comparisonHtml}

        ${progressionHtml}

        ${(s.newAchievements ?? []).length > 0 ? `
          <div class="glass-card rounded-2xl border border-yellow-800/40 p-4 mb-4 stagger-enter"
               style="animation-delay:180ms;background:linear-gradient(135deg,rgba(161,128,0,0.07),transparent)">
            <h3 class="text-[10px] font-bold text-yellow-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <i data-lucide="trophy" class="w-3.5 h-3.5"></i> Conquista Desbloqueada!
            </h3>
            <div class="space-y-2">
              ${(s.newAchievements ?? []).map(id => {
                const a = ACHIEVEMENT_MAP[id];
                if (!a) return '';
                return `
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full bg-yellow-900/20 border border-yellow-800/40 flex items-center justify-center shrink-0">
                      <i data-lucide="${a.icon}" class="w-4 h-4 ${a.color}"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-black text-white">${a.name}</div>
                      <div class="text-[9px] text-zinc-500 font-mono">${a.desc}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <div class="rounded-2xl border border-white/5 p-5 mb-6 text-center stagger-enter"
             style="animation-delay:200ms;background:rgba(255,255,255,0.02)">
          <i data-lucide="info" class="w-4 h-4 text-theme-primary/40 mx-auto mb-2"></i>
          <p class="text-sm italic text-zinc-400 leading-relaxed font-mono">"${motivMsg}"</p>
          ${motivAuthor ? `<p class="text-[10px] text-zinc-600 font-mono mt-2">— ${motivAuthor}</p>` : ''}
        </div>

        <div class="space-y-3 stagger-enter" style="animation-delay:250ms">
          ${nextW ? `
          <button id="next-workout-btn"
                  class="ripple-target w-full py-4 rounded-2xl border border-theme-accent/60 bg-theme-dim/40
                         text-sm font-black text-theme-primary uppercase tracking-wide
                         flex items-center justify-center gap-2 active:scale-[0.98] transition-all
                         hover:bg-theme-dim/70">
            <i data-lucide="dumbbell" class="w-5 h-5"></i>
            Próximo: ${nextW.title}
          </button>` : nextIsOff ? `
          <div class="w-full py-3 rounded-2xl border border-zinc-800/60 bg-transparent text-center">
            <span class="text-[10px] text-zinc-600 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5">
              <i data-lucide="moon" class="w-3.5 h-3.5"></i> Próximo: Dia Off
            </span>
          </div>` : ''}
          <button id="end-operation"
                  class="btn-akatsuki w-full py-4 ripple-target text-sm font-black">
            <i data-lucide="check-circle" class="w-5 h-5"></i>
            ${L.closeReport}
          </button>
          <button id="share-report"
                  class="w-full py-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-400
                         text-xs font-bold uppercase tracking-wider hover:border-theme-dim
                         hover:text-theme-primary transition-all active:scale-[0.98]
                         flex items-center justify-center gap-2">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            Compartilhar resultado
          </button>
          <button id="discard-session"
                  class="w-full py-3 rounded-xl border border-zinc-800 bg-transparent text-zinc-600
                         text-xs font-bold uppercase tracking-wider hover:border-red-900/60
                         hover:text-red-500 hover:bg-red-900/10 transition-all active:scale-[0.98]">
            <i data-lucide="trash-2" class="w-3.5 h-3.5 inline mr-1.5"></i>
            Descartar esta sessão
          </button>
        </div>
      </div>
    </div>
  `;
}
