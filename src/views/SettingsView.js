import { THEMES } from '../services/ThemeService.js';
import { delegate, createRipple } from '../utils/dom.js';
import { getLabels } from '../utils/labels.js';

const APP_VERSION = '6.1';

export function renderSettings(state, workouts = [], protocols = []) {
  const {
    theme = 'default', appMode = 'ninja', cycleGoal = 6,
    userName = '', projectName = '', goal = null, lightMode = false, weekPlan = {},
    inactivityResetDays = 0, defaultRestTime = 60,
    vibrationEnabled = true, timerSoundEnabled = true, weightIncrement = 2.5,
    autoFillOnStart = false,
    cardioCountsStreak = false, weeklyCardioKmGoal = null, weeklyCardioMinGoal = null,
    defaultCardioProtocol = 'zona2-30',
    notificationsEnabled = false, notificationTime = '08:00',
    activeCommute = { enabled: false, oneWayDistanceKm: 1.1, mode: 'walk', estimatedSpeed: 4.8 },
    cycleOrder = [],
  } = state;
  const commuteBodyWeight = state.biometrics?.weight ?? 80;

  const storageSize = (() => {
    try {
      let total = 0;
      for (const k of Object.keys(localStorage)) total += (localStorage.getItem(k) ?? '').length * 2;
      if (total < 1024) return `${total} B`;
      if (total < 1048576) return `${Math.round(total / 1024)} KB`;
      return `${(total / 1048576).toFixed(1)} MB`;
    } catch { return '—'; }
  })();
  const today = new Date().getDay();
  const L = getLabels(appMode);
  const notifPerm = (typeof Notification !== 'undefined') ? Notification.permission : 'default';

  /* ── helpers ─────────────────────────────────────────────────────── */

  const toggleCls = (on) =>
    on ? 'bg-theme-primary border-theme-accent' : 'bg-zinc-800 border-zinc-700';
  const knobCls = (on) =>
    on ? 'left-[calc(100%-1.375rem)]' : 'left-0.5';

  const toggle = (action, on) => `
    <button data-action="${action}"
            class="ripple-target relative w-12 h-6 rounded-full border transition-all duration-300 active:scale-90 ${toggleCls(on)} shrink-0">
      <div class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${knobCls(on)}"></div>
    </button>`;

  const presetBtn = (action, dataAttr, val, active, label) => `
    <button data-action="${action}" data-${dataAttr}="${val}"
            class="ripple-target flex-1 py-2 rounded-xl text-[10px] font-black border transition-all active:scale-95
                   ${active
                     ? 'bg-theme-dim border-theme-accent text-theme-primary'
                     : 'bg-zinc-900/40 border-zinc-800 text-zinc-500 hover:border-zinc-600'}">
      ${label}
    </button>`;

  const themeSwatches = Object.entries(THEMES).map(([key, cfg]) => {
    const active = key === theme;
    return `
      <button data-action="set-theme" data-theme="${key}"
              class="ripple-target flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all active:scale-90
                     ${active ? 'border-white/30 bg-white/5 shadow-[0_0_12px_rgba(255,255,255,0.08)]' : 'border-zinc-800 hover:border-zinc-600'}">
        <div class="w-8 h-8 rounded-full border-2 ${active ? 'border-white/50 scale-110' : 'border-transparent'} transition-all"
             style="background:${cfg.primary};box-shadow:${active ? `0 0 10px ${cfg.primary}` : 'none'}"></div>
        <span class="text-[8px] font-black tracking-wider uppercase ${active ? 'text-white' : 'text-zinc-600'} leading-none">${cfg.name}</span>
      </button>`;
  }).join('');

  return `
    <div class="stagger-enter space-y-5 pb-4">

      <!-- DURANTE O TREINO ────────────────────────────────────────────── -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/70 space-y-4">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="dumbbell" class="w-3.5 h-3.5"></i>
          Durante o Treino
        </h3>

        <!-- Descanso -->
        <div>
          <p class="text-xs text-zinc-300 font-bold mb-0.5">Descanso Entre Séries</p>
          <p class="text-[9px] text-zinc-600 mb-3">0s = superset · 90–180s = compostos pesados</p>
          <div class="flex gap-1.5">
            ${[0, 45, 60, 90, 180].map(s =>
              presetBtn('set-default-rest', 'seconds', s, defaultRestTime === s,
                s === 0 ? 'Super' : s < 60 ? `${s}s` : s % 60 === 0 ? `${s/60}min` : `${s}s`)
            ).join('')}
          </div>
        </div>

        <!-- Incremento de Carga -->
        <div class="pt-3 border-t border-zinc-800/60">
          <p class="text-xs text-zinc-300 font-bold mb-0.5">Incremento de Carga</p>
          <p class="text-[9px] text-zinc-600 mb-3">Salto nos botões +/− de peso durante o treino</p>
          <div class="flex gap-1.5">
            ${[1, 2.5, 5].map(inc =>
              presetBtn('set-weight-increment', 'increment', inc, weightIncrement === inc, `${inc}kg`)
            ).join('')}
          </div>
        </div>

        <!-- Pré-carregar sessão anterior -->
        <div class="pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-zinc-300 font-bold">Pré-carregar Sessão Anterior</p>
            <p class="text-[9px] text-zinc-600 mt-0.5">Preenche peso e reps ao entrar · só ativa sem rascunho salvo</p>
          </div>
          ${toggle('toggle-auto-fill-on-start', autoFillOnStart)}
        </div>

        <!-- Vibração -->
        <div class="pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-zinc-300 font-bold">Vibração</p>
            <p class="text-[9px] text-zinc-600 mt-0.5">Ao marcar série concluída e no timer</p>
          </div>
          ${toggle('toggle-vibration', vibrationEnabled)}
        </div>

        <!-- Som do Timer -->
        <div class="pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-zinc-300 font-bold">Som do Timer</p>
            <p class="text-[9px] text-zinc-600 mt-0.5">Beeps ao fim do descanso</p>
          </div>
          ${toggle('toggle-timer-sound', timerSoundEnabled)}
        </div>
      </div>

      <!-- PLANEJAMENTO ─────────────────────────────────────────────────── -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/70 space-y-4">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="calendar-check" class="w-3.5 h-3.5"></i>
          Planejamento
        </h3>

        <!-- Meta do ciclo -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-zinc-300 font-bold">${L.weekLabel}</p>
            <p class="text-[10px] text-zinc-600 mt-0.5">${L.workoutPlural.charAt(0).toUpperCase() + L.workoutPlural.slice(1)} por ciclo</p>
          </div>
          <div class="flex items-center gap-3">
            <button data-action="set-week-goal" data-delta="-1"
                    class="ripple-target w-11 h-11 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300
                           flex items-center justify-center text-lg font-black active:scale-90 transition-all">−</button>
            <span class="text-2xl font-black font-mono text-theme-primary w-6 text-center">${cycleGoal}</span>
            <button data-action="set-week-goal" data-delta="1"
                    class="ripple-target w-11 h-11 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300
                           flex items-center justify-center text-lg font-black active:scale-90 transition-all">+</button>
          </div>
        </div>

        <!-- Ordem do Ciclo -->
        ${cycleOrder.length > 0 ? `
        <div class="pt-3 border-t border-zinc-800/60">
          <p class="text-xs text-zinc-300 font-bold mb-0.5">Ordem do Ciclo</p>
          <p class="text-[9px] text-zinc-600 mb-3">Defina quais posições são treino ou dia OFF</p>
          <div class="space-y-1.5">
            ${cycleOrder.map((wId, i) => {
              const isOff = wId === null || wId === undefined;
              return `
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-mono text-zinc-700 w-4 shrink-0">${i + 1}</span>
                  <select data-action="set-cycle-position" data-idx="${i}"
                          class="input-ninja flex-1 py-1.5 rounded-lg text-[10px] font-bold px-2 cursor-pointer">
                    <option value=""${isOff ? ' selected' : ''}>— Dia OFF —</option>
                    ${workouts.filter(w => !w.isCardio).map(w =>
                      `<option value="${w.id}"${wId === w.id ? ' selected' : ''}>${w.label ? `${w.label} · ` : ''}${w.title}</option>`
                    ).join('')}
                  </select>
                </div>`;
            }).join('')}
          </div>
          <p class="text-[9px] text-zinc-700 mt-2 font-mono">Alterar o ciclo reinicia a posição atual</p>
        </div>` : ''}

        <!-- Calendário semanal -->
        <div class="pt-3 border-t border-zinc-800/60">
          <p class="text-xs text-zinc-300 font-bold mb-0.5">Calendário Semanal</p>
          <p class="text-[9px] text-zinc-600 mb-3">Define a "Missão de Hoje" na tela inicial</p>
          <div class="space-y-1.5">
            ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((label, i) => {
              const planned = weekPlan[i] ?? '';
              const isToday = today === i;
              return `
                <div class="flex items-center gap-2.5 ${isToday ? 'bg-theme-dim/40 border border-theme-dim/40 rounded-lg px-2 py-1 -mx-2' : ''}">
                  <div class="w-7 shrink-0">
                    <div class="text-[10px] font-black uppercase ${isToday ? 'text-theme-primary' : 'text-zinc-600'}">${label}</div>
                    ${isToday ? '<div class="text-[7px] text-theme-primary font-bold uppercase leading-none">hoje</div>' : ''}
                  </div>
                  <select data-action="set-day-plan" data-day="${i}"
                          class="input-ninja flex-1 py-1.5 rounded-lg text-[10px] font-bold px-2 cursor-pointer">
                    <option value="">— Descanso —</option>
                    ${workouts.map(w => `<option value="${w.id}"${planned === w.id ? ' selected' : ''}>${w.label ? `${w.label} · ` : ''}${w.title}</option>`).join('')}
                  </select>
                </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Avançado (colapsado) -->
        <details class="pt-3 border-t border-zinc-800/60">
          <summary class="text-[9px] text-zinc-600 font-bold uppercase tracking-widest cursor-pointer select-none
                          flex items-center gap-1.5 list-none py-0.5 active:text-zinc-400 transition-colors">
            <i data-lucide="settings" class="w-3 h-3"></i>
            Avançado
          </summary>
          <div class="mt-3">
            <p class="text-xs text-zinc-300 font-bold mb-0.5">Reset por Inatividade</p>
            <p class="text-[9px] text-zinc-600 mb-3">Reinicia o ciclo automaticamente após X dias sem atividade</p>
            <div class="flex gap-1.5">
              ${[0, 7, 10, 14].map(d =>
                presetBtn('set-week-reset-days', 'days', d, inactivityResetDays === d,
                  d === 0 ? 'OFF' : `${d}d`)
              ).join('')}
            </div>
          </div>
        </details>
      </div>

      <!-- CARDIO ──────────────────────────────────────────────────────── -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/70 space-y-4">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="activity" class="w-3.5 h-3.5"></i>
          Cardio
        </h3>

        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-zinc-300 font-bold">Incluir cardio no streak</p>
            <p class="text-[9px] text-zinc-600 mt-0.5">Sessões de cardio mantêm o streak ativo</p>
          </div>
          ${toggle('set-cardio-counts-streak', cardioCountsStreak)}
        </div>

        ${protocols.length ? `
        <div class="pt-3 border-t border-zinc-800/60">
          <p class="text-xs text-zinc-300 font-bold mb-1.5">Protocolo Padrão</p>
          <select data-action="set-default-cardio-protocol"
                  class="input-ninja w-full py-2.5 rounded-xl text-sm font-bold px-3 cursor-pointer">
            ${protocols.map(p => `<option value="${p.id}"${defaultCardioProtocol === p.id ? ' selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>
        ` : ''}

        <div class="pt-3 border-t border-zinc-800/60">
          <p class="text-xs text-zinc-300 font-bold mb-1.5">Distância semanal</p>
          <input type="tel" inputmode="decimal" data-action="cardio-km-live"
                 value="${weeklyCardioKmGoal ?? ''}" placeholder="Ex: 20 km"
                 class="input-ninja w-full py-2.5 text-sm font-bold text-center rounded-xl" />
        </div>

        <div class="pt-3 border-t border-zinc-800/60">
          <p class="text-xs text-zinc-300 font-bold mb-1.5">Tempo de cardio semanal</p>
          <input type="tel" inputmode="numeric" data-action="cardio-min-live"
                 value="${weeklyCardioMinGoal ?? ''}" placeholder="Ex: 150 min"
                 class="input-ninja w-full py-2.5 text-sm font-bold text-center rounded-xl" />
        </div>
      </div>

      <!-- DESLOCAMENTO ATIVO ─────────────────────────────────────────── -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/70 space-y-4">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="move" class="w-3.5 h-3.5"></i>
          Deslocamento Ativo
        </h3>
        <p class="text-[9px] text-zinc-600 leading-relaxed -mt-1">Registra automaticamente a ida+volta ao treino como carga de locomoção no Battle Report</p>

        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-zinc-300 font-bold">Ativo</p>
            <p class="text-[9px] text-zinc-600 mt-0.5">Inclui deslocamento no relatório da sessão</p>
          </div>
          ${toggle('toggle-active-commute', activeCommute.enabled)}
        </div>

        ${activeCommute.enabled ? `
        <div class="space-y-4 pt-3 border-t border-zinc-800/60">

          <!-- Distância (ida) -->
          <div>
            <p class="text-xs text-zinc-300 font-bold mb-1.5">Distância — ida (km)</p>
            <input type="tel" inputmode="decimal" data-action="commute-km-live"
                   value="${activeCommute.oneWayDistanceKm}"
                   placeholder="Ex: 1.1"
                   class="input-ninja w-full py-2.5 text-sm font-bold text-center rounded-xl" />
          </div>

          <!-- Modo de deslocamento -->
          <div>
            <p class="text-xs text-zinc-300 font-bold mb-2">Modo</p>
            <div class="flex gap-1.5">
              ${presetBtn('set-commute-mode', 'mode', 'walk', activeCommute.mode === 'walk', 'Caminhada')}
              ${presetBtn('set-commute-mode', 'mode', 'bike', activeCommute.mode === 'bike', 'Bike')}
            </div>
          </div>

          <!-- Velocidade estimada -->
          <div>
            <p class="text-xs text-zinc-300 font-bold mb-2">Velocidade média (km/h)</p>
            <div class="flex gap-1.5">
              ${[3.5, 4.8, 6, 15, 20].map(spd =>
                presetBtn('set-commute-speed', 'speed', spd, activeCommute.estimatedSpeed === spd, `${spd}`)
              ).join('')}
            </div>
          </div>

          <!-- Preview calculado -->
          ${(() => {
            const distKm = Math.round((activeCommute.oneWayDistanceKm || 0) * 2 * 10) / 10;
            const durationMin = distKm > 0 && (activeCommute.estimatedSpeed || 0) > 0
              ? Math.round((distKm / activeCommute.estimatedSpeed) * 60) : 0;
            const MET = activeCommute.mode === 'bike' ? 6.0 : 3.5;
            const cal = Math.round(MET * commuteBodyWeight * (durationMin / 60));
            return `
            <div class="rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-3">
              <p class="text-[10px] text-zinc-400 font-mono text-center leading-relaxed">
                Ida + volta: <span class="text-white font-black">${distKm.toFixed(1)}km</span>
                · <span class="text-white font-black">${durationMin}min</span>
                · ~<span class="text-white font-black">${cal}kcal</span>
                <span class="text-zinc-700">(MET)</span>
              </p>
              <p class="text-[9px] text-zinc-700 font-mono text-center mt-1">estimativa fisiológica por sessão</p>
            </div>`;
          })()}

        </div>
        ` : ''}
      </div>

      <!-- NOTIFICAÇÕES ────────────────────────────────────────────────── -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/70 space-y-4">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="bell" class="w-3.5 h-3.5"></i>
          Notificações
        </h3>

        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-zinc-300 font-bold">Lembrete diário</p>
            <p class="text-[9px] text-zinc-600 mt-0.5">Notifica quando não treinar no dia</p>
          </div>
          ${toggle('toggle-notifications', notificationsEnabled)}
        </div>

        ${notificationsEnabled && notifPerm === 'denied' ? `
        <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-900/15 border border-red-900/30">
          <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-red-400 shrink-0"></i>
          <p class="text-[9px] text-red-400 font-bold leading-tight">Permissão negada pelo sistema. Ative nas configurações do dispositivo.</p>
        </div>
        ` : notificationsEnabled && notifPerm === 'granted' ? `
        <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-900/15 border border-green-900/30">
          <i data-lucide="check-circle" class="w-3.5 h-3.5 text-green-400 shrink-0"></i>
          <p class="text-[9px] text-green-400 font-bold">Permissão concedida</p>
        </div>
        ` : ''}

        ${notificationsEnabled ? `
        <div class="pt-3 border-t border-zinc-800/60">
          <p class="text-xs text-zinc-300 font-bold mb-1.5">Notificar às</p>
          <div class="flex gap-2">
            <input type="time" id="notif-time-input"
                   value="${notificationTime}"
                   class="input-ninja flex-1 py-2.5 rounded-xl text-sm font-bold text-center" />
            <button data-action="save-notification-time"
                    class="ripple-target px-4 py-2.5 bg-theme-dim border border-theme-accent text-theme-primary text-xs font-black rounded-xl active:scale-95 transition-all">
              OK
            </button>
          </div>
          <p class="text-[9px] text-zinc-700 font-mono mt-1.5">Aparece quando você abrir o app após esse horário sem ter treinado</p>
        </div>
        ` : ''}
      </div>

      <!-- APARÊNCIA ───────────────────────────────────────────────────── -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/70 space-y-4">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="palette" class="w-3.5 h-3.5"></i>
          Aparência
        </h3>

        <div>
          <p class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider mb-3">Tema de Cores</p>
          <div class="grid grid-cols-2 gap-2">${themeSwatches}</div>
        </div>

        <div class="pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-zinc-300 font-bold">Modo Visual</p>
            <p class="text-[10px] text-zinc-600 mt-0.5">${lightMode ? 'Modo Claro ativo' : 'Modo Escuro ativo'}</p>
          </div>
          <button data-action="toggle-light-mode"
                  class="ripple-target flex items-center gap-2 px-3 py-2 rounded-lg border transition-all active:scale-95 shrink-0
                         ${lightMode ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-zinc-800/60 border-zinc-700 text-zinc-300'}">
            <i data-lucide="${lightMode ? 'sun' : 'moon'}" class="w-3.5 h-3.5"></i>
            <span class="text-[10px] font-black uppercase tracking-wider">${lightMode ? 'Claro' : 'Escuro'}</span>
          </button>
        </div>
      </div>

      <!-- IDENTIDADE ──────────────────────────────────────────────────── -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/70 space-y-4">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="circle-user" class="w-3.5 h-3.5"></i>
          Identidade
        </h3>

        <!-- Nome -->
        <div>
          <label class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider block mb-1.5">Nome</label>
          <div class="flex gap-2">
            <input id="settings-name-input" type="text" maxlength="32"
                   value="${userName}" placeholder="Seu nome"
                   class="input-ninja flex-1 py-2.5 rounded-lg text-sm font-bold px-3" />
            <button data-action="save-user-name"
                    class="ripple-target px-4 py-2.5 bg-theme-dim border border-theme-accent text-theme-primary
                           text-xs font-black rounded-lg active:scale-95 uppercase tracking-wider transition-all">
              Salvar
            </button>
          </div>
        </div>

        <!-- Vocabulário do app -->
        <div class="pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-zinc-300 font-bold">Vocabulário do App</p>
            <p class="text-[10px] text-zinc-600 mt-0.5">
              ${appMode === 'ninja' ? 'Ninja · chakra, missões, ofensiva' : 'Normal · treinos, volume, sequência'}
            </p>
          </div>
          <button data-action="set-app-mode"
                  class="ripple-target flex items-center gap-2 px-3 py-2 rounded-lg border transition-all active:scale-95 shrink-0
                         ${appMode === 'ninja' ? 'bg-theme-dim border-theme-accent text-theme-primary' : 'bg-zinc-800/60 border-zinc-700 text-zinc-300'}">
            <i data-lucide="${appMode === 'ninja' ? 'zap' : 'dumbbell'}" class="w-3.5 h-3.5"></i>
            <span class="text-[10px] font-black uppercase tracking-wider">${appMode === 'ninja' ? 'Ninja' : 'Normal'}</span>
          </button>
        </div>

        <!-- Nome do Projeto (menor destaque) -->
        <div class="pt-3 border-t border-zinc-800/60">
          <label class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider block mb-1.5">Nome do Projeto</label>
          <div class="flex gap-2">
            <input id="settings-project-input" type="text" maxlength="28"
                   value="${projectName}" placeholder="Ex: Guerreiro Absoluto"
                   class="input-ninja flex-1 py-2 rounded-lg text-xs font-bold px-3 uppercase text-zinc-400" />
            <button data-action="save-project-name"
                    class="ripple-target px-3 py-2 bg-zinc-900/60 border border-zinc-700 text-zinc-400
                           text-xs font-black rounded-lg active:scale-95 transition-all">
              OK
            </button>
          </div>
        </div>

        <!-- Objetivo -->
        <div class="pt-3 border-t border-zinc-800/60">
          <label class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider block mb-1.5">Objetivo Principal</label>
          <div class="grid grid-cols-1 gap-1.5">
            ${[
              { id: 'hipertrofia',     icon: 'dumbbell',    label: 'Hipertrofia',     sub: 'Ganho de massa muscular'        },
              { id: 'emagrecimento',   icon: 'flame',        label: 'Emagrecimento',   sub: 'Redução de gordura'             },
              { id: 'recomposicao',    icon: 'repeat',       label: 'Recomposição',    sub: 'Perder gordura e ganhar músculo'},
              { id: 'forca',           icon: 'trending-up',  label: 'Força',           sub: 'Aumentar cargas e PRs'          },
              { id: 'condicionamento', icon: 'wind',         label: 'Condicionamento', sub: 'Resistência e cardio'           },
            ].map(g => {
              const active = goal === g.id;
              return `
              <button data-action="save-goal" data-payload="${g.id}"
                      class="ripple-target flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all active:scale-[0.98]
                             ${active ? 'bg-theme-dim border-theme-accent text-theme-primary' : 'bg-zinc-900/40 border-zinc-800 text-zinc-400'}">
                <i data-lucide="${g.icon}" class="w-4 h-4 shrink-0"></i>
                <div class="flex-1 text-left min-w-0">
                  <div class="text-xs font-black uppercase tracking-wide">${g.label}</div>
                  <div class="text-[9px] ${active ? 'text-theme-primary/70' : 'text-zinc-600'}">${g.sub}</div>
                </div>
                ${active ? '<i data-lucide="check" class="w-3.5 h-3.5 shrink-0"></i>' : ''}
              </button>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- DADOS ───────────────────────────────────────────────────────── -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/70 space-y-3">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="database" class="w-3.5 h-3.5"></i>
          Dados
        </h3>
        <div class="grid grid-cols-2 gap-2">
          <button data-action="export-json" class="ripple-target btn-akatsuki active:scale-95 text-xs">
            <i data-lucide="download" class="w-4 h-4"></i> Fazer Backup
          </button>
          <button data-action="export-csv" class="ripple-target btn-akatsuki active:scale-95 text-xs">
            <i data-lucide="file-text" class="w-4 h-4"></i> Export CSV
          </button>
          <button data-action="import-json" class="ripple-target btn-akatsuki active:scale-95 text-xs">
            <i data-lucide="upload" class="w-4 h-4"></i> Restaurar Backup
          </button>
          <button data-action="import-pdf" class="ripple-target btn-akatsuki active:scale-95 text-xs">
            <i data-lucide="file-text" class="w-4 h-4"></i> Importar PDF
          </button>
        </div>
        <div class="pt-3 border-t-2 border-red-900/20 mt-1">
          <button data-action="reset-data"
                  class="ripple-target btn-akatsuki w-full active:scale-95 border-red-900/40 text-red-500 hover:bg-red-900/20 text-xs">
            <i data-lucide="trash-2" class="w-4 h-4"></i> Resetar Todos os Dados
          </button>
        </div>
      </div>

      <!-- INSTALAR NO CELULAR ─────────────────────────────────────────── -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/70">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-3">
          <i data-lucide="download" class="w-3.5 h-3.5"></i>
          Instalar no Celular
        </h3>
        <p class="text-[11px] text-zinc-500 mb-3 leading-relaxed">
          Salve o app na tela inicial para abrir como app nativo — funciona offline, sem barra do browser.
        </p>
        <div class="flex gap-2">
          <a href="instalar.html" target="_blank"
             class="ripple-target flex-1 py-3 rounded-xl border border-zinc-700/60 bg-zinc-900/40
                    text-[11px] font-black text-zinc-300 uppercase tracking-wider
                    flex items-center justify-center gap-2 active:scale-95 transition-all
                    hover:border-theme-accent/60 hover:text-theme-primary">
            <i data-lucide="smartphone" class="w-3.5 h-3.5"></i>
            Guia de instalação
          </a>
          <button data-action="share-install-link"
                  class="ripple-target px-4 py-3 rounded-xl border border-zinc-800/60 bg-zinc-900/30
                         text-zinc-500 active:scale-95 transition-all hover:border-zinc-700
                         flex items-center gap-1.5 text-[11px] font-black">
            <i data-lucide="share" class="w-3.5 h-3.5"></i>
            Compartilhar
          </button>
        </div>
      </div>

      <!-- SOBRE ───────────────────────────────────────────────────────── -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/70">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-3">
          <i data-lucide="info" class="w-3.5 h-3.5"></i>
          Sobre
        </h3>
        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">Aplicativo</span>
            <span class="text-[9px] text-zinc-400 font-mono">Treino Monstro</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">Versão</span>
            <span class="text-[9px] text-zinc-400 font-mono">v${APP_VERSION}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">Projeto</span>
            <span class="text-[9px] text-zinc-400 font-mono truncate ml-4">${projectName}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">Desenvolvedor</span>
            <span class="text-[9px] text-zinc-400 font-mono">${userName || 'Cláudio Santana'}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">Armazenamento</span>
            <span class="text-[9px] text-zinc-400 font-mono">${storageSize} · offline</span>
          </div>
        </div>
      </div>

    </div>
  `;
}

/* ─── Mount ────────────────────────────────────────────────────────── */

export function mountSettings(container, handler) {
  delegate(container, '[data-action="save-user-name"]', 'click', (e, el) => {
    createRipple(e, el);
    const name = container.querySelector('#settings-name-input')?.value?.trim();
    if (name) handler('save-user-name', name);
  });

  delegate(container, '[data-action="save-project-name"]', 'click', (e, el) => {
    createRipple(e, el);
    const name = container.querySelector('#settings-project-input')?.value?.trim().toUpperCase();
    if (name) handler('save-project-name', name);
  });

  delegate(container, '[data-action="save-goal"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('save-goal', el.dataset.payload);
  });

  delegate(container, '[data-action="share-install-link"]', 'click', async (e, el) => {
    createRipple(e, el);
    const url = 'https://survey-sedation-stellar.ngrok-free.dev/treino-monstro/instalar.html';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Treino Monstro', text: 'Instala o app aqui 💪', url });
      } else {
        await navigator.clipboard.writeText(url);
        const orig = el.innerHTML;
        el.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> Copiado!';
        if (window.lucide) lucide.createIcons({ nodes: [el] });
        setTimeout(() => { el.innerHTML = orig; if (window.lucide) lucide.createIcons({ nodes: [el] }); }, 2000);
      }
    } catch {}
  });

  delegate(container, '[data-action="set-theme"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('set-theme', el.dataset.theme);
  });

  delegate(container, '[data-action="set-app-mode"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('set-app-mode');
  });

  delegate(container, '[data-action="toggle-light-mode"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('toggle-light-mode');
  });

  delegate(container, '[data-action="set-week-goal"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('set-week-goal', el.dataset.delta);
  });

  delegate(container, '[data-action="set-week-reset-days"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('set-week-reset-days', el.dataset.days);
  });

  delegate(container, '[data-action="set-default-rest"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('set-default-rest', el.dataset.seconds);
  });

  delegate(container, '[data-action="set-weight-increment"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('set-weight-increment', el.dataset.increment);
  });

  delegate(container, '[data-action="toggle-vibration"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('toggle-vibration');
  });

  delegate(container, '[data-action="toggle-timer-sound"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('toggle-timer-sound');
  });

  delegate(container, '[data-action="toggle-auto-fill-on-start"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('toggle-auto-fill-on-start');
  });

  delegate(container, '[data-action="set-day-plan"]', 'change', (e, el) => {
    handler('set-day-plan', { day: parseInt(el.dataset.day), workoutId: el.value || null });
  });

  delegate(container, '[data-action="set-cardio-counts-streak"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('set-cardio-counts-streak');
  });

  delegate(container, '[data-action="set-default-cardio-protocol"]', 'change', (e, el) => {
    handler('set-default-cardio-protocol', el.value);
  });

  delegate(container, '[data-action="toggle-active-commute"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('toggle-active-commute');
  });

  delegate(container, '[data-action="set-commute-mode"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('set-commute-mode', el.dataset.mode);
  });

  delegate(container, '[data-action="set-commute-speed"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('set-commute-speed', el.dataset.speed);
  });

  delegate(container, '[data-action="commute-km-live"]', 'change', (e, el) => {
    handler('set-commute-km', el.value);
  });

  // Cardio goals: auto-save on blur (sem botão OK)
  delegate(container, '[data-action="cardio-km-live"]', 'change', (e, el) => {
    handler('set-weekly-cardio-km', el.value);
  });

  delegate(container, '[data-action="cardio-min-live"]', 'change', (e, el) => {
    handler('set-weekly-cardio-min', el.value);
  });

  delegate(container, '[data-action="toggle-notifications"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('toggle-notifications');
  });

  delegate(container, '[data-action="save-notification-time"]', 'click', (e, el) => {
    createRipple(e, el);
    const val = container.querySelector('#notif-time-input')?.value;
    if (val) handler('save-notification-time', val);
  });

  delegate(container, '[data-action="export-json"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('export-json');
  });

  delegate(container, '[data-action="export-csv"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('export-csv');
  });

  delegate(container, '[data-action="import-json"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('import-json');
  });

  delegate(container, '[data-action="import-pdf"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('import-pdf');
  });

  delegate(container, '[data-action="reset-data"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('reset-data');
  });

  delegate(container, '[data-action="set-cycle-position"]', 'change', (e, el) => {
    handler('set-cycle-position', JSON.stringify({ idx: parseInt(el.dataset.idx), wId: el.value || null }));
  });
}
