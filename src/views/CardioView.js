/**
 * CardioView — execução guiada de protocolos de cardio.
 * Pure render: renderCardio(state, protocols) → HTML string
 * Patches cirúrgicos: patchCardioTimer(state, protocols)
 */
import { delegate } from '../utils/dom.js';

// ─── Helpers ────────────────────────────────────────────────────────────

function fmtSecs(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function effortColor(effort) {
  if (effort === 'forte')    return 'text-red-400';
  if (effort === 'moderado') return 'text-yellow-400';
  return 'text-emerald-400';
}

function effortBg(effort) {
  if (effort === 'forte')    return 'bg-red-900/40 border-red-700/50 text-red-300';
  if (effort === 'moderado') return 'bg-yellow-900/40 border-yellow-700/50 text-yellow-300';
  return 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300';
}

function effortLabel(effort) {
  if (effort === 'forte')    return 'FORTE';
  if (effort === 'moderado') return 'MODERADO';
  return 'FÁCIL';
}

function kmFmt(distM) {
  const km = (distM || 0) / 1000;
  return km >= 1 ? `${km.toFixed(2)} km` : `${Math.round(distM || 0)} m`;
}

function paceFmt(durationMin, distM) {
  const km = (distM || 0) / 1000;
  if (km < 0.05 || durationMin < 0.1) return '--:--';
  const dec  = durationMin / km;
  const mins = Math.floor(dec);
  const secs = Math.round((dec - mins) * 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function speedFmt(durationMin, distM) {
  const km = (distM || 0) / 1000;
  if (km < 0.05 || durationMin < 0.1) return '--';
  return (km / (durationMin / 60)).toFixed(1);
}

// ─── Idle state (sem sessão ativa) ──────────────────────────────────────

function effortIdleCls(e) {
  if (e === 'forte')    return 'text-rose-400 bg-rose-900/20 border-rose-800/40';
  if (e === 'moderado') return 'text-amber-400 bg-amber-900/20 border-amber-800/40';
  return 'text-emerald-400 bg-emerald-900/20 border-emerald-800/40';
}
function effortIdleLabel(e) {
  if (e === 'forte')    return 'FORTE';
  if (e === 'moderado') return 'MODERADO';
  return 'FÁCIL';
}

function renderCardioIdle(state, protocols) {
  const { defaultCardioProtocol, cardioHistory = [] } = state;
  const last = cardioHistory[0];

  const lastHtml = last ? `
    <div class="glass-card p-3 rounded-2xl border border-zinc-800/60 flex items-center gap-3">
      <div class="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
        <i data-lucide="activity" class="w-4 h-4 text-theme-primary/70"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-[9px] text-zinc-600 uppercase font-bold tracking-wider">Última sessão</div>
        <div class="text-xs font-bold text-white">
          ${last.type === 'bike' ? 'Bike' : 'Corrida'}${last.local ? ` · ${last.local}` : ''}
          ${last.distance ? ` · ${last.distance}km` : ''}
          ${last.type === 'bike' && last.distance && last.duration
            ? ` · ${(last.distance / (last.duration / 60)).toFixed(1)}km/h`
            : last.pace ? ` · ${last.pace}/km` : last.duration ? ` · ${Math.round(last.duration)}min` : ''}
        </div>
      </div>
    </div>` : '';

  const cards = protocols.map(p => {
    const isDefault   = p.id === defaultCardioProtocol;
    const durationMin = Math.round((p.totalDuration || 0) / 60);
    return `
      <div class="glass-card p-4 rounded-2xl border ${isDefault ? 'border-theme-accent/50' : 'border-zinc-800/60'}">
        <div class="flex items-start justify-between gap-2 mb-3">
          <div class="flex-1 min-w-0">
            ${isDefault ? `<div class="text-[8px] font-bold text-theme-primary uppercase tracking-widest mb-1">Protocolo Padrão</div>` : ''}
            <div class="text-sm font-black text-white">${p.name}</div>
            <div class="text-[10px] text-zinc-500 mt-0.5">${p.description}</div>
          </div>
          <span class="text-[9px] font-bold px-2 py-1 rounded-lg border ${effortIdleCls(p.effort)} shrink-0">
            ${effortIdleLabel(p.effort)}
          </span>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 text-[9px] text-zinc-600 font-mono">
            <span><i data-lucide="clock" class="w-3 h-3 inline mr-0.5"></i>${durationMin}min</span>
            <span><i data-lucide="layers" class="w-3 h-3 inline mr-0.5"></i>${p.blocks.length} blocos</span>
          </div>
          <button data-action="start-cardio-protocol" data-protocol-id="${p.id}"
                  class="ripple-target flex items-center gap-1.5 px-4 py-2 rounded-xl
                         ${isDefault ? 'bg-theme-primary text-black shadow-[0_0_12px_var(--theme-primary)]/40' : 'bg-zinc-800 text-white border border-zinc-700'}
                         text-xs font-black uppercase tracking-wider active:scale-95 transition-all">
            <i data-lucide="play" class="w-3 h-3 pointer-events-none"></i>
            Iniciar
          </button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="stagger-enter space-y-4 pb-4">
      <h2 class="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2 flex items-center gap-2">
        <i data-lucide="wind" class="w-4 h-4"></i>
        Cardio
      </h2>

      ${lastHtml}

      <div class="space-y-3">${cards}</div>

      <button data-action="open-cardio-log"
              class="ripple-target w-full flex items-center justify-center gap-2 py-3 rounded-xl
                     border border-zinc-800 bg-zinc-900/30 text-zinc-500 text-xs font-bold uppercase
                     tracking-wider hover:border-theme-dim hover:text-theme-primary transition-all active:scale-[0.98]">
        <i data-lucide="plus" class="w-4 h-4"></i>
        Registrar Sessão Manual
      </button>
    </div>`;
}

// ─── Render principal ────────────────────────────────────────────────────

export function renderCardio(state, protocols) {
  const { activeCardioSession: s, theme } = state;
  if (!s) return renderCardioIdle(state, protocols);

  const protocol = protocols.find(p => p.id === s.protocolId);
  if (!protocol) return '<div></div>';

  const block       = protocol.blocks[s.blockIndex] ?? protocol.blocks[0];
  const blockIdx    = s.blockIndex;
  const totalBlocks = protocol.blocks.length;
  const isLivre     = protocol.id === 'livre';
  const paused      = !!s.paused;
  const completed   = !!s.completed;

  // Progresso do bloco
  const blockPct = (block.duration > 0 && !isLivre)
    ? Math.min(100, Math.round((s.blockElapsed / block.duration) * 100))
    : null;

  // Tempo restante no bloco
  const blockRemaining = (block.duration > 0 && !isLivre)
    ? Math.max(0, block.duration - s.blockElapsed)
    : null;

  // Stats GPS
  const durationMin = s.totalElapsed / 60;
  const distM       = s.distanceM || 0;

  // Lista de blocos (navegação lateral)
  const blockList = protocol.blocks.map((b, i) => {
    const done    = i < blockIdx;
    const current = i === blockIdx;
    return `
      <div class="flex items-center gap-2 py-1 ${current ? 'opacity-100' : done ? 'opacity-40' : 'opacity-50'}">
        <div class="w-2 h-2 rounded-full flex-shrink-0 ${current ? 'bg-[var(--theme-accent)] scale-125' : done ? 'bg-emerald-500' : 'bg-white/20'}"></div>
        <span class="text-xs ${current ? 'text-white font-bold' : 'text-white/60'}">${b.name}</span>
        ${b.duration > 0 ? `<span class="text-xs text-white/30 ml-auto">${fmtSecs(b.duration)}</span>` : ''}
      </div>`;
  }).join('');

  // Próximo bloco
  const nextBlock = !isLivre && blockIdx + 1 < totalBlocks ? protocol.blocks[blockIdx + 1] : null;

  if (completed) {
    return renderCompleted(s, protocol, durationMin, distM);
  }

  return `
<div id="cardio-view" class="h-full flex flex-col bg-black relative overflow-hidden">

  <!-- Fundo animado -->
  <div class="absolute inset-0 pointer-events-none">
    <div class="absolute inset-0 bg-gradient-to-b from-[var(--theme-accent)]/5 via-transparent to-black/80"></div>
  </div>

  <!-- Header -->
  <div class="relative z-10 flex items-center justify-between px-4 pt-4 pb-2">
    <button data-action="cardio-abandon"
      class="flex items-center gap-1 text-white/40 hover:text-white/70 text-sm py-2 px-3 rounded-lg touch-target">
      <i data-lucide="x" class="w-4 h-4"></i>
      <span>Sair</span>
    </button>
    <div class="flex flex-col items-center gap-0.5">
      <div class="flex items-center gap-1.5">
        <div class="text-xs text-white/40 uppercase tracking-widest">${protocol.name}</div>
        <button data-action="show-hint" data-payload="cardio_zones"
                class="w-3.5 h-3.5 rounded-full border border-white/20 text-white/30 flex items-center justify-center text-[8px] font-black leading-none active:scale-90 transition-all">i</button>
      </div>
      ${(s.type || s.local) ? `
      <div class="text-[9px] font-bold text-white/25 uppercase tracking-wider">
        ${s.type === 'bike' ? 'Bike' : 'Corrida'}${s.local ? ` · ${s.local}` : ''}
      </div>` : ''}
    </div>
    <div class="flex items-center gap-1 text-white/40 text-sm">
      <i data-lucide="clock" class="w-3 h-3"></i>
      <span id="cardio-total-elapsed">${fmtSecs(s.totalElapsed)}</span>
    </div>
  </div>

  <!-- Bloco atual — destaque central -->
  <div class="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-2">

    <!-- Nome do bloco -->
    <div id="cardio-block-name"
      class="text-2xl font-black uppercase tracking-wider text-white mb-1 text-center">
      ${block.name}
    </div>

    <!-- Badge de esforço -->
    <div id="cardio-effort-badge"
      class="text-xs font-bold px-3 py-1 rounded-full border mb-4 ${effortBg(block.effort)}">
      ${effortLabel(block.effort)}
    </div>

    <!-- Timer do bloco -->
    ${!isLivre && block.duration > 0 ? `
    <div class="relative mb-4">
      <!-- Anel de progresso SVG -->
      <svg class="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8"/>
        <circle id="cardio-ring" cx="60" cy="60" r="52" fill="none"
          stroke="var(--theme-accent)" stroke-width="8" stroke-linecap="round"
          stroke-dasharray="${2 * Math.PI * 52}"
          stroke-dashoffset="${2 * Math.PI * 52 * (1 - (blockPct / 100))}"
          style="transition: stroke-dashoffset 0.8s linear;"/>
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span id="cardio-block-remaining" class="text-4xl font-black text-white tabular-nums">
          ${fmtSecs(blockRemaining)}
        </span>
        <span class="text-xs text-white/40 mt-1">restam</span>
      </div>
    </div>
    ` : `
    <div class="mb-4 flex flex-col items-center">
      <span id="cardio-block-elapsed" class="text-5xl font-black text-white tabular-nums">
        ${fmtSecs(s.blockElapsed)}
      </span>
      <span class="text-xs text-white/40 mt-1">em andamento</span>
    </div>
    `}

    <!-- Instrução -->
    <div id="cardio-instruction"
      class="text-center text-white/70 text-sm px-6 leading-relaxed mb-4 min-h-[2.5rem]">
      ${block.instruction}
    </div>

    <!-- Talk Test (aparece 2min+ em blocos moderado/forte, oculto após resposta) -->
    <div id="cardio-talk-test" class="hidden w-full max-w-sm mb-3">
      <div class="text-[9px] text-white/35 uppercase tracking-widest text-center mb-2">Checagem de esforço</div>
      <div class="text-[11px] text-white/60 text-center mb-2.5">Você consegue falar frases completas?</div>
      <div class="grid grid-cols-3 gap-1.5">
        <button data-action="cardio-talk-test-answer" data-payload="frases_completas"
          class="ripple-target py-2.5 px-1 rounded-xl bg-emerald-900/40 border border-emerald-700/50
                 text-emerald-300 text-[8px] font-bold leading-snug active:scale-95 transition-all text-center">
          Sim, consigo<br>conversar
        </button>
        <button data-action="cardio-talk-test-answer" data-payload="com_dificuldade"
          class="ripple-target py-2.5 px-1 rounded-xl bg-amber-900/40 border border-amber-700/50
                 text-amber-300 text-[8px] font-bold leading-snug active:scale-95 transition-all text-center">
          Consigo,<br>com esforço
        </button>
        <button data-action="cardio-talk-test-answer" data-payload="apenas_palavras"
          class="ripple-target py-2.5 px-1 rounded-xl bg-rose-900/40 border border-rose-700/50
                 text-rose-300 text-[8px] font-bold leading-snug active:scale-95 transition-all text-center">
          Não, poucas<br>palavras
        </button>
      </div>
    </div>
    <div id="cardio-talk-test-done" class="hidden text-[9px] text-white/30 text-center mb-2">
      ✓ Checagem de esforço registrada
    </div>

    <!-- Stats GPS -->
    <div class="grid grid-cols-3 gap-3 w-full max-w-sm mb-4">
      <div class="bg-white/5 rounded-xl p-3 text-center">
        <div id="cardio-gps-dist" class="text-lg font-bold text-white">${kmFmt(distM)}</div>
        <div class="text-xs text-white/40 mt-0.5">Distância</div>
      </div>
      <div class="bg-white/5 rounded-xl p-3 text-center">
        <div id="cardio-gps-pace" class="text-lg font-bold text-[var(--theme-accent)]">
          ${s.type === 'bike' ? speedFmt(durationMin, distM) : paceFmt(durationMin, distM)}
        </div>
        <div id="cardio-gps-pace-label" class="text-xs text-white/40 mt-0.5">
          ${s.type === 'bike' ? 'km/h' : 'Pace/km'}
        </div>
      </div>
      <div class="bg-white/5 rounded-xl p-3 text-center">
        <div id="cardio-block-prog" class="text-lg font-bold text-white">${blockIdx + 1}/${totalBlocks}</div>
        <div class="text-xs text-white/40 mt-0.5">Bloco</div>
      </div>
    </div>

    <!-- Próximo bloco -->
    ${nextBlock ? `
    <div id="cardio-next-block" class="text-xs text-white/30 text-center mb-2">
      Próximo: <span class="${effortColor(nextBlock.effort)}">${nextBlock.name}</span>
      ${nextBlock.duration > 0 ? `· ${fmtSecs(nextBlock.duration)}` : ''}
    </div>
    ` : `<div id="cardio-next-block" class="text-xs text-[var(--theme-accent)] text-center mb-2 font-bold">ÚLTIMO BLOCO</div>`}

  </div>

  <!-- Lista de blocos (colapsada, scroll) -->
  <div class="relative z-10 px-4 pb-2">
    <details class="bg-white/5 rounded-xl overflow-hidden">
      <summary class="text-xs text-white/40 uppercase tracking-widest px-3 py-2 cursor-pointer select-none">
        Protocolo completo (${totalBlocks} blocos)
      </summary>
      <div class="px-3 pb-3">${blockList}</div>
    </details>
  </div>

  <!-- Controles -->
  <div class="relative z-10 px-4 pb-6 pt-2 flex flex-col gap-3">

    ${paused ? `
    <!-- PAUSADO -->
    <div class="text-center text-yellow-400 font-bold text-sm uppercase tracking-widest mb-1 animate-pulse">
      PAUSADO
    </div>
    <div class="grid grid-cols-2 gap-3">
      <button data-action="cardio-resume"
        class="bg-[var(--theme-accent)] text-white font-bold py-3 rounded-xl text-sm uppercase tracking-widest flex items-center justify-center gap-2">
        <i data-lucide="play" class="w-4 h-4"></i> Retomar
      </button>
      <button data-action="cardio-finish"
        class="bg-white/10 border border-white/20 text-white font-bold py-3 rounded-xl text-sm uppercase tracking-widest flex items-center justify-center gap-2">
        <i data-lucide="check-circle" class="w-4 h-4"></i> Finalizar
      </button>
    </div>
    ` : `
    <!-- EM ANDAMENTO -->
    <div class="grid grid-cols-3 gap-2">
      <button data-action="cardio-pause"
        class="bg-white/10 border border-white/20 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-1">
        <i data-lucide="pause" class="w-4 h-4"></i>
      </button>
      ${!isLivre ? `
      <button data-action="cardio-skip-block"
        class="bg-white/5 border border-white/10 text-white/60 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1">
        <i data-lucide="chevron-right" class="w-4 h-4"></i>
        <span>Pular</span>
      </button>
      ` : '<div></div>'}
      <button data-action="cardio-finish"
        class="bg-[var(--theme-accent)] text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-1">
        <i data-lucide="check-circle" class="w-4 h-4"></i>
        <span>Fim</span>
      </button>
    </div>
    `}

  </div>

</div>`;
}

// ─── Tela de protocolo concluído ─────────────────────────────────────────

function renderCompleted(s, protocol, durationMin, distM) {
  const isBike    = s.type === 'bike';
  const modeIcon  = isBike ? 'activity' : s.local === 'esteira' ? 'repeat' : 'wind';
  const modeLabel = isBike ? 'Bike' : s.local === 'esteira' ? 'Esteira' : 'Corrida · Rua';
  return `
<div id="cardio-view" class="h-full flex flex-col items-center justify-center bg-black px-4 py-8">
  <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-sm text-center mb-6">
    <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-900/30 border border-emerald-700/40 flex items-center justify-center">
      <i data-lucide="${modeIcon}" class="w-7 h-7 text-emerald-400"></i>
    </div>
    <div class="text-emerald-400 font-black text-xl uppercase tracking-widest mb-1">Protocolo Concluído!</div>
    <div class="text-white/40 text-xs uppercase tracking-wider">${protocol.name} · ${modeLabel}</div>
  </div>
  <div class="grid grid-cols-3 gap-3 w-full max-w-sm mb-6">
    <div class="bg-white/5 rounded-xl p-3 text-center">
      <div class="text-xl font-bold text-white">${fmtSecs(s.totalElapsed)}</div>
      <div class="text-xs text-white/40 mt-0.5">Tempo</div>
    </div>
    <div class="bg-white/5 rounded-xl p-3 text-center">
      <div class="text-xl font-bold text-white">${kmFmt(distM)}</div>
      <div class="text-xs text-white/40 mt-0.5">Distância</div>
    </div>
    <div class="bg-white/5 rounded-xl p-3 text-center">
      <div class="text-xl font-bold text-[var(--theme-accent)]">
        ${isBike ? speedFmt(durationMin, distM) : paceFmt(durationMin, distM)}
      </div>
      <div class="text-xs text-white/40 mt-0.5">${isBike ? 'km/h' : 'Pace/km'}</div>
    </div>
  </div>
  <button data-action="cardio-finish"
    class="w-full bg-[var(--theme-accent)] text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest">
    Ver Relatório
  </button>
</div>`;
}

// ─── Patch cirúrgico (tick) ──────────────────────────────────────────────

export function patchCardioTimer(state, protocols) {
  const s = state.activeCardioSession;
  if (!s) return;

  const protocol = protocols.find(p => p.id === s.protocolId);
  if (!protocol) return;

  const isLivre = protocol.id === 'livre';
  const block   = protocol.blocks[s.blockIndex] ?? protocol.blocks[0];

  // Total elapsed
  const elapsedEl = document.getElementById('cardio-total-elapsed');
  if (elapsedEl) elapsedEl.textContent = fmtSecs(s.totalElapsed);

  // Bloco nome + instrução (muda quando bloco avança)
  const nameEl = document.getElementById('cardio-block-name');
  if (nameEl && nameEl.textContent.trim() !== block.name) {
    nameEl.textContent = block.name;
    const instEl = document.getElementById('cardio-instruction');
    if (instEl) instEl.textContent = block.instruction;
    const effortEl = document.getElementById('cardio-effort-badge');
    if (effortEl) {
      effortEl.className = `text-xs font-bold px-3 py-1 rounded-full border mb-4 ${effortBg(block.effort)}`;
      effortEl.textContent = effortLabel(block.effort);
    }
  }

  // Progresso bloco
  const blockProgEl = document.getElementById('cardio-block-prog');
  const blockIdx    = s.blockIndex;
  const totalBlocks = protocol.blocks.length;
  if (blockProgEl) blockProgEl.textContent = `${blockIdx + 1}/${totalBlocks}`;

  // Próximo bloco
  const nextBlockEl = document.getElementById('cardio-next-block');
  if (nextBlockEl) {
    const nextBlock = !isLivre && blockIdx + 1 < totalBlocks ? protocol.blocks[blockIdx + 1] : null;
    if (nextBlock) {
      nextBlockEl.innerHTML = `Próximo: <span class="${effortColor(nextBlock.effort)}">${nextBlock.name}</span>${nextBlock.duration > 0 ? ` · ${fmtSecs(nextBlock.duration)}` : ''}`;
    } else {
      nextBlockEl.innerHTML = '<span class="text-[var(--theme-accent)] font-bold">ÚLTIMO BLOCO</span>';
    }
  }

  if (!isLivre && block.duration > 0) {
    const blockRemaining = Math.max(0, block.duration - s.blockElapsed);
    const blockPct       = Math.min(100, (s.blockElapsed / block.duration) * 100);
    const remEl          = document.getElementById('cardio-block-remaining');
    if (remEl) remEl.textContent = fmtSecs(blockRemaining);
    const ring = document.getElementById('cardio-ring');
    if (ring) {
      const circumference = 2 * Math.PI * 52;
      ring.style.strokeDashoffset = circumference * (1 - blockPct / 100);
    }
  } else {
    const elEl = document.getElementById('cardio-block-elapsed');
    if (elEl) elEl.textContent = fmtSecs(s.blockElapsed);
  }

  // Talk test: aparece 2min+ em blocos moderado/forte; oculto após resposta
  const talkTestEl  = document.getElementById('cardio-talk-test');
  const talkDoneEl  = document.getElementById('cardio-talk-test-done');
  if (talkTestEl && talkDoneEl) {
    const hasAnswered = (s.blockFeedback ?? []).some(f => f.blockIndex === blockIdx);
    if (hasAnswered) {
      talkTestEl.classList.add('hidden');
      talkDoneEl.classList.remove('hidden');
    } else if (block.effort !== 'fácil' && s.blockElapsed >= 120) {
      talkTestEl.classList.remove('hidden');
      talkDoneEl.classList.add('hidden');
    } else {
      talkTestEl.classList.add('hidden');
      talkDoneEl.classList.add('hidden');
    }
  }

  // GPS stats
  const distM       = s.distanceM || 0;
  const durationMin = s.totalElapsed / 60;
  const isBike      = s.type === 'bike';
  const distEl      = document.getElementById('cardio-gps-dist');
  const paceEl      = document.getElementById('cardio-gps-pace');
  const paceLblEl   = document.getElementById('cardio-gps-pace-label');
  if (distEl) distEl.textContent = kmFmt(distM);
  if (paceEl) paceEl.textContent = isBike ? speedFmt(durationMin, distM) : paceFmt(durationMin, distM);
  if (paceLblEl && paceLblEl.textContent.trim() !== (isBike ? 'km/h' : 'Pace/km')) {
    paceLblEl.textContent = isBike ? 'km/h' : 'Pace/km';
  }
}

// ─── Mount ──────────────────────────────────────────────────────────────

export function mountCardio(container, handler) {
  delegate(container, '[data-action]', 'click', (e, el) => {
    handler(el.dataset.action, el.dataset.payload ?? el.dataset.protocolId);
  });
}
