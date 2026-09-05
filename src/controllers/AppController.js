import { WorkoutController } from "./WorkoutController.js";
import { CardioController } from "./CardioController.js";
import { PERSISTED_KEYS } from "../store/persistedKeys.js";
import { ACHIEVEMENT_MAP } from "../data/achievements.js";
import { EXERCISE_LIBRARY } from "../data/exerciseLibrary.js";
import { renderHome, mountHome } from "../views/HomeView.js";
import { renderDashboard, mountDashboard } from "../views/DashboardView.js";
import { renderCardio, mountCardio, patchCardioTimer } from "../views/CardioView.js";
import {
  renderWorkout,
  mountWorkout,
  patchSetRow,
  patchExerciseCardState,
  patchSetsContainer,
  patchProgressionBadge,
  patchExerciseNote,
  patchExerciseSkip,
  patchTimedSetCountdown,
  countSets,
} from "../views/WorkoutView.js";
import { renderAnalytics, mountAnalytics, patchAnalyticsTab, renderSparkline } from "../views/AnalyticsView.js";
import { renderProfile, mountProfile } from "../views/ProfileView.js";
import {
  renderWorkoutEditor,
  mountWorkoutEditor,
  renderExercisesListHTML,
} from "../views/WorkoutEditorView.js";
import { renderSettings, mountSettings } from "../views/SettingsView.js";
import { renderOnboarding, mountOnboarding } from "../views/OnboardingView.js";
import { renderBattleReport } from "../views/BattleReportView.js";
import { SPLIT_TEMPLATES, generateWorkoutsFromTemplate } from "../data/workoutTemplates.js";
import { parsePDFWorkout } from "../services/PDFImportService.js";
import { getExerciseMedia } from "../data/exerciseMedia.js";
import { $, setHTML, show, hide, createRipple } from "../utils/dom.js";
import { getLabels } from "../utils/labels.js";
import {
  formatTime,
  formatVolume,
  formatDuration,
  formatDate,
} from "../utils/format.js";
import { renderSharingan } from "../components/Sharingan.js";
import { getWorkoutPhrase } from "../data/quotes.js";

const MAJOR_ACHIEVEMENTS = new Set([
  'session_50', 'session_100', 'session_200',
  'vol_100t', 'vol_500t',
  'cycle_5', 'streak_30', 'streak_100',
  'week_perfect',
]);

export class AppController {
  #store;
  #workouts;
  #cardioProtocols;
  #timer;
  #theme;
  #storage;
  #exportService;
  #workoutCtrl;
  #cardioCtrl;

  // elementos DOM fixos
  #header;
  #main;
  #nav;
  #timerBadge;
  #timerText;
  #timerRing;
  #modalLayer;
  #reportLayer;
  #elapsedInterval    = null;
  #cardioInterval     = null;
  #cardioGpsWatchId   = null;
  #cardioLastGpsPos   = null;
  #cardioWakeLock     = null;
  #audioCtx           = null;
  #usedWorkoutPhrases = new Set();
  #lastRestDuration   = 60;
  #setTimerInterval   = null;
  #activeSetTimer     = null;
  #timerCardKey       = null;
  #lastTimerCardKey   = null;
  #obLayer            = null;
  #obStep             = 0;
  #obData             = {};

  constructor({ store, workouts, cardioProtocols = [], timer, theme, storage, exportService }) {
    this.#store = store;
    this.#workouts = workouts;
    this.#cardioProtocols = cardioProtocols;
    this.#timer = timer;
    this.#theme = theme;
    this.#storage = storage;
    this.#exportService = exportService;

    this.#workoutCtrl = new WorkoutController({
      store,
      workouts: () => this.#allWorkouts(),
      timer,
    });

    this.#cardioCtrl = new CardioController({ store, protocols: cardioProtocols });

    this.#header = $("#header-content");
    this.#main = $("#main-content");
    this.#nav = $("#mobile-nav");
    this.#timerBadge = $("#timer-badge");
    this.#timerText = $("#timer-text");
    this.#timerRing = $("#timer-ring-circle");
    this.#modalLayer = $("#modal-layer");
    this.#reportLayer = $("#report-layer");

    this.#bindTimer();
    this.#bindStore();
  }

  init() {
    // Delegação de eventos do header (setup único — sem acumulação de listeners)
    this.#header.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "back") this.#navigate("treinar");
      if (action === "finish-workout") this.#openNotesModal();
      if (action === "toggle-theme") this.#handleAction("toggle-theme");
      if (action === "back-from-editor") this.#handleAction("back-from-editor");
      if (action === "save-workout") this.#handleAction("save-workout");
      if (action === "back-from-settings")
        this.#handleAction("back-from-settings");
      if (action === "goto-settings") this.#handleAction("goto-settings");
      if (action === "open-hub") this.#handleAction("open-hub");
    });

    // Delegação de eventos para o Nav Dock inferior
    this.#nav.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-navigate]");
      if (btn) {
        createRipple(e, btn);
        this.#navigate(btn.dataset.navigate);
      }
    });

    const state = this.#store.getState();

    // Sprint 5.0: Onboarding — mostra para novos usuários sem histórico nem biometria
    const hasExistingData = (state.history?.length ?? 0) > 0 || state.biometrics !== null;
    if (!state.onboardingCompleted && !hasExistingData) {
      this.#theme.apply(state.theme);
      this.#showOnboarding();
      return;
    }

    this.#theme.apply(state.theme);
    this.#theme.applyLightMode(state.lightMode ?? false);
    this.#render(state);

    // Auto-reset por inatividade: mede dias desde a ÚLTIMA ATIVIDADE (não desde o início do ciclo)
    const resetDays = state.inactivityResetDays ?? 0;
    if (resetDays > 0 && (state.cycleDone ?? []).length > 0) {
      const allTimestamps = [
        ...(state.history      ?? []).map(h => new Date(h.date).getTime()),
        ...(state.cardioHistory ?? []).map(c => new Date(c.date).getTime()),
      ].filter(t => !isNaN(t));
      const lastActivity = allTimestamps.length > 0 ? Math.max(...allTimestamps) : (state.cycleStart ?? null);
      if (lastActivity) {
        const daysSinceActivity = (Date.now() - lastActivity) / 86400000;
        if (daysSinceActivity >= resetDays) {
          this.#store.setState({ cycleDone: [], cycleStart: null, cyclePosition: 0 });
        }
      }
    }

    // Sessão fantasma: workoutStartTime > 8h → perguntar se quer continuar ou descartar
    if (
      state.workoutStartTime &&
      Date.now() - state.workoutStartTime > 8 * 3600000
    ) {
      const hours = Math.round((Date.now() - state.workoutStartTime) / 3600000);
      setTimeout(() => this.#showStaleSessionModal(hours), 200);
    } else if (state.workoutId && state.workoutStartTime) {
      // Sessão recente (<8h): restaurar tab workout automaticamente
      this.#store.setState({ tab: 'workout' });
    }

    // Retomar sessão de cardio ativa persistida (ou descartar se fantasma >8h)
    if (state.activeCardioSession) {
      const age = (Date.now() - (state.activeCardioSession.startTime || 0)) / 3600000;
      if (age > 8) {
        this.#cardioCtrl.abandon();
      } else if (state.tab !== 'cardio') {
        this.#store.setState({ tab: 'cardio' });
      }
    }

    // Auto-avançar dia Off quando o usuário abre o app num dia novo
    {
      const s = this.#store.getState();
      const todayKey = new Date().toISOString().slice(0, 10);
      const nextId = (s.cycleOrder ?? [])[(s.cyclePosition ?? 0)];
      const isOffSlot = nextId === null || nextId === undefined;
      if (isOffSlot && s.lastOffDayDate !== todayKey && !s.workoutStartTime) {
        const len = Math.max(1, (s.cycleOrder ?? []).length);
        const pos = ((s.cyclePosition ?? 0) + 1) % len;
        const completed = pos === 0 ? (s.completedCycles ?? 0) + 1 : (s.completedCycles ?? 0);
        this.#store.setState({
          cyclePosition:   pos,
          completedCycles: completed,
          lastOffDayDate:  todayKey,
          ...(pos === 0 ? { cycleDone: [], cycleStart: null } : {}),
        });
      }
    }

    // Verificar lembrete de treino ao abrir o app
    setTimeout(() => this.#checkReminderNotification(), 1500);

    // Retrospectiva semanal: exibir toda segunda-feira, uma vez por dia
    const _now = new Date();
    if (_now.getDay() === 1) {
      const _todayKey = _now.toISOString().slice(0, 10);
      if (state.retroLastShown !== _todayKey && !state.workoutStartTime) {
        const _lastMon = new Date(_now);
        _lastMon.setDate(_now.getDate() - 7);
        _lastMon.setHours(0, 0, 0, 0);
        const _lastSun = new Date(_now);
        _lastSun.setDate(_now.getDate() - 1);
        _lastSun.setHours(23, 59, 59, 999);
        const _hasData = (state.history ?? []).some(h => {
          const d = new Date(h.date); return d >= _lastMon && d <= _lastSun;
        }) || (state.cardioHistory ?? []).some(c => {
          const d = new Date(c.date); return d >= _lastMon && d <= _lastSun;
        });
        if (_hasData) setTimeout(() => this.#showWeeklyRetroModal(), 2000);
      }
    }
  }

  /* ─── Store subscription ──────────────────────────────────────── */

  #bindStore() {
    this.#store.subscribe((state, prev) => {
      const changedKeys = PERSISTED_KEYS.filter(k => state[k] !== prev[k]);
      if (changedKeys.length) this.#storage.saveState(state, changedKeys);

      const tabChanged = state.tab !== prev.tab;
      const workoutChanged = state.workoutId !== prev.workoutId;
      const modalChanged = state.activeModal !== prev.activeModal;
      const themeChanged = state.theme !== prev.theme;
      const logsChanged = state.logs !== prev.logs;
      const prsChanged = state.prs !== prev.prs;
      const weightsChanged = state.bodyWeights !== prev.bodyWeights;
      const goalChanged = state.cycleGoal !== prev.cycleGoal;
      const objectiveChanged = state.goal !== prev.goal;
      const bioChanged = state.biometrics !== prev.biometrics;
      const editorChanged = state.editorWorkout !== prev.editorWorkout;
      const customChanged =
        state.customWorkouts !== prev.customWorkouts ||
        state.workoutExercises !== prev.workoutExercises ||
        state.workoutMeta !== prev.workoutMeta;
      const modeChanged = state.appMode !== prev.appMode;
      const userNameChanged = state.userName !== prev.userName;
      const projectNameChanged = state.projectName !== prev.projectName;
      const lightModeChanged = state.lightMode !== prev.lightMode;
      const activityLevelChanged = state.activityLevel !== prev.activityLevel;
      const hiddenSectionsChanged =
        state.hiddenSections !== prev.hiddenSections;
      const weekPlanChanged           = state.weekPlan !== prev.weekPlan;
      const cardioSessionChanged      = state.activeCardioSession !== prev.activeCardioSession;
      const cardioHistoryChanged      = state.cardioHistory !== prev.cardioHistory;
      const analyticsTabChanged       = state.analyticsTab !== prev.analyticsTab;
      const achievementsChanged       = state.achievements !== prev.achievements;

      if (themeChanged) {
        this.#theme.apply(state.theme);
        this.#renderHeader(state);
        if (state.tab === "settings") {
          this.#renderMain(state);
        }
        this.#syncIcons();
      }

      if (tabChanged || workoutChanged) {
        this.#render(state);
        return;
      }

      // Patch cirúrgico: só percorre exercícios se os logs mudaram
      if (state.tab === "workout" && logsChanged) {
        this.#patchWorkout(state, prev);
      }

      // Patch cirúrgico: notas de exercício
      if (state.tab === 'workout' && state.exerciseNotes !== prev.exerciseNotes && state.workoutId) {
        const wId  = state.workoutId;
        const cur  = state.exerciseNotes?.[wId]  ?? {};
        const prev2 = prev.exerciseNotes?.[wId]  ?? {};
        Object.keys({ ...cur, ...prev2 }).forEach(exId => {
          if (cur[exId] !== prev2[exId]) {
            patchExerciseNote(exId, cur[exId] ?? '');
            const btn = document.querySelector(`[data-action="open-ex-note"][data-exid="${exId}"]`);
            if (btn) {
              const hasNote = !!(cur[exId]);
              btn.className = btn.className
                .replace(/bg-amber-900\/30\s*border\s*border-amber-800\/50\s*text-amber-400|bg-zinc-800\/40\s*border\s*border-zinc-700\/40\s*text-zinc-600/g, '').trim()
                + (hasNote ? ' bg-amber-900/30 border border-amber-800/50 text-amber-400' : ' bg-zinc-800/40 border border-zinc-700/40 text-zinc-600');
            }
            if (window.lucide) lucide.createIcons({ nodes: [document.getElementById(`ex-note-${exId}`)].filter(Boolean) });
          }
        });
      }

      // Patch: linha de missão — regenera ao trocar modo de volta
      if (state.tab === "workout" && state.commuteReturnOverride !== prev.commuteReturnOverride) {
        const lineEl = document.getElementById("workout-commute-line");
        if (lineEl) {
          const ac         = state.activeCommute;
          const weightKg   = state.biometrics?.weight ?? 80;
          const returnMode = state.commuteReturnOverride?.mode ?? ac?.mode ?? 'walk';
          const labels     = { walk: 'pé', run: 'correr', bike: 'bike' };
          const MET_MAP    = { walk: 3.5, run: 7.0, bike: 6.0 };
          const SPEED_MAP  = { walk: 4.8, run: 8.0, bike: 15.0 };
          const goIcon     = ac.mode === 'bike' ? 'activity' : ac.mode === 'run' ? 'zap' : 'move';
          const goMET      = MET_MAP[ac.mode] ?? 3.5;
          const goDuration = Math.round((ac.oneWayDistanceKm / ac.estimatedSpeed) * 60);
          const goCal      = Math.round(goMET * weightKg * (goDuration / 60));
          const retSpeed   = returnMode === ac.mode ? ac.estimatedSpeed : (SPEED_MAP[returnMode] ?? 4.8);
          const retMET     = MET_MAP[returnMode] ?? 3.5;
          const retDuration = Math.round((ac.oneWayDistanceKm / retSpeed) * 60);
          const retCal      = Math.round(retMET * weightKg * (retDuration / 60));
          const totalMin   = goDuration + retDuration;
          const totalCal   = goCal + retCal;
          const chips = ['walk', 'run', 'bike'].map(m => `
            <button data-action="set-commute-return" data-payload="${m}"
                    class="text-[9px] px-2 py-1 rounded-lg border font-bold transition-all active:scale-90
                           ${returnMode === m
                             ? 'bg-cyan-900/40 border-cyan-700/60 text-cyan-300'
                             : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-400'}">
              ${labels[m]}
            </button>`).join('');
          lineEl.innerHTML = `
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
            </div>`;
          if (window.lucide) lucide.createIcons({ nodes: [lineEl] });
        }
      }

      // Modal: renderiza uma única vez aqui
      if (modalChanged) {
        this.#renderModal(state);
      }

      // Toast de PR: dispara quando um recorde é superado
      if (prsChanged) {
        this.#detectAndShowPRToast(state.prs, prev.prs);
      }

      // Toast/celebração de achievement: dispara para conquistas ganhas fora do battle report
      if (achievementsChanged && !modalChanged) {
        const prevIds = prev.achievements ?? [];
        const newIds  = (state.achievements ?? []).filter(id => !prevIds.includes(id));
        if (newIds.length) {
          const majorId = newIds.find(id => MAJOR_ACHIEVEMENTS.has(id));
          if (majorId) setTimeout(() => this.#showCelebrationOverlay(majorId), 600);
          else setTimeout(() => this.#showAchievementToast(newIds), 600);
        }
      }

      // Deload: sugere semana de recuperação a cada 4 ciclos completos
      if (state.completedCycles !== prev.completedCycles &&
          state.completedCycles > 0 &&
          state.completedCycles % 4 === 0) {
        setTimeout(() => this.#showDeloadModal(state.completedCycles), 1200);
      }

      // Re-render pontual quando dados do perfil mudam
      if ((weightsChanged || bioChanged) && state.tab === "corpo") {
        this.#renderMain(state);
        this.#syncIcons();
      }

      // Meta semanal mudou → re-render home, treinos ou settings
      if (
        goalChanged &&
        (state.tab === "home" ||
          state.tab === "treinar" ||
          state.tab === "corpo" ||
          state.tab === "settings")
      ) {
        this.#renderMain(state);
        this.#syncIcons();
      }

      // Custom workouts adicionados/removidos → re-render dashboard
      if (customChanged && state.tab === "treinar") {
        this.#renderMain(state);
        this.#syncIcons();
      }

      // Editor: patch cirúrgico — só atualiza lista de exercícios
      if (editorChanged && state.tab === "workout-editor") {
        this.#patchEditorExercises(state.editorWorkout);
      }

      // Modo claro/escuro mudou → aplica imediatamente e re-render completo
      if (lightModeChanged) {
        this.#theme.applyLightMode(state.lightMode ?? false);
        this.#renderHeader(state);
        this.#renderMain(state);
        this.#updateNav(state);
        this.#syncIcons();
      }

      // Objetivo (goal) mudou → re-render home/corpo
      if (objectiveChanged && (state.tab === 'home' || state.tab === 'corpo')) {
        this.#renderMain(state);
        this.#syncIcons();
      }

      // Modo, nome ou projeto mudou → re-render header + main da tab atual
      if (modeChanged || userNameChanged || projectNameChanged) {
        this.#renderHeader(state);
        this.#renderMain(state);
        this.#syncIcons();
      }

      // Nível de atividade, seções ocultas ou metas pessoais mudaram → re-render perfil
      const personalGoalsChanged = state.personalGoals !== prev.personalGoals;
      if (activityLevelChanged || hiddenSectionsChanged || personalGoalsChanged) {
        if (state.tab === "corpo" || state.tab === "settings" || state.tab === "evoluir") {
          this.#renderMain(state);
          this.#syncIcons();
        }
      }

      // Plano semanal mudou → re-render home, dashboard e settings
      if (
        weekPlanChanged &&
        (state.tab === "home" ||
          state.tab === "treinar" ||
          state.tab === "settings")
      ) {
        this.#renderMain(state);
        this.#syncIcons();
      }

      // Qualquer setting mudou enquanto a aba settings está aberta → re-render
      if (state.tab === "settings") {
        const settingsKeys = [
          'vibrationEnabled', 'timerSoundEnabled', 'weightIncrement', 'autoFillOnStart',
          'defaultRestTime', 'inactivityResetDays', 'cardioCountsStreak',
          'weeklyCardioKmGoal', 'weeklyCardioMinGoal', 'defaultCardioProtocol',
          'notificationsEnabled', 'notificationTime', 'activeCommute', 'goal',
        ];
        if (settingsKeys.some(k => state[k] !== prev[k])) {
          this.#renderMain(state);
          this.#syncIcons();
        }
      }

      // Sessão de cardio: patch cirúrgico durante execução; re-render quando inicia/termina
      if (cardioSessionChanged) {
        const wasActive = !!prev.activeCardioSession;
        const isActive  = !!state.activeCardioSession;

        if (!wasActive && isActive) {
          if (state.tab === 'cardio') {
            // Já está na tab cardio — re-render direto (tabChanged seria false)
            this.#renderMain(state);
            this.#renderHeader(state);
            this.#syncIcons();
            this.#startCardioInterval();
            this.#startCardioGPS();
          } else {
            this.#store.setState({ tab: 'cardio' });
          }
          return;
        }

        if (wasActive && !isActive) {
          this.#stopCardioInterval();
          this.#stopCardioGPS();
          if (state.tab === 'cardio') {
            this.#renderMain(state);
            this.#renderHeader(state);
            this.#syncIcons();
          }
          return;
        }

        // Sessão completou (bloco final atingido)
        if (state.activeCardioSession?.completed && !prev.activeCardioSession?.completed) {
          patchCardioTimer(state, this.#cardioProtocols);
          this.#stopCardioInterval();
          this.#stopCardioGPS();
          // Abre modal de finalização automaticamente após 1.2s
          setTimeout(() => {
            if (this.#store.getState().activeCardioSession?.completed) {
              this.#showCardioFinishModal();
            }
          }, 1200);
          return;
        }

        // Tick normal → patch cirúrgico
        if (state.tab === 'cardio') {
          patchCardioTimer(state, this.#cardioProtocols);
          return;
        }
      }

      // Cardio history mudou (sessão salva) → re-render home/evoluir/treinar/cardio
      if (cardioHistoryChanged &&
        (state.tab === 'home' || state.tab === 'evoluir' || state.tab === 'treinar' || state.tab === 'cardio')) {
        this.#renderMain(state);
        this.#syncIcons();
      }

      // Auto-avanço: cardio salvo enquanto Dia Flex é a próxima posição do ciclo
      if (cardioHistoryChanged && state.cardioHistory.length > (prev.cardioHistory?.length ?? 0)) {
        const nextId = (state.cycleOrder ?? [])[(state.cyclePosition ?? 0)];
        if (nextId === 'flex' && !(state.cycleDone ?? []).includes('flex')) {
          setTimeout(() => {
            this.#advanceFlexDay();
            this.#showQuickToast('Cardio registrado · Dia Flex concluído ✓', 'rgba(34,211,238,0.4)');
          }, 400);
        }
      }

      // Aba interna do Evoluir mudou → patch cirúrgico (evita re-render do heatmap/sparklines)
      if (analyticsTabChanged && state.tab === 'evoluir') {
        patchAnalyticsTab(this.#main, state, this.#allWorkouts());
        this.#syncIcons();
      }
    });
  }

  #render(state) {
    this.#updateNav(state);
    this.#renderHeader(state);
    this.#renderMain(state);
    this.#syncIcons();

    if (state.tab === "workout" && state.workoutStartTime) {
      this.#startElapsedTicker(state.workoutStartTime);
    } else {
      this.#stopElapsedTicker();
    }

    if (state.tab === 'cardio' && state.activeCardioSession) {
      this.#startCardioInterval();
      this.#startCardioGPS();
    } else {
      this.#stopCardioInterval();
      this.#stopCardioGPS();
    }
  }

  /* ─── Timer ───────────────────────────────────────────────────── */

  #bindTimer() {
    this.#timer.on("tick", (remaining) => {
      if (!this.#timerText || !this.#timerBadge) return;
      show(this.#timerBadge);
      const rb = document.getElementById('timer-restart-btn');
      if (rb && !rb.classList.contains('hidden')) rb.classList.add('hidden');
      this.#timerText.textContent = formatTime(remaining);
      if (this.#timerRing) {
        const pct = this.#timer.progress;
        const dash = (1 - pct) * 100;
        this.#timerRing.style.strokeDashoffset = dash.toFixed(1);
      }
      // Inline timer: atualiza card colapsado com contagem regressiva
      if (this.#timerCardKey) {
        const card = document.querySelector(`[data-exercise-card="${this.#timerCardKey}"]`);
        const summary = card?.querySelector('[data-done-summary]');
        if (summary) {
          summary.innerHTML = `<span class="font-mono font-bold text-theme-primary/80">⏱ ${formatTime(remaining)}</span><span class="text-zinc-700 ml-2 text-[8px]">· toque p/ expandir</span>`;
        }
      }
    });

    this.#timer.on("complete", () => {
      const st = this.#store.getState();
      if (st.vibrationEnabled !== false && navigator.vibrate) navigator.vibrate([200, 100, 200]);
      if (st.timerSoundEnabled !== false) this.#playTimerBeep();
      setTimeout(() => {
        hide(this.#timerBadge);
        // Exibe botão de reiniciar descanso por 30s
        const rb = document.getElementById('timer-restart-btn');
        const rl = document.getElementById('timer-restart-label');
        if (rb && rl) {
          rl.textContent = this.#lastRestDuration >= 60
            ? `${Math.round(this.#lastRestDuration / 60)}min`
            : `${this.#lastRestDuration}s`;
          show(rb);
          setTimeout(() => { if (rb) hide(rb); }, 30000);
        }
      }, 800);
      // Inline timer: exibe "PRONTO" no card e limpa após 3s
      if (this.#timerCardKey) {
        const card = document.querySelector(`[data-exercise-card="${this.#timerCardKey}"]`);
        const summary = card?.querySelector('[data-done-summary]');
        if (summary) {
          summary.innerHTML = `<span class="text-green-500/80 font-bold">✓ PRONTO</span><span class="text-zinc-700 ml-2 text-[8px]">· toque p/ expandir</span>`;
          setTimeout(() => {
            const s2 = card?.querySelector('[data-done-summary]');
            if (s2) s2.textContent = '↕ toque para expandir';
          }, 3000);
        }
        this.#lastTimerCardKey = this.#timerCardKey;
        this.#timerCardKey = null;
      }
      setTimeout(() => this.#showWorkoutPhrase(), 600);
    });
  }

  /* ─── Audio ─────────────────────────────────────────────────── */

  #playTimerBeep() {
    try {
      if (!this.#audioCtx) this.#audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.#audioCtx;
      // 3 beeps ascendentes: 660Hz → 880Hz → 1100Hz
      [[0, 660], [0.18, 880], [0.36, 1100]].forEach(([offset, freq]) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.14);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.15);
      });
    } catch (_) { /* AudioContext não disponível */ }
  }

  #showQuickToast(msg, borderColor = 'rgba(34,197,94,0.5)') {
    const el = document.createElement('div');
    el.className = 'workout-phrase-toast';
    el.style.borderColor = borderColor;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  #showWorkoutPhrase() {
    const phrase = getWorkoutPhrase(this.#usedWorkoutPhrases);
    this.#usedWorkoutPhrases.add(phrase);
    const el = document.createElement('div');
    el.className = 'workout-phrase-toast';
    el.textContent = phrase;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  /* ─── Onboarding ─────────────────────────────────────────────── */

  #showOnboarding() {
    const s = this.#store.getState();
    this.#obStep = 0;
    this.#obData = {
      name:          s.userName        ?? '',
      projectName:   s.projectName     ?? '',
      mode:          s.appMode         ?? 'ninja',
      experience:    s.experience      ?? null,
      goal:          s.goal            ?? null,
      trainingStyle: s.trainingStyle   ?? null,
      cycleGoal:     s.cycleGoal       ?? 4,
      activityLevel: s.activityLevel   ?? 1.55,
      commute:       { ...(s.activeCommute ?? {}) },
      academyName:   s.academyName     ?? '',
      weight:        null,
      height:        null,
      age:           null,
      sex:           null,
      hasEval:       false,
      bodyFat:       null,
      leanMass:      null,
      muscleMass:    null,
    };
    if (!this.#obLayer) {
      this.#obLayer = document.createElement('div');
      this.#obLayer.id = 'ob-layer';
      this.#obLayer.className = 'fixed inset-0 z-[100] bg-zinc-950 overflow-y-auto';
      document.body.appendChild(this.#obLayer);
    }
    this.#renderObStep();
  }

  #renderObStep() {
    const state = this.#store.getState();
    setHTML(this.#obLayer, renderOnboarding(this.#obStep, this.#obData, state.theme));
    mountOnboarding(this.#obLayer, (action, payload) => this.#handleAction(action, payload));
    if (window.lucide) window.lucide.createIcons({ nameAttr: 'data-lucide', node: this.#obLayer });
  }

  #completeOnboarding() {
    const d = this.#obData;
    const isActiveCommute = d.commute?.mode === 'walk' || d.commute?.mode === 'bike';
    const patch = {
      onboardingCompleted: true,
      userName:      (d.name || 'NINJA').toUpperCase(),
      projectName:   (d.projectName || '').toUpperCase(),
      appMode:       d.mode         ?? 'ninja',
      experience:    d.experience   ?? null,
      goal:          d.goal         ?? null,
      academyName:   d.academyName  ?? '',
      trainingStyle: d.trainingStyle ?? null,
      cycleGoal:     d.cycleGoal ?? 4,
      activityLevel: d.activityLevel ?? 1.55,
      activeCommute: {
        enabled:          isActiveCommute && (d.commute?.oneWayDistanceKm ?? 0) > 0,
        oneWayDistanceKm: d.commute?.oneWayDistanceKm ?? 1.1,
        mode:             d.commute?.mode ?? 'walk',
        estimatedSpeed:   d.commute?.estimatedSpeed ?? 4.8,
      },
    };
    // Gera treinos a partir do split escolhido (se não for custom nem vazio)
    if (d.trainingStyle && d.trainingStyle !== 'custom') {
      const { workouts: generated } = generateWorkoutsFromTemplate(d.trainingStyle, d.goal);
      const tpl         = SPLIT_TEMPLATES[d.trainingStyle];
      const basePattern = tpl?.cyclePattern ?? generated.map((_, i) => i);
      const cg          = d.cycleGoal ?? tpl?.defaultCycleGoal ?? generated.length;
      const genOrder    = Array.from({ length: cg }, (_, i) => generated[basePattern[i % basePattern.length]].id);
      patch.customWorkouts = generated;
      patch.cycleOrder     = genOrder;
      patch.cyclePosition  = 0;
      patch.cycleDone      = [];
      patch.weekPlan       = {};
    }
    // Biometria inicial — usa dados reais da avaliação se fornecidos, senão estima via Deurenberg
    if (d.weight) {
      let bodyFat  = d.hasEval && d.bodyFat  ? d.bodyFat  : null;
      let leanMass = d.hasEval && d.leanMass ? d.leanMass : null;

      if (!bodyFat && d.height && d.age && d.sex) {
        const bmi     = d.weight / ((d.height / 100) ** 2);
        const sexFact = d.sex === 'M' ? 10.8 : 0;
        bodyFat  = Math.round(Math.max(3, 1.20 * bmi + 0.23 * d.age - sexFact - 5.4) * 10) / 10;
        leanMass = Math.round(d.weight * (1 - bodyFat / 100) * 10) / 10;
      }

      patch.biometrics = {
        date:          new Date().toISOString(),
        weight:        d.weight,
        height:        d.height  ?? null,
        bodyFat:       bodyFat,
        leanMass:      leanMass,
        muscleMass:    (d.hasEval && d.muscleMass) ? d.muscleMass : null,
        boneMass:      null,
        targetWeight:  null,
        targetBodyFat: null,
      };
      patch.bodyWeights = [{ date: new Date().toISOString().slice(0, 10), value: d.weight }];
    }
    this.#store.setState(patch);

    if (this.#obLayer) { this.#obLayer.remove(); this.#obLayer = null; }

    const state = this.#store.getState();
    this.#theme.apply(state.theme);
    this.#theme.applyLightMode(state.lightMode ?? false);
    this.#render(state);
  }

  /* ─── Elapsed ticker ─────────────────────────────────────────── */

  #startElapsedTicker(startTime) {
    this.#stopElapsedTicker();
    const update = () => {
      const el = document.getElementById("elapsed-workout");
      if (!el) { this.#stopElapsedTicker(); return; }
      el.textContent = formatDuration(Math.round((Date.now() - startTime) / 60000));
    };
    update(); // atualiza imediatamente (não aguarda 60s para exibir)
    this.#elapsedInterval = setInterval(update, 60000);
  }

  #stopElapsedTicker() {
    if (this.#elapsedInterval) {
      clearInterval(this.#elapsedInterval);
      this.#elapsedInterval = null;
    }
  }

  /* ─── Patches cirúrgicos no workout ──────────────────────────── */

  #patchWorkout(state, prev) {
    const wId = state.workoutId;
    const workout = this.#allWorkouts().find((w) => w.id === wId);
    if (!workout) return;

    const newLogs = state.logs[wId] ?? {};
    const prevLogs = prev.logs[wId] ?? {};

    const lastSession = state.history.find((h) => h.workoutId === wId);
    const lastSets = lastSession?.sets ?? {};

    workout.exercises.forEach((ex) => {
      // Early-exit: referência idêntica → exercício não mudou
      if (newLogs[ex.id] === prevLogs[ex.id]) return;

      const newEx = newLogs[ex.id] ?? {};
      const prevEx = prevLogs[ex.id] ?? {};

      // Patch de skip: atualiza visualmente o card sem re-render total
      if (!!newEx._skip !== !!prevEx._skip) {
        patchExerciseSkip(this.#main, wId, ex.id, !!newEx._skip);
      }
      const newCount = countSets(newEx, ex.sets);
      const prevCount = countSets(prevEx, ex.sets);

      if (newCount !== prevCount) {
        patchSetsContainer(wId, workout, ex.id, newLogs, lastSets, state.prs);
        patchProgressionBadge(wId, ex.id, newEx, lastSets[ex.id] ?? []);
        return;
      }

      // Verifica cada série individualmente
      for (let i = 0; i < newCount; i++) {
        const ns = JSON.stringify(newEx[i] ?? {});
        const ps = JSON.stringify(prevEx[i] ?? {});
        if (ns !== ps) {
          patchSetRow(wId, ex.id, i, newEx[i] ?? {}, ex, state.vibrationEnabled !== false, state.prs[ex.id] ?? null);
        }
      }

      // Atualiza estado visual do card + contador de progresso
      const doneCount = Object.values(newEx).filter((s) => s.done).length;
      const allDone = doneCount >= newCount;
      const prevDone = Object.values(prevEx).filter((s) => s.done).length;
      const prevAllDone = prevDone >= prevCount;

      if (allDone !== prevAllDone || doneCount !== prevDone) {
        patchExerciseCardState(wId, ex.id, allDone, doneCount, newCount);
      }

      // Feature: Índice de Progressão — atualiza badge ↑↓= a cada mudança
      patchProgressionBadge(wId, ex.id, newEx, lastSets[ex.id] ?? []);
    });

    // Atualiza barra de progresso geral do treino
    const wLogs = state.logs[wId] ?? {};
    const totalEx = workout.exercises.length;
    const doneEx = workout.exercises.filter((ex) => {
      const exLogs = wLogs[ex.id] ?? {};
      const sets = countSets(exLogs, ex.sets);
      return (
        sets > 0 && Object.values(exLogs).filter((s) => s.done).length >= sets
      );
    }).length;
    const bar = document.getElementById("workout-progress-bar");
    if (bar)
      bar.style.width = `${totalEx > 0 ? Math.round((doneEx / totalEx) * 100) : 0}%`;
    const counterEl = document.getElementById("workout-ex-counter");
    if (counterEl) {
      let totalSets = 0, doneSets = 0;
      workout.exercises.forEach(ex => {
        const exLogs = wLogs[ex.id] ?? {};
        totalSets += countSets(exLogs, ex.sets);
        doneSets  += Object.values(exLogs).filter(s => s.done).length;
      });
      counterEl.textContent = `${doneEx}/${totalEx} · ${doneSets}/${totalSets}s`;
    }

    // Patch: volume ao vivo
    const liveVolEl = document.getElementById("workout-live-vol");
    if (liveVolEl) {
      let liveVol = 0;
      workout.exercises.forEach(ex => {
        Object.values(newLogs[ex.id] ?? {}).forEach(s => {
          if (s.done && !s.warmup) {
            const w = parseFloat(s.w), r = parseFloat(s.r);
            if (w && r) liveVol += w * r;
          }
        });
      });
      const lastVol = lastSession?.vol ?? 0;
      liveVolEl.innerHTML = liveVol > 0 ? `
        <div>
          <div class="text-[8px] text-zinc-600 uppercase tracking-widest font-bold">Volume</div>
          <div class="text-base font-black font-mono text-white leading-none">${formatVolume(liveVol)}</div>
        </div>
        ${lastVol > 0 ? `
        <div class="text-[10px] font-mono leading-tight ${liveVol >= lastVol ? 'text-green-400' : 'text-zinc-600'}">
          ${liveVol >= lastVol
            ? `↑ +${formatVolume(liveVol - lastVol)} superou!`
            : `${formatVolume(lastVol - liveVol)} para superar`}
        </div>` : ''}
      ` : '';
    }
  }

  /* ─── Header ──────────────────────────────────────────────────── */

  #renderHeader(state) {
    if (state.tab === "cardio" && state.activeCardioSession) {
      this.#header.innerHTML = `
        <div class="text-xs text-white/40 uppercase tracking-widest font-bold">CARDIO</div>
        <div class="w-9"></div>
      `;
      this.#nav.style.transform = "translateY(150%)";
      return;
    }

    if (state.tab === "workout-editor") {
      const isNew = !state.editorWorkout?.id;
      this.#header.innerHTML = `
        <button data-action="back-from-editor"
                class="p-2 bg-zinc-900/80 rounded-lg text-zinc-400 hover:text-white border border-zinc-800 backdrop-blur active:scale-90 transition-transform">
          <i data-lucide="chevron-left" class="w-5 h-5"></i>
        </button>
        <span class="text-sm font-black text-white uppercase tracking-wider">
          ${isNew ? "Novo Treino" : "Editar Treino"}
        </span>
        <button data-action="save-workout"
                class="px-3 py-1.5 bg-theme-primary text-black text-xs font-black rounded-lg uppercase active:scale-95 transition-transform shadow-[0_0_10px_var(--theme-primary)]">
          Salvar
        </button>
      `;
      this.#nav.style.transform = "translateY(150%)";
      return;
    }

    if (state.tab === "settings") {
      this.#header.innerHTML = `
        <button data-action="back-from-settings"
                class="p-2 bg-zinc-900/80 rounded-lg text-zinc-400 hover:text-white border border-zinc-800 backdrop-blur active:scale-90 transition-transform">
          <i data-lucide="chevron-left" class="w-5 h-5"></i>
        </button>
        <span class="text-sm font-black text-white uppercase tracking-wider">Configurações</span>
        <div class="w-9"></div>
      `;
      this.#nav.style.transform = "translateY(150%)";
      return;
    }

    if (state.tab === "workout") {
      const L = getLabels(state.appMode);
      this.#header.innerHTML = `
        <button data-action="back" class="p-2 bg-zinc-900/80 rounded-lg text-zinc-400 hover:text-white border border-zinc-800 backdrop-blur active:scale-90 transition-transform">
          <i data-lucide="chevron-left" class="w-5 h-5"></i>
        </button>
        <div class="flex items-center gap-2">
          <button id="plate-calc-btn"
                  class="w-8 h-8 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-theme-primary active:scale-90 transition-all">
            <i data-lucide="ruler" class="w-3.5 h-3.5"></i>
          </button>
          <div id="timer-badge" class="hidden items-center bg-black border border-theme-accent rounded-full overflow-hidden">
            <button id="timer-sub"
                    class="px-2.5 h-8 text-zinc-500 text-[10px] font-black active:bg-zinc-900 transition-colors touch-manipulation flex items-center">−15</button>
            <button id="timer-skip"
                    class="flex items-center gap-1.5 px-2.5 h-8 border-x border-zinc-800/60 touch-manipulation active:opacity-70 transition-opacity">
              <div class="relative w-5 h-5 shrink-0 pointer-events-none">
                <svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#27272a" stroke-width="3.5"/>
                  <circle id="timer-ring-circle" cx="18" cy="18" r="15.9" fill="none"
                    stroke="var(--theme-primary)" stroke-width="3.5" stroke-linecap="round"
                    stroke-dasharray="100" stroke-dashoffset="0" class="transition-all duration-1000"/>
                </svg>
              </div>
              <span id="timer-text" class="font-mono font-bold text-theme-primary text-sm pointer-events-none">1:00</span>
            </button>
            <button id="timer-add"
                    class="px-2.5 h-8 text-zinc-500 text-[10px] font-black active:bg-zinc-900 transition-colors touch-manipulation flex items-center">+15</button>
          </div>
          <button id="timer-restart-btn"
                  class="hidden items-center gap-1 bg-zinc-900 border border-zinc-700 rounded-full px-2.5 h-8 text-[9px] text-zinc-500 font-mono active:scale-90 transition-all">
            <i data-lucide="timer" class="w-3 h-3"></i>
            <span id="timer-restart-label">60s</span>
          </button>
        </div>
        <button data-action="finish-workout" class="px-3 py-1.5 bg-theme-dim border border-theme-accent text-theme-primary text-xs font-bold rounded-lg uppercase active:scale-95 transition-transform">
          ${L.finishBtn}
        </button>
      `;
      // Re-bind referências após re-render do header
      this.#timerBadge = $("#timer-badge");
      this.#timerText = $("#timer-text");
      this.#timerRing = $("#timer-ring-circle");
      this.#nav.style.transform = "translateY(150%)";

      this.#header.querySelector('#timer-skip')?.addEventListener('click', () => {
        this.#timer.stop();
        hide(this.#timerBadge);
      });
      this.#header.querySelector('#timer-sub')?.addEventListener('click', () => this.#timer.adjustBy(-15));
      this.#header.querySelector('#timer-add')?.addEventListener('click', () => this.#timer.adjustBy(15));
      this.#header.querySelector('#plate-calc-btn')?.addEventListener('click', () => this.#showPlateCalcModal());
      this.#header.querySelector('#timer-restart-btn')?.addEventListener('click', () => {
        const rb = document.getElementById('timer-restart-btn');
        if (rb) hide(rb);
        this.#timerCardKey = this.#lastTimerCardKey;
        this.#timer.start(this.#lastRestDuration);
        show(this.#timerBadge);
        if (this.#timerText) this.#timerText.textContent = formatTime(this.#lastRestDuration);
        if (this.#timerRing) this.#timerRing.style.strokeDashoffset = '0';
      });

      if (window.lucide) lucide.createIcons({ nodes: [this.#header] });

      // Se o timer ainda está rodando, mostra o badge imediatamente
      if (this.#timer.isRunning) {
        show(this.#timerBadge);
        this.#timerText.textContent = formatTime(this.#timer.remaining);
        const pct = this.#timer.progress;
        const dash = (1 - pct) * 100;
        if (this.#timerRing)
          this.#timerRing.style.strokeDashoffset = dash.toFixed(1);
      }
    } else {
      const cfg = this.#theme.config;
      const projectName = state.projectName || cfg.name;
      this.#header.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-theme-dim border border-theme-dim flex items-center justify-center shadow-[0_0_15px_var(--theme-dim)] transition-colors duration-500">
            ${renderSharingan("w-6 h-6", true, state.theme)}
          </div>
          <div>
            <div class="text-[10px] text-theme-accent font-bold tracking-widest uppercase">Projeto</div>
            <div class="text-sm font-black text-white tracking-tighter truncate max-w-[140px]">${projectName}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button data-action="open-hub"
                  class="w-9 h-9 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-theme-primary active:scale-90 transition-all">
            <i data-lucide="layers" class="w-4 h-4"></i>
          </button>
          <button data-action="goto-settings"
                  class="w-9 h-9 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-300 active:scale-90 transition-all">
            <i data-lucide="settings" class="w-4 h-4"></i>
          </button>
          <button data-action="toggle-theme"
                  class="w-10 h-10 rounded-full bg-theme-dim border border-theme-accent flex items-center justify-center text-theme-primary shadow-[0_0_10px_var(--theme-dim)] active:scale-90 transition-all">
            <i data-lucide="${cfg.icon}" class="w-5 h-5"></i>
          </button>
        </div>
      `;
      this.#nav.style.transform = "translateY(0)";
    }
  }

  /* ─── Main content ────────────────────────────────────────────── */

  #renderMain(state) {
    const scroll = this.#main.scrollTop;

    // Substitui o container por um clone sem listeners, prevenindo acumulação de delegates
    const fresh = this.#main.cloneNode(false);
    this.#main.parentNode.replaceChild(fresh, this.#main);
    this.#main = fresh;

    switch (state.tab) {
      case "home": {
        setHTML(this.#main, renderHome(state, this.#allWorkouts().filter(w => !w.isCardio), this.#cardioProtocols));
        mountHome(this.#main, (action, payload) =>
          this.#handleAction(action, payload),
        );
        break;
      }
      case "treinar": {
        const _workouts   = this.#allWorkouts();
        const _templates  = this.#templateWorkouts();
        setHTML(this.#main, renderDashboard(state, _workouts, this.#cardioProtocols, _templates));
        mountDashboard(this.#main, (action, payload) =>
          this.#handleAction(action, payload),
        );
        break;
      }
      case "workout": {
        const workout = this.#allWorkouts().find(
          (w) => w.id === state.workoutId,
        );
        if (!workout) return;
        setHTML(this.#main, renderWorkout(state, workout));
        mountWorkout(this.#main, (action, payload) =>
          this.#handleAction(action, payload),
        );
        this.#main.scrollTop = scroll;
        break;
      }
      case "evoluir": {
        setHTML(this.#main, renderAnalytics(state, this.#allWorkouts()));
        mountAnalytics(this.#main, (action, payload) =>
          this.#handleAction(action, payload),
        );
        break;
      }
      case "corpo": {
        setHTML(this.#main, renderProfile(state));
        mountProfile(this.#main, (action, payload) =>
          this.#handleAction(action, payload),
        );
        break;
      }
      case "workout-editor": {
        const allExNames = [
          ...new Set([
            ...EXERCISE_LIBRARY,
            ...this.#allWorkouts().flatMap((w) => w.exercises.map((e) => e.name)),
          ]),
        ].sort();
        setHTML(
          this.#main,
          renderWorkoutEditor(state.editorWorkout, allExNames),
        );
        mountWorkoutEditor(this.#main, (action, payload) =>
          this.#handleAction(action, payload), allExNames,
        );
        break;
      }
      case "cardio": {
        setHTML(this.#main, renderCardio(state, this.#cardioProtocols));
        mountCardio(this.#main, (action, payload) =>
          this.#handleAction(action, payload),
        );
        break;
      }
      case "settings": {
        setHTML(this.#main, renderSettings(state, this.#allWorkouts().filter(w => !w.isCardio), this.#cardioProtocols));
        mountSettings(this.#main, (action, payload) =>
          this.#handleAction(action, payload),
        );
        break;
      }
    }

    this.#renderModal(state);
  }

  /* ─── Modais ──────────────────────────────────────────────────── */

  #renderModal(state) {
    if (!state.activeModal) {
      this.#modalLayer.innerHTML = "";
      return;
    }

    switch (state.activeModal) {
      case "confirm":
        this.#showConfirmModal(state.modalData);
        break;
      case "battle-report":
        this.#showBattleReport(state.modalData);
        break;
      case "notes":
        this.#showNotesModal();
        break;
      case "cardio-log":
        this.#showCardioLogModal();
        break;
      case "calendar":
        this.#showCalendarModal();
        break;
      case "hub":
        this.#showHubModal();
        break;
      case "exercise-detail":
        this.#showExerciseDetailModal(state.modalData);
        break;
      case "exercise-demo":
        this.#showExerciseDemoModal(state.modalData);
        break;
      case "cycle-overview":
        this.#showCycleModal();
        break;
      case "workout-picker":
        this.#showWorkoutPickerModal();
        break;
    }
  }



  #showConfirmModal(data = {}) {
    this.#modalLayer.innerHTML = `
      <div class="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 backdrop-blur-md animate-zoom-in">
        <div class="glass-card w-11/12 max-w-sm p-6 rounded-3xl border border-theme-dim shadow-[0_0_60px_var(--theme-dim)] text-center">
          <div class="w-16 h-16 mx-auto mb-4 text-theme-primary animate-pulse">
            <i data-lucide="alert-triangle" class="w-full h-full"></i>
          </div>
          <h3 class="text-white font-black uppercase italic text-xl mb-2">Tem certeza?</h3>
          <p class="text-zinc-400 text-sm mb-6 font-mono">${data.message ?? "Essa ação não pode ser desfeita."}</p>
          <div class="flex gap-3">
            <button id="confirm-no"  class="flex-1 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-400 font-bold text-sm uppercase active:scale-95">Não</button>
            <button id="confirm-yes" class="flex-1 py-3 bg-theme-primary text-black font-black text-sm uppercase rounded-xl shadow-[0_0_15px_var(--theme-primary)] active:scale-95">SIM</button>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    $("#confirm-no", this.#modalLayer)?.addEventListener("click", () =>
      this.#closeModal(),
    );
    $("#confirm-yes", this.#modalLayer)?.addEventListener("click", () => {
      const action = this.#store.getState().modalData?.confirmAction;
      const payload = this.#store.getState().modalData?.confirmPayload;
      this.#closeModal();
      if (action) this.#executeConfirmedAction(action, payload);
    });
  }

  #showBattleReport(s = {}) {
    if (!s) return;
    const state = this.#store.getState();
    const L = getLabels(state.appMode);
    const pName = state.projectName || this.#theme.config.name;

    // Próximo treino do ciclo (posição já avançada pelo finishWorkout)
    const { cycleOrder = [], cyclePosition = 0 } = state;
    const nextWId  = cycleOrder[cyclePosition] ?? null;
    const nextW    = nextWId ? this.#allWorkouts().find(w => w.id === nextWId && !w.isCardio) : null;
    const nextIsOff = nextWId === null && cycleOrder.length > 0;

    const prevSession = state.history.find(
      h => h.workoutId === s.workoutId && h.id !== s.entryId
    );

    this.#reportLayer.innerHTML = renderBattleReport(s, pName, L, nextW, nextIsOff, prevSession);
    if (window.lucide) lucide.createIcons({ nodes: [this.#reportLayer] });

    if ((s.newAchievements ?? []).length > 0) {
      const majorId = s.newAchievements.find(id => MAJOR_ACHIEVEMENTS.has(id));
      if (majorId) setTimeout(() => this.#showCelebrationOverlay(majorId), 2000);
      else setTimeout(() => this.#showAchievementToast(s.newAchievements), 1200);
    }

    $("#close-report", this.#reportLayer)?.addEventListener("click", () =>
      this.#closeReport(),
    );
    $("#next-workout-btn", this.#reportLayer)?.addEventListener("click", () => {
      this.#closeReport();
      this.#closeModal();
      this.#workoutCtrl.startWorkout(nextW.id);
    });
    $("#end-operation", this.#reportLayer)?.addEventListener("click", () => {
      this.#closeReport();
      this.#closeModal();
      this.#navigate("treinar");
    });
    $("#share-report", this.#reportLayer)?.addEventListener("click", async () => {
      const breakdown = (s.breakdown ?? []).map(b => `  ${b.name}: ${Math.round(b.vol)}kg`).join('\n');
      const commute = s.mission?.commute;
      const commuteLines = commute
        ? (commute.go && commute.return && commute.go.mode !== commute.return.mode
          ? [
              `🚶 Ida (${commute.go.mode === 'walk' ? 'pé' : commute.go.mode === 'run' ? 'corrida' : 'bike'}): ${commute.go.distance}km · ${commute.go.duration}min · ~${commute.go.calories}kcal`,
              `🚶 Volta (${commute.return.mode === 'walk' ? 'pé' : commute.return.mode === 'run' ? 'corrida' : 'bike'}): ${commute.return.distance}km · ${commute.return.duration}min · ~${commute.return.calories}kcal`,
            ]
          : [`🚶 Deslocamento: ${commute.distance}km · ${commute.duration}min · ~${commute.calories}kcal`])
        : [];
      const shareText = [
        `⚔️ MISSÃO CONCLUÍDA — ${s.title ?? 'Treino'}`,
        '',
        `📦 Carga total: ${formatVolume(s.vol ?? 0)}`,
        `🔁 Repetições: ${s.reps ?? 0}`,
        s.duration ? `⏱️ Duração: ${formatDuration(s.duration)}` : '',
        s.mvp?.name ? `🏆 MVP: ${s.mvp.name} ${s.mvp.weight}kg × ${s.mvp.reps}` : '',
        ...commuteLines,
        commute && s.mission?.totals?.duration > (s.duration ?? 0)
          ? `⏳ Missão total: ${s.mission.totals.duration}min · ~${s.mission.totals.calories.toLocaleString('pt-BR')}kcal` : '',
        breakdown ? `\n📊 Breakdown:\n${breakdown}` : '',
        '',
        `💪 ${state.projectName || 'Treino Monstro'} · #TreinoMonstro`,
      ].filter(s => s !== '').join('\n').replace(/\n{3,}/g, '\n\n');

      const btn = this.#reportLayer.querySelector('#share-report');
      const resetBtn = () => {
        if (!btn) return;
        btn.innerHTML = '<i data-lucide="copy" class="w-3.5 h-3.5 inline mr-1.5"></i>Compartilhar resultado';
        if (window.lucide) lucide.createIcons({ nodes: [btn] });
      };
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Treino Monstro', text: shareText });
        } else {
          await navigator.clipboard.writeText(shareText);
          if (btn) {
            btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 inline mr-1.5"></i>Copiado!';
            if (window.lucide) lucide.createIcons({ nodes: [btn] });
            setTimeout(resetBtn, 2500);
          }
        }
      } catch {}
    });

    $("#discard-session", this.#reportLayer)?.addEventListener("click", () => {
      if (!confirm("Descartar esta sessão? Ela será removida do histórico.")) return;
      this.#workoutCtrl.discardLastWorkout(s.entryId, s.workoutId);
      this.#closeReport();
      this.#closeModal();
      this.#navigate("treinar");
    });
  }

  #showCycleModal() {
    const state = this.#store.getState();
    const { cycleOrder = [], cyclePosition = 0, cycleDone = [], cycleGoal = 6 } = state;
    const allWorkouts = this.#allWorkouts();

    const NAMES = { '1': 'Push A', '2': 'Legs A', '3': 'Pull A', '4': 'Push B', '5': 'Legs B', '6': 'Pull B' };
    const MUSCLES = { '1': 'Peito · Ombro · Tríceps', '2': 'Pernas A', '3': 'Costas · Bíceps', '4': 'Peito · Ombro · Tríceps', '5': 'Pernas B + Deadlift', '6': 'Costas · Bíceps' };

    const slots = cycleOrder.map((wId, i) => {
      const w          = wId ? allWorkouts.find(x => x.id === wId) : null;
      const isDone     = wId && cycleDone.includes(wId);
      const isCurrent  = i === cyclePosition;
      const isOff      = wId === null;
      const name       = isOff ? 'Descanso' : (w?.label ?? NAMES[wId] ?? `Treino ${wId}`);
      const sub        = isOff ? 'Dia de recuperação' : (w?.subtitle ?? MUSCLES[wId] ?? '');

      const border = isDone ? 'border-green-800/60' : isCurrent ? 'border-theme-accent/60' : 'border-zinc-800/40';
      const bg     = isDone ? 'bg-green-950/30' : isCurrent ? 'bg-theme-dark/60' : 'bg-zinc-900/30';
      const icon   = isDone ? 'check-circle' : isOff ? 'moon' : isCurrent ? 'target' : 'dumbbell';
      const icolor = isDone ? 'text-green-400' : isOff ? 'text-zinc-600' : isCurrent ? 'text-theme-primary' : 'text-zinc-700';
      const tcolor = isDone ? 'text-green-300' : isOff ? 'text-zinc-500' : isCurrent ? 'text-theme-primary' : 'text-zinc-500';

      const badge = isDone
        ? `<span class="text-[8px] font-black text-green-500 uppercase tracking-widest">FEITO</span>`
        : isCurrent
        ? `<span class="text-[8px] font-black text-theme-primary uppercase tracking-widest animate-pulse">ATUAL</span>`
        : '';

      const startBtn = (!isOff && !isDone)
        ? `<button data-hub-action="hub-start" data-hub-payload="${wId}"
                   class="ripple-target ml-auto px-3 py-1 rounded-lg bg-theme-dim border border-theme-accent/40
                          text-theme-primary text-[9px] font-black uppercase tracking-widest active:scale-90 transition-all shrink-0">
             Treinar
           </button>`
        : isDone
        ? `<button data-hub-action="hub-start" data-hub-payload="${wId}"
                   class="ripple-target ml-auto px-3 py-1 rounded-lg bg-zinc-800/40 border border-zinc-700/40
                          text-zinc-500 text-[9px] font-black uppercase tracking-widest active:scale-90 transition-all shrink-0">
             Refazer
           </button>`
        : '';

      return `
        <div class="flex items-center gap-3 p-3 rounded-xl ${bg} border ${border}">
          <i data-lucide="${icon}" class="w-4 h-4 ${icolor} shrink-0"></i>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-black ${tcolor}">${name}</span>
              ${badge}
            </div>
            <div class="text-[9px] text-zinc-600 truncate">${sub}</div>
          </div>
          ${startBtn}
        </div>`;
    }).join('');

    const doneCount = cycleDone.length;

    this.#modalLayer.innerHTML = `
      <div class="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-zoom-in"
           id="cycle-backdrop">
        <div class="glass-card w-full max-w-md rounded-t-3xl border border-zinc-800/60 overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-zinc-800/60">
            <div>
              <div class="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Ciclo PPL</div>
              <div class="text-sm font-black text-white">${doneCount}/${cycleGoal} treinos · posição ${cyclePosition + 1}/${cycleOrder.length}</div>
            </div>
            <button id="close-cycle-modal"
                    class="ripple-target w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center
                           text-zinc-400 active:scale-90 transition-all">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
          <div class="p-4 space-y-2 overflow-y-auto no-scrollbar" style="max-height:70vh">
            ${slots}
          </div>
        </div>
      </div>`;

    lucide.createIcons({ nodes: [this.#modalLayer] });

    const close = () => this.#store.setState({ activeModal: null, modalData: null });
    document.getElementById('close-cycle-modal')?.addEventListener('click', close);
    document.getElementById('cycle-backdrop')?.addEventListener('click', e => {
      if (e.target.id === 'cycle-backdrop') close();
    });
    this.#modalLayer.querySelectorAll('[data-hub-action="hub-start"]').forEach(btn => {
      btn.addEventListener('click', () => {
        close();
        setTimeout(() => this.#handleAction('start-workout', btn.dataset.hubPayload), 100);
      });
    });
  }

  #showWorkoutPickerModal() {
    const allWorkouts = this.#allWorkouts().filter(w => !w.isCardio);
    const state       = this.#store.getState();
    const { cycleOrder = [], cyclePosition = 0, cycleDone = [] } = state;
    const nextWId     = cycleOrder[cyclePosition] ?? null;

    const cards = allWorkouts.map(w => {
      const isNext = w.id === nextWId;
      const isDone = cycleDone.includes(w.id);
      return `
        <button data-hub-action="hub-start" data-hub-payload="${w.id}"
                class="ripple-target w-full flex items-center gap-3 p-3 rounded-xl text-left
                       ${isNext ? 'bg-theme-dark/60 border border-theme-accent/50' : 'bg-zinc-900/40 border border-zinc-800/40'}
                       active:scale-[0.98] transition-all">
          <div class="w-9 h-9 rounded-xl ${isNext ? 'bg-theme-dim' : 'bg-zinc-800/60'} flex items-center justify-center shrink-0">
            <i data-lucide="${isDone ? 'check-circle' : 'dumbbell'}" class="w-4 h-4 ${isDone ? 'text-green-400' : isNext ? 'text-theme-primary' : 'text-zinc-600'}"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-black ${isNext ? 'text-theme-primary' : 'text-white'}">${w.label ?? w.name}</span>
              ${isNext ? `<span class="text-[7px] font-black text-theme-primary uppercase tracking-widest bg-theme-dim px-1.5 py-0.5 rounded">PRÓXIMO</span>` : ''}
              ${isDone ? `<span class="text-[7px] font-black text-green-500 uppercase tracking-widest">✓ FEITO</span>` : ''}
            </div>
            <div class="text-[9px] text-zinc-500 truncate">${w.subtitle ?? w.description ?? ''}</div>
          </div>
          <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-zinc-600 shrink-0"></i>
        </button>`;
    }).join('');

    this.#modalLayer.innerHTML = `
      <div class="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-zoom-in"
           id="picker-backdrop">
        <div class="glass-card w-full max-w-md rounded-t-3xl border border-zinc-800/60 overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-zinc-800/60">
            <div>
              <div class="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Liberdade de Treino</div>
              <div class="text-sm font-black text-white">Escolher treino</div>
            </div>
            <button id="close-picker-modal"
                    class="ripple-target w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center
                           text-zinc-400 active:scale-90 transition-all">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
          <div class="p-4 space-y-2 overflow-y-auto no-scrollbar" style="max-height:65vh">
            ${cards}
          </div>
        </div>
      </div>`;

    lucide.createIcons({ nodes: [this.#modalLayer] });

    const close = () => this.#store.setState({ activeModal: null, modalData: null });
    document.getElementById('close-picker-modal')?.addEventListener('click', close);
    document.getElementById('picker-backdrop')?.addEventListener('click', e => {
      if (e.target.id === 'picker-backdrop') close();
    });
    this.#modalLayer.querySelectorAll('[data-hub-action="hub-start"]').forEach(btn => {
      btn.addEventListener('click', () => {
        close();
        setTimeout(() => this.#handleAction('start-workout', btn.dataset.hubPayload), 100);
      });
    });
  }

  #showWorkoutHistoryModal(workout, history) {
    const sessions = history
      .filter((h) => h.workoutId === workout.id)
      .slice(0, 12);

    this.#modalLayer.innerHTML = `
      <div class="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-zoom-in"
           id="history-backdrop">
        <div class="glass-card w-full max-w-md rounded-t-3xl border border-zinc-800/60 overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-zinc-800/60">
            <div>
              <div class="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Histórico</div>
              <div class="text-sm font-black text-white">${workout.title}</div>
            </div>
            <button id="close-history"
                    class="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center
                           text-zinc-400 hover:text-white active:scale-90 transition-all">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
          <div class="overflow-y-auto no-scrollbar" style="max-height:60vh">
            <div class="p-4 space-y-2">
              ${
                sessions.length === 0
                  ? `<p class="text-xs text-zinc-600 text-center py-8 font-mono">Nenhuma sessão registrada</p>`
                  : sessions
                      .map(
                        (h, i) => `
                    <div class="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/50 px-4 py-3 rounded-xl">
                      <div class="flex-1 min-w-0">
                        <div class="text-xs font-bold text-white">${formatDate(h.date)}</div>
                        <div class="text-[10px] font-mono text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          ${h.reps ? `<span>${h.reps} reps</span>` : ""}
                          ${h.duration ? `<span class="text-zinc-700">·</span><span>${formatDuration(h.duration)}</span>` : ""}
                          ${h.notes ? `<span class="text-zinc-700">·</span><span class="italic">"${h.notes}"</span>` : ""}
                        </div>
                      </div>
                      <div class="text-right shrink-0">
                        <div class="text-sm font-black font-mono ${i === 0 ? "text-theme-primary" : "text-zinc-400"}">${formatVolume(h.vol ?? 0)}</div>
                        ${i === 0 ? '<div class="text-[8px] text-theme-primary/60 font-bold uppercase">mais recente</div>' : ""}
                      </div>
                    </div>
                  `,
                      )
                      .join("")
              }
            </div>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    $("#close-history", this.#modalLayer)?.addEventListener("click", () =>
      this.#closeModal(),
    );
    $("#history-backdrop", this.#modalLayer)?.addEventListener("click", (e) => {
      if (e.target.id === "history-backdrop") this.#closeModal();
    });
  }

  #showCardioLogModal() {
    const DIST_PRESETS = [3, 5, 8, 10, 15, 21];

    // Saved protocols: top 3 distinct combos (type|local|distance|effort)
    const history = this.#store.getState().cardioHistory ?? [];
    const seen = new Set();
    const savedProtocols = history
      .filter(c => {
        const key = `${c.type}|${c.local ?? ''}|${c.distance ?? ''}|${c.effort ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);

    this.#modalLayer.innerHTML = `
      <div class="fixed inset-0 z-[80] flex items-end justify-center bg-black/90 backdrop-blur-sm animate-zoom-in">
        <div class="glass-card w-full max-w-sm rounded-t-3xl border border-theme-dim shadow-[0_0_50px_var(--theme-dim)] overflow-y-auto max-h-[90vh]">
          <div class="flex justify-center pt-3 pb-1">
            <div class="w-10 h-1 rounded-full bg-zinc-700"></div>
          </div>
          <div class="p-5 pb-8 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <i data-lucide="activity" class="w-5 h-5 text-theme-primary"></i>
                <h2 class="text-base font-black uppercase text-white">Registrar Cardio</h2>
              </div>
              <button id="close-cardio-modal" class="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 active:scale-90 transition-all">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            </div>

            ${savedProtocols.length > 0 ? `
            <div>
              <div class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider mb-2">Repetir Protocolo</div>
              <div class="space-y-1.5">
                ${savedProtocols.map(p => {
                  const ef = p.effort ?? 'moderado';
                  const efColor = ef === 'forte' ? 'text-rose-400 bg-rose-900/20' : ef === 'fácil' ? 'text-green-400 bg-green-900/20' : 'text-amber-400 bg-amber-900/20';
                  const efLabel = ef === 'forte' ? 'Forte' : ef === 'fácil' ? 'Fácil' : 'Moderado';
                  return `<button data-quick-protocol='${JSON.stringify({ type: p.type, local: p.local ?? null, distance: p.distance ?? null, effort: ef })}'
                    class="quick-proto-btn w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 active:scale-[0.98] transition-all group">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="w-8 h-8 rounded-lg bg-zinc-700 border border-zinc-600 flex items-center justify-center shrink-0">
                        <i data-lucide="activity" class="w-4 h-4 text-zinc-400 pointer-events-none"></i>
                      </div>
                      <div class="text-left min-w-0">
                        <div class="text-xs font-bold text-white truncate">${p.type ?? 'Corrida'}${p.distance ? ` · ${p.distance}km` : ''}${p.local ? ` · ${p.local}` : ''}</div>
                        <span class="text-[8px] font-black px-1.5 py-0.5 rounded ${efColor}">${efLabel}</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-1 text-zinc-600 group-hover:text-zinc-400 shrink-0 transition-colors">
                      <i data-lucide="repeat" class="w-3.5 h-3.5 pointer-events-none"></i>
                      <span class="text-[9px] font-bold uppercase">Usar</span>
                    </div>
                  </button>`;
                }).join('')}
              </div>
            </div>` : ''}

            <div>
              <div class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Tipo</div>
              <div class="grid grid-cols-3 gap-2">
                ${[['corrida','activity','Corrida'],['bike','wind','Bike'],['outro','zap','Outro']].map(([key,icon,label],i) => `
                  <button data-type-btn="${key}"
                          class="type-btn flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all active:scale-95
                                 ${i === 0 ? 'bg-theme-dim border-theme-accent text-theme-primary' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}">
                    <i data-lucide="${icon}" class="w-5 h-5 pointer-events-none"></i>
                    <span class="text-[10px] font-black pointer-events-none">${label}</span>
                  </button>`).join('')}
              </div>
            </div>

            <div id="local-section">
              <div class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Local</div>
              <div class="grid grid-cols-2 gap-2">
                <button data-local-btn="rua"
                        class="local-btn flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all active:scale-95 bg-theme-dim border-theme-accent text-theme-primary">
                  <i data-lucide="wind" class="w-4 h-4 pointer-events-none"></i>
                  <span class="text-xs font-black pointer-events-none">Rua</span>
                </button>
                <button data-local-btn="esteira"
                        class="local-btn flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all active:scale-95 bg-zinc-900 border-zinc-800 text-zinc-500">
                  <i data-lucide="repeat" class="w-4 h-4 pointer-events-none"></i>
                  <span class="text-xs font-black pointer-events-none">Esteira</span>
                </button>
              </div>
            </div>

            <div>
              <div class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Distância (km)</div>
              <div class="flex flex-wrap gap-1.5 mb-2">
                ${DIST_PRESETS.map((d, i) => `
                  <button data-dist-btn="${d}"
                          class="dist-btn px-3 py-2 rounded-lg text-xs font-black border transition-all active:scale-95
                                 ${i === 1 ? 'bg-theme-dim border-theme-accent text-theme-primary' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}">
                    ${d}km
                  </button>`).join('')}
                <button id="dist-custom-toggle"
                        class="px-3 py-2 rounded-lg text-xs font-bold border bg-zinc-900 border-zinc-800 text-zinc-600 active:scale-95 transition-all">
                  outro
                </button>
              </div>
              <input type="tel" inputmode="decimal" id="dist-custom-input" placeholder="Ex: 6.5 km"
                     class="input-ninja w-full py-2.5 rounded-lg text-sm font-bold text-center hidden" />
            </div>

            <div>
              <div class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Tempo</div>
              <div class="flex items-center gap-2">
                <div class="flex-1 relative">
                  <input type="tel" inputmode="numeric" id="cardio-min" placeholder="28" maxlength="3"
                         class="input-ninja w-full py-3 rounded-xl text-xl font-black font-mono text-center" />
                  <div class="text-center text-[8px] text-zinc-600 font-bold mt-0.5">MIN</div>
                </div>
                <span class="text-2xl font-black text-zinc-500 shrink-0 mb-5">:</span>
                <div class="flex-1 relative">
                  <input type="tel" inputmode="numeric" id="cardio-sec" placeholder="00" maxlength="2"
                         class="input-ninja w-full py-3 rounded-xl text-xl font-black font-mono text-center" />
                  <div class="text-center text-[8px] text-zinc-600 font-bold mt-0.5">SEG</div>
                </div>
              </div>
              <div id="pace-preview" class="hidden mt-2 py-2 px-4 text-center rounded-lg bg-theme-dim/40 border border-theme-dim flex items-baseline justify-center gap-1">
                <span class="text-theme-primary font-black font-mono text-xl" id="pace-value"></span>
                <span class="text-zinc-500 text-xs font-bold">/km</span>
              </div>
            </div>

            <div>
              <div class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Esforço</div>
              <div class="grid grid-cols-3 gap-2">
                <button data-effort-btn="fácil"  class="effort-btn py-2.5 rounded-xl border text-xs font-black transition-all active:scale-95 bg-zinc-900 border-zinc-800 text-zinc-500">Fácil</button>
                <button data-effort-btn="moderado" class="effort-btn py-2.5 rounded-xl border text-xs font-black transition-all active:scale-95 text-amber-400 bg-amber-900/20 border-amber-900/40">Moderado</button>
                <button data-effort-btn="forte"  class="effort-btn py-2.5 rounded-xl border text-xs font-black transition-all active:scale-95 bg-zinc-900 border-zinc-800 text-zinc-500">Forte</button>
              </div>
            </div>

            <input type="text" id="cardio-notes" placeholder="Notas (opcional)..."
                   class="input-ninja w-full py-2.5 rounded-lg text-xs font-mono" />

            <button id="save-cardio-btn"
                    class="w-full py-3.5 bg-theme-primary text-black font-black text-sm uppercase rounded-xl shadow-[0_0_15px_var(--theme-primary)] active:scale-95 transition-all">
              <i data-lucide="check" class="w-4 h-4 inline -mt-0.5 mr-1"></i> Salvar
            </button>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    let selectedType   = 'corrida';
    let selectedLocal  = 'rua';
    let selectedDist   = 5;
    let selectedEffort = 'moderado';
    let customDistMode = false;

    const ml = this.#modalLayer;

    const calcPaceStr = (durMin, distKm) => {
      if (!durMin || !distKm || durMin <= 0 || distKm <= 0) return null;
      const p = durMin / distKm;
      const m = Math.floor(p);
      const s = Math.round((p - m) * 60);
      return `${m}:${String(s).padStart(2, '0')}`;
    };

    const getDist = () => customDistMode
      ? parseFloat(ml.querySelector('#dist-custom-input')?.value?.replace(',', '.')) || 0
      : selectedDist;

    const updatePacePreview = () => {
      const min = parseInt(ml.querySelector('#cardio-min')?.value) || 0;
      const sec = parseInt(ml.querySelector('#cardio-sec')?.value) || 0;
      const totalMin = min + sec / 60;
      const dist = getDist();
      const preview = ml.querySelector('#pace-preview');
      const paceVal = ml.querySelector('#pace-value');
      if (preview && paceVal) {
        const pace = calcPaceStr(totalMin, dist);
        if (pace) { paceVal.textContent = pace; preview.classList.remove('hidden'); }
        else { preview.classList.add('hidden'); }
      }
    };

    const syncType = () => {
      ml.querySelectorAll('.type-btn').forEach(b => {
        const on = b.dataset.typeBtn === selectedType;
        b.className = `type-btn flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all active:scale-95 ${on ? 'bg-theme-dim border-theme-accent text-theme-primary' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`;
      });
      const ls = ml.querySelector('#local-section');
      if (ls) ls.style.display = selectedType === 'outro' ? 'none' : '';
    };

    const syncLocal = () => {
      ml.querySelectorAll('.local-btn').forEach(b => {
        const on = b.dataset.localBtn === selectedLocal;
        b.className = `local-btn flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all active:scale-95 ${on ? 'bg-theme-dim border-theme-accent text-theme-primary' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`;
      });
    };

    const syncDist = () => {
      ml.querySelectorAll('.dist-btn').forEach(b => {
        const on = !customDistMode && parseInt(b.dataset.distBtn) === selectedDist;
        b.className = `dist-btn px-3 py-2 rounded-lg text-xs font-black border transition-all active:scale-95 ${on ? 'bg-theme-dim border-theme-accent text-theme-primary' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`;
      });
      const ci = ml.querySelector('#dist-custom-input');
      if (ci) ci.classList.toggle('hidden', !customDistMode);
    };

    const EFFORT_COLORS = {
      'fácil':    'text-green-400 bg-green-900/20 border-green-900/40',
      'moderado': 'text-amber-400 bg-amber-900/20 border-amber-900/40',
      'forte':    'text-rose-400  bg-rose-900/20  border-rose-900/40',
    };
    const syncEffort = () => {
      ml.querySelectorAll('.effort-btn').forEach(b => {
        const on = b.dataset.effortBtn === selectedEffort;
        b.className = `effort-btn py-2.5 rounded-xl border text-xs font-black transition-all active:scale-95 ${on ? EFFORT_COLORS[b.dataset.effortBtn] : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`;
      });
    };

    ml.querySelectorAll('.type-btn').forEach(b => b.addEventListener('click', () => { selectedType = b.dataset.typeBtn; syncType(); }));
    ml.querySelectorAll('.local-btn').forEach(b => b.addEventListener('click', () => { selectedLocal = b.dataset.localBtn; syncLocal(); }));
    ml.querySelectorAll('.dist-btn').forEach(b => b.addEventListener('click', () => { selectedDist = parseInt(b.dataset.distBtn); customDistMode = false; syncDist(); updatePacePreview(); }));
    ml.querySelectorAll('.effort-btn').forEach(b => b.addEventListener('click', () => { selectedEffort = b.dataset.effortBtn; syncEffort(); }));
    ml.querySelector('#dist-custom-toggle')?.addEventListener('click', () => { customDistMode = true; selectedDist = 0; syncDist(); updatePacePreview(); ml.querySelector('#dist-custom-input')?.focus(); });
    ml.querySelector('#dist-custom-input')?.addEventListener('input', updatePacePreview);
    ml.querySelector('#cardio-min')?.addEventListener('input', updatePacePreview);
    ml.querySelector('#cardio-sec')?.addEventListener('input', updatePacePreview);

    ml.querySelectorAll('.quick-proto-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          const p = JSON.parse(btn.dataset.quickProtocol);
          if (p.type)   { selectedType = p.type; syncType(); }
          if (p.local)  { selectedLocal = p.local; syncLocal(); }
          if (p.effort) { selectedEffort = p.effort; syncEffort(); }
          if (p.distance) {
            if (DIST_PRESETS.includes(p.distance)) { selectedDist = p.distance; customDistMode = false; syncDist(); }
            else {
              customDistMode = true; selectedDist = 0; syncDist();
              const ci = ml.querySelector('#dist-custom-input');
              if (ci) { ci.value = p.distance; }
            }
          }
          updatePacePreview();
        } catch (_) {}
      });
    });

    ml.querySelector('#close-cardio-modal')?.addEventListener('click', () => this.#closeModal());

    ml.querySelector('#save-cardio-btn')?.addEventListener('click', () => {
      const minVal = parseInt(ml.querySelector('#cardio-min')?.value) || 0;
      const secVal = Math.min(59, parseInt(ml.querySelector('#cardio-sec')?.value) || 0);
      const totalDuration = minVal + secVal / 60;
      const distVal = getDist();
      if (!distVal || distVal <= 0) {
        ml.querySelector('#dist-custom-input')?.focus();
        return;
      }
      const pace  = totalDuration > 0 ? calcPaceStr(totalDuration, distVal) : null;
      const notes = ml.querySelector('#cardio-notes')?.value?.trim() || null;
      const entry = {
        date:     new Date().toISOString(),
        type:     selectedType,
        local:    selectedType !== 'outro' ? selectedLocal : null,
        distance: distVal,
        duration: totalDuration > 0 ? Math.round(totalDuration * 100) / 100 : null,
        pace,
        effort:   selectedEffort,
        notes,
      };
      const cardioHistory = [entry, ...(this.#store.getState().cardioHistory ?? [])].slice(0, 100);
      const achievements = this.#cardioCtrl.checkAchievementsAfterEntry(cardioHistory);
      this.#store.setState({ cardioHistory, achievements });
      this.#closeModal();
    });
  }

  #showHubModal() {
    const state = this.#store.getState();
    const {
      history = [], cardioHistory = [], cycleDone = [], cycleGoal = 6,
      cycleOrder = [], cyclePosition = 0, achievements = [],
      biometrics = null, bodyWeights = [], prs = {}, completedCycles = 0,
    } = state;

    const allWorkouts = this.#allWorkouts();
    const nextWId     = cycleOrder.length > 0 ? (cycleOrder[cyclePosition] ?? null) : null;
    const nextWorkout = nextWId ? allWorkouts.find(w => w.id === nextWId && !w.isCardio) ?? null : null;
    const lastSession = history[0] ?? null;
    const lastDaysAgo = lastSession ? Math.floor((Date.now() - new Date(lastSession.date)) / 86400000) : null;
    const lastLabel   = lastDaysAgo === 0 ? 'Hoje' : lastDaysAgo === 1 ? 'Ontem' : lastDaysAgo != null ? `há ${lastDaysAgo}d` : null;
    const currentW    = bodyWeights?.[0]?.value ?? biometrics?.weight ?? null;
    const today       = new Date();

    const localKey = d => {
      const dt = new Date(d);
      return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    };
    const todayKey = localKey(today);

    // Streak
    const dateSets = new Set([...history.map(h => localKey(h.date)), ...cardioHistory.map(c => localKey(c.date))]);
    let streak = 0;
    const startOff = dateSets.has(todayKey) ? 0 : 1;
    for (let i = startOff; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (dateSets.has(localKey(d))) streak++; else break;
    }

    // Month trained (unique days)
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const monthTrained = new Set([
      ...history.filter(h => h.date.slice(0, 7) === monthKey).map(h => h.date.slice(0, 10)),
      ...cardioHistory.filter(c => c.date.slice(0, 7) === monthKey).map(c => c.date.slice(0, 10)),
    ]).size;

    // Workout done today
    const workoutDoneToday = nextWorkout && history.some(h => localKey(h.date) === todayKey && h.workoutId === nextWorkout.id);

    // PRs this week vs total
    const oneWeekAgo   = Date.now() - 7 * 86400000;
    const prsThisWeek  = Object.values(prs).filter(pr => pr.date && new Date(pr.date).getTime() > oneWeekAgo).length;
    const prCount      = Object.keys(prs).length;

    // Volume + km totals (for achievement calc)
    const totalVol = history.reduce((a, h) => a + (h.vol ?? 0), 0);
    const totalKm  = cardioHistory.reduce((s, c) => s + (c.distance ?? 0), 0);

    // Next achievement
    const earnedSet = new Set(achievements ?? []);
    const milestones = [
      { id: 'session_1',    val: history.length,    target: 1   },
      { id: 'session_10',   val: history.length,    target: 10  },
      { id: 'session_25',   val: history.length,    target: 25  },
      { id: 'session_50',   val: history.length,    target: 50  },
      { id: 'session_100',  val: history.length,    target: 100 },
      { id: 'session_200',  val: history.length,    target: 200 },
      { id: 'vol_1t',       val: totalVol / 1000,   target: 1   },
      { id: 'vol_10t',      val: totalVol / 1000,   target: 10  },
      { id: 'vol_100t',     val: totalVol / 1000,   target: 100 },
      { id: 'vol_500t',     val: totalVol / 1000,   target: 500 },
      { id: 'cycle_1',      val: completedCycles,   target: 1   },
      { id: 'cycle_5',      val: completedCycles,   target: 5   },
      { id: 'cardio_first', val: cardioHistory.length, target: 1  },
      { id: 'cardio_5',     val: cardioHistory.length, target: 5  },
      { id: 'cardio_10',    val: cardioHistory.length, target: 10 },
      { id: 'cardio_25',    val: cardioHistory.length, target: 25 },
      { id: 'cardio_10km',  val: totalKm,           target: 10  },
      { id: 'cardio_50km',  val: totalKm,           target: 50  },
      { id: 'cardio_100km', val: totalKm,           target: 100 },
    ];
    const unearned = milestones.filter(m => !earnedSet.has(m.id) && ACHIEVEMENT_MAP[m.id]);
    const nextAch  = unearned.length
      ? (() => {
          const closest = unearned
            .map(m => ({ ...m, pct: Math.min(99, Math.round(m.val / m.target * 100)) }))
            .sort((a, b) => b.pct - a.pct)[0];
          const def = ACHIEVEMENT_MAP[closest.id];
          return { name: def.name, icon: def.icon, pct: closest.pct };
        })()
      : null;

    const earnedCount    = (achievements ?? []).filter(id => typeof id === 'string').length;
    const themeName      = this.#theme.config?.name ?? 'AMATERASU';
    const lastCardio     = cardioHistory[0] ?? null;
    const lastCardioDays = lastCardio ? Math.floor((Date.now() - new Date(lastCardio.date)) / 86400000) : null;
    const lastCardioLbl  = lastCardioDays === 0 ? 'Hoje' : lastCardioDays === 1 ? 'Ontem' : lastCardioDays != null ? `há ${lastCardioDays}d` : null;

    // ── Hero: Missão de Hoje ──────────────────────────────────────────────
    let heroHTML;
    if (workoutDoneToday) {
      heroHTML = `
        <button data-hub-action="hub-nav" data-hub-payload="evoluir"
                class="ripple-target w-full rounded-2xl border border-green-800/50 p-4 text-left relative overflow-hidden transition-all active:scale-[0.98]"
                style="background:linear-gradient(135deg,rgba(22,101,52,0.15),rgba(0,0,0,0.5))">
          <div class="text-[9px] font-black uppercase tracking-widest text-green-600 mb-2 flex items-center gap-1.5">
            <i data-lucide="target" class="w-3 h-3"></i> Missão de Hoje
          </div>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-green-900/30 border border-green-800/40 flex items-center justify-center shrink-0">
              <i data-lucide="check-circle" class="w-5 h-5 text-green-400"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-base font-black text-white leading-tight truncate">${nextWorkout.title}</div>
              <div class="text-[11px] text-green-500 font-bold mt-0.5">Concluído hoje ✓</div>
            </div>
            <span class="text-[10px] text-zinc-600 shrink-0">Ver →</span>
          </div>
        </button>`;
    } else if (nextWorkout) {
      heroHTML = `
        <button data-hub-action="hub-start" data-hub-payload="${nextWorkout.id}"
                class="ripple-target w-full rounded-2xl border p-4 text-left relative overflow-hidden transition-all active:scale-[0.98]"
                style="background:linear-gradient(135deg,var(--theme-dim),rgba(0,0,0,0.6));border-color:color-mix(in srgb,var(--theme-accent) 50%,transparent)">
          <div class="absolute top-0 right-0 w-40 h-40 rounded-full opacity-5 pointer-events-none -mr-10 -mt-10"
               style="background:var(--theme-primary);filter:blur(25px)"></div>
          <div class="relative z-10">
            <div class="text-[9px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5" style="color:var(--theme-primary)">
              <i data-lucide="target" class="w-3 h-3"></i> Missão de Hoje
            </div>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                     style="background:color-mix(in srgb,var(--theme-primary) 15%,transparent);border-color:color-mix(in srgb,var(--theme-accent) 40%,transparent)">
                  <i data-lucide="dumbbell" class="w-5 h-5 pointer-events-none" style="color:var(--theme-primary)"></i>
                </div>
                <div class="min-w-0">
                  <div class="text-base font-black text-white leading-tight truncate">${nextWorkout.title}</div>
                  <div class="text-[11px] text-zinc-500 mt-0.5 truncate">
                    ${nextWorkout.subtitle ? nextWorkout.subtitle + (nextWorkout.exercises?.length ? ' · ' : '') : ''}${nextWorkout.exercises?.length ? `${nextWorkout.exercises.length} exercícios` : ''}
                  </div>
                </div>
              </div>
              <div class="shrink-0 px-4 py-2.5 text-black text-[11px] font-black rounded-xl uppercase tracking-wide pointer-events-none"
                   style="background:var(--theme-primary);box-shadow:0 0 12px color-mix(in srgb,var(--theme-primary) 60%,transparent)">
                Iniciar
              </div>
            </div>
          </div>
        </button>`;
    } else {
      heroHTML = `
        <button data-hub-action="hub-nav" data-hub-payload="treinar"
                class="ripple-target w-full rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-4 text-left transition-all active:scale-[0.98]">
          <div class="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-2 flex items-center gap-1.5">
            <i data-lucide="target" class="w-3 h-3"></i> Missão de Hoje
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <i data-lucide="dumbbell" class="w-5 h-5 text-zinc-600"></i>
              </div>
              <div>
                <div class="text-sm font-black text-zinc-500 leading-tight">Sem ciclo configurado</div>
                <div class="text-[11px] text-zinc-700 mt-0.5">Configure um plano em Treinar</div>
              </div>
            </div>
            <div class="shrink-0 px-4 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-400 text-[11px] font-black rounded-xl uppercase pointer-events-none">
              Planejar
            </div>
          </div>
        </button>`;
    }

    // ── Último Battle Report ─────────────────────────────────────────────
    const battleReportHTML = lastSession ? (() => {
      const volStr = lastSession.vol ? `${(lastSession.vol / 1000).toFixed(1)}t` : '';
      const mvpStr = lastSession.mvp?.name
        ? `${lastSession.mvp.name} ${lastSession.mvp.weight}×${lastSession.mvp.reps}`
        : '';
      return `
        <button data-hub-action="hub-nav" data-hub-payload="evoluir"
                class="ripple-target w-full glass-card rounded-xl border border-zinc-800/60 p-3.5 text-left transition-all active:scale-[0.98]">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
              <i data-lucide="zap" class="w-4 h-4 text-zinc-400"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[9px] text-zinc-600 uppercase tracking-wider font-bold mb-0.5">Último Battle Report</div>
              <div class="text-[13px] font-black text-white leading-tight truncate">${lastSession.title} · <span class="text-zinc-500 font-normal text-[11px]">${lastLabel}</span></div>
              <div class="text-[10px] text-zinc-600 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                ${volStr ? `<span style="color:var(--theme-primary)">${volStr} movidos</span>` : ''}
                ${mvpStr ? `${volStr ? '<span class="text-zinc-700">·</span>' : ''}<span>MVP: ${mvpStr}</span>` : ''}
              </div>
            </div>
            <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-700 shrink-0 pointer-events-none"></i>
          </div>
        </button>`;
    })() : '';

    // ── Full HTML ──────────────────────────────────────────────────────────
    this.#modalLayer.innerHTML = `
      <div id="hub-backdrop" class="fixed inset-0 z-[90] bg-black/95 backdrop-blur-sm flex flex-col animate-zoom-in overflow-hidden">

        <!-- Header -->
        <div class="flex items-center justify-between px-5 pt-5 pb-4 border-b border-zinc-800/60 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center border"
                 style="background:color-mix(in srgb,var(--theme-primary) 15%,transparent);border-color:color-mix(in srgb,var(--theme-accent) 40%,transparent)">
              <i data-lucide="layers" class="w-4 h-4" style="color:var(--theme-primary)"></i>
            </div>
            <div>
              <div class="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Treino Monstro</div>
              <div class="text-base font-black text-white uppercase tracking-wider leading-tight">Central</div>
            </div>
          </div>
          <button id="hub-close"
                  class="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 active:scale-90 transition-all">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Dashboard -->
        <div class="flex-1 overflow-y-auto overscroll-contain no-scrollbar px-4 py-4 space-y-3">

          ${heroHTML}

          <!-- 2×2: Este Mês · Sequência · Corpo · Próxima Conquista -->
          <div class="grid grid-cols-2 gap-2">

            <button data-hub-action="hub-calendar"
                    class="ripple-target glass-card p-3.5 rounded-xl border border-zinc-800/60 text-left active:scale-95 transition-all">
              <div class="text-[9px] text-zinc-600 uppercase tracking-wider font-bold flex items-center gap-1 mb-2">
                <i data-lucide="calendar-days" class="w-2.5 h-2.5"></i> Este Mês
              </div>
              <div class="text-[30px] font-black font-mono text-white leading-none">${monthTrained}</div>
              <div class="text-[10px] text-zinc-500 mt-1">dia${monthTrained !== 1 ? 's' : ''} treinado${monthTrained !== 1 ? 's' : ''}</div>
            </button>

            <button data-hub-action="hub-calendar"
                    class="ripple-target glass-card p-3.5 rounded-xl border ${streak > 2 ? 'border-orange-900/40' : 'border-zinc-800/60'} text-left active:scale-95 transition-all ${streak > 2 ? 'bg-orange-950/20' : ''}">
              <div class="text-[9px] text-zinc-600 uppercase tracking-wider font-bold flex items-center gap-1 mb-2">
                <i data-lucide="flame" class="w-2.5 h-2.5 ${streak > 2 ? 'text-orange-500' : ''}"></i> Sequência
              </div>
              <div class="text-[30px] font-black font-mono ${streak > 0 ? 'text-orange-400' : 'text-zinc-600'} leading-none">${streak}</div>
              <div class="text-[10px] ${streak > 0 ? 'text-orange-500/70' : 'text-zinc-600'} mt-1">
                ${streak > 0 ? `dia${streak !== 1 ? 's' : ''} seguido${streak !== 1 ? 's' : ''}` : 'sem sequência'}
              </div>
            </button>

            <button data-hub-action="hub-nav" data-hub-payload="corpo"
                    class="ripple-target glass-card p-3.5 rounded-xl border border-zinc-800/60 text-left active:scale-95 transition-all">
              <div class="text-[9px] text-zinc-600 uppercase tracking-wider font-bold flex items-center gap-1 mb-2">
                <i data-lucide="heart" class="w-2.5 h-2.5"></i> Corpo
              </div>
              ${currentW ? `
                <div class="text-[24px] font-black font-mono text-white leading-none">
                  ${parseFloat(currentW).toFixed(1)}<span class="text-[11px] font-normal text-zinc-500">kg</span>
                </div>
                <div class="text-[10px] text-zinc-500 mt-1">${biometrics?.bodyFat ? `BF ${biometrics.bodyFat}%` : 'ver evolução →'}</div>
              ` : `
                <div class="text-sm font-bold text-zinc-600 mt-1 leading-tight">Sem dados</div>
                <div class="text-[10px] text-zinc-700 mt-1">registrar peso</div>
              `}
            </button>

            <button data-hub-action="hub-nav" data-hub-payload="corpo"
                    class="ripple-target glass-card p-3.5 rounded-xl border border-zinc-800/60 text-left active:scale-95 transition-all">
              <div class="text-[9px] text-zinc-600 uppercase tracking-wider font-bold flex items-center gap-1 mb-2">
                <i data-lucide="trophy" class="w-2.5 h-2.5"></i> Conquistas
              </div>
              ${nextAch ? `
                <div class="text-[12px] font-bold text-white leading-tight truncate">${nextAch.name}</div>
                <div class="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all" style="width:${nextAch.pct}%;background:var(--theme-primary)"></div>
                </div>
                <div class="text-[9px] text-zinc-600 font-mono mt-1">${nextAch.pct}% concluído</div>
              ` : `
                <div class="text-[24px] font-black font-mono text-white leading-none">${earnedCount}</div>
                <div class="text-[10px] text-green-500 mt-1">todas desbloqueadas!</div>
              `}
            </button>

          </div>

          ${battleReportHTML}

          <!-- Cardio -->
          <button data-hub-action="hub-nav" data-hub-payload="cardio"
                  class="ripple-target w-full glass-card rounded-xl border border-zinc-800/60 p-3.5 text-left transition-all active:scale-[0.98]">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <i data-lucide="wind" class="w-4 h-4 text-zinc-400"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-[9px] text-zinc-600 uppercase tracking-wider font-bold mb-0.5">Cardio</div>
                ${lastCardio ? `
                  <div class="text-[13px] font-black text-white leading-tight">
                    ${lastCardio.type || 'Cardio'} · <span class="text-zinc-500 font-normal text-[11px]">${lastCardioLbl}</span>
                  </div>
                  <div class="text-[10px] text-zinc-600 font-mono mt-0.5 flex items-center gap-2">
                    ${lastCardio.distance ? `<span style="color:var(--theme-primary)">${lastCardio.distance}km</span>` : ''}
                    ${lastCardio.pace ? `<span class="text-zinc-600">${lastCardio.pace}/km</span>` : ''}
                    ${lastCardio.effort ? `<span class="capitalize text-zinc-700">${lastCardio.effort}</span>` : ''}
                  </div>
                ` : `
                  <div class="text-sm font-bold text-zinc-600 leading-tight">Nenhuma sessão</div>
                  <div class="text-[10px] text-zinc-700 mt-0.5">iniciar corrida →</div>
                `}
              </div>
              <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-700 shrink-0 pointer-events-none"></i>
            </div>
          </button>

          <!-- Linha secundária: PRs · Ciclo · Sistema -->
          <div class="grid grid-cols-3 gap-2">

            <button data-hub-action="hub-nav" data-hub-payload="evoluir"
                    class="ripple-target glass-card p-3 rounded-xl border border-zinc-800/60 text-left active:scale-95 transition-all">
              <i data-lucide="bar-chart-2" class="w-3.5 h-3.5 text-zinc-500 mb-2"></i>
              <div class="text-base font-black font-mono text-white leading-none">
                ${prsThisWeek > 0 ? prsThisWeek : prCount}
              </div>
              <div class="text-[9px] text-zinc-600 mt-1 leading-tight">
                ${prsThisWeek > 0 ? `PR${prsThisWeek !== 1 ? 's' : ''} essa sem.` : `PR${prCount !== 1 ? 's' : ''} total`}
              </div>
            </button>

            <button data-hub-action="hub-nav" data-hub-payload="treinar"
                    class="ripple-target glass-card p-3 rounded-xl border border-zinc-800/60 text-left active:scale-95 transition-all">
              <i data-lucide="repeat" class="w-3.5 h-3.5 text-zinc-500 mb-2"></i>
              <div class="text-base font-black font-mono text-white leading-none">
                ${cycleDone.length}<span class="text-zinc-600 text-xs font-normal">/${cycleGoal}</span>
              </div>
              <div class="text-[9px] text-zinc-600 mt-1 leading-tight">ciclo atual</div>
            </button>

            <button data-hub-action="hub-nav" data-hub-payload="settings"
                    class="ripple-target glass-card p-3 rounded-xl border border-zinc-800/60 text-left active:scale-95 transition-all">
              <i data-lucide="settings" class="w-3.5 h-3.5 text-zinc-500 mb-2"></i>
              <div class="text-[11px] font-bold text-zinc-400 leading-tight">Config.</div>
              <div class="text-[9px] text-zinc-700 mt-1 leading-tight truncate">${themeName}</div>
            </button>

          </div>

        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    document.getElementById('hub-close')?.addEventListener('click', () => this.#closeModal());
    document.getElementById('hub-backdrop')?.addEventListener('click', e => {
      if (e.target.id === 'hub-backdrop') this.#closeModal();
    });

    this.#modalLayer.querySelectorAll('[data-hub-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const hubAction  = btn.dataset.hubAction;
        const hubPayload = btn.dataset.hubPayload;
        if (hubAction === 'hub-nav') {
          this.#closeModal();
          this.#navigate(hubPayload);
        } else if (hubAction === 'hub-start') {
          this.#closeModal();
          this.#workoutCtrl.startWorkout(hubPayload);
        } else if (hubAction === 'hub-calendar') {
          this.#closeModal();
          setTimeout(() => this.#store.setState({ activeModal: 'calendar', modalData: null }), 50);
        }
      });
    });
  }

  #showCalendarModal() {
    const { history = [], cardioHistory = [] } = this.#store.getState();
    const monthNamesLong = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    const trainedSet = new Set();
    history.forEach(h => trainedSet.add(h.date.slice(0, 10)));
    cardioHistory.forEach(c => trainedSet.add(c.date.slice(0, 10)));

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    let curYear  = todayMidnight.getFullYear();
    let curMonth = todayMidnight.getMonth();

    const renderGrid = (y, m) => {
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const startDow    = (new Date(y, m, 1).getDay() + 6) % 7; // Mon=0 … Sun=6

      const days = [];
      for (let i = 0; i < startDow; i++) days.push(null);
      for (let d = 1; d <= daysInMonth; d++) days.push(d);
      while (days.length % 7 !== 0) days.push(null);

      let monthTotal = 0;
      let rowsHtml   = '';

      for (let row = 0; row < days.length / 7; row++) {
        const week     = days.slice(row * 7, row * 7 + 7);
        let weekCount  = 0;

        const cells = week.map(d => {
          if (d === null) return '<div class="h-8 w-8"></div>';
          const ds      = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const trained = trainedSet.has(ds);
          const dayDate = new Date(y, m, d);
          const isToday = dayDate.getTime() === todayMidnight.getTime();
          const isFuture = dayDate > todayMidnight;

          if (trained) { weekCount++; monthTotal++; }

          let cls = 'h-8 w-8 mx-auto rounded-full flex items-center justify-center text-[11px] font-bold ';
          if (trained && isToday) {
            cls += 'bg-theme-primary text-black ring-2 ring-white/40';
          } else if (trained) {
            cls += 'bg-theme-primary text-black';
          } else if (isToday) {
            cls += 'border border-theme-accent text-theme-primary';
          } else if (isFuture) {
            cls += 'text-zinc-700';
          } else {
            cls += 'text-zinc-500';
          }
          return `<div class="${cls}">${d}</div>`;
        }).join('');

        const freqBadge = weekCount > 0
          ? `<div class="text-[9px] font-mono font-bold text-theme-primary leading-none">${weekCount}x</div>`
          : `<div class="w-4 h-4"></div>`;

        rowsHtml += `
          <div class="grid grid-cols-8 items-center gap-0.5 py-0.5">
            ${cells}
            <div class="flex items-center justify-center">${freqBadge}</div>
          </div>`;
      }

      return { html: rowsHtml, monthTotal };
    };

    const { html: initialGrid, monthTotal: initialTotal } = renderGrid(curYear, curMonth);

    this.#modalLayer.innerHTML = `
      <div id="cal-backdrop" class="fixed inset-0 z-[90] flex items-end justify-center bg-black/85 backdrop-blur-sm animate-zoom-in">
        <div class="glass-card w-full max-w-lg rounded-t-3xl border-t border-x border-zinc-700 shadow-[0_-20px_60px_rgba(0,0,0,0.8)]">
          <div class="flex justify-center pt-3 pb-1">
            <div class="w-10 h-1 rounded-full bg-zinc-600"></div>
          </div>
          <div class="flex items-center justify-between px-5 py-3">
            <button id="cal-prev" class="w-9 h-9 rounded-full bg-zinc-800/80 flex items-center justify-center active:scale-90 transition-transform">
              <i data-lucide="chevron-left" class="w-4 h-4 text-zinc-400"></i>
            </button>
            <div class="text-center">
              <div class="text-base font-black text-white uppercase tracking-wider" id="cal-month-label">
                ${monthNamesLong[curMonth]} ${curYear}
              </div>
              <div class="text-[11px] font-mono" id="cal-month-total"
                   style="color:var(--theme-primary)">
                ${initialTotal} dia${initialTotal !== 1 ? 's' : ''} treinado${initialTotal !== 1 ? 's' : ''}
              </div>
            </div>
            <button id="cal-next" class="w-9 h-9 rounded-full bg-zinc-800/80 flex items-center justify-center active:scale-90 transition-transform">
              <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-400"></i>
            </button>
          </div>
          <div class="grid grid-cols-8 gap-0.5 px-4 mb-1">
            ${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d =>
              `<div class="h-6 flex items-center justify-center text-[9px] font-bold text-zinc-600 uppercase">${d}</div>`
            ).join('')}
            <div class="h-6 flex items-center justify-center text-[9px] font-bold text-zinc-700">Freq</div>
          </div>
          <div id="cal-grid" class="px-4">
            ${initialGrid}
          </div>
          <div class="px-5 py-4 flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-1.5">
                <div class="w-3 h-3 rounded-full" style="background:var(--theme-primary)"></div>
                <span class="text-[10px] text-zinc-500">Treino</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-3 h-3 rounded-full border" style="border-color:var(--theme-accent)"></div>
                <span class="text-[10px] text-zinc-500">Hoje</span>
              </div>
            </div>
            <button id="cal-close"
                    class="ripple-target px-4 py-2 bg-zinc-800 rounded-xl text-xs font-bold text-zinc-400 active:scale-95 transition-all">
              Fechar
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    const updateGrid = () => {
      const { html, monthTotal } = renderGrid(curYear, curMonth);
      document.getElementById('cal-grid').innerHTML = html;
      document.getElementById('cal-month-label').textContent =
        `${monthNamesLong[curMonth]} ${curYear}`;
      const tot = document.getElementById('cal-month-total');
      tot.textContent = `${monthTotal} dia${monthTotal !== 1 ? 's' : ''} treinado${monthTotal !== 1 ? 's' : ''}`;
    };

    document.getElementById('cal-prev')?.addEventListener('click', () => {
      curMonth--;
      if (curMonth < 0) { curMonth = 11; curYear--; }
      updateGrid();
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
      curMonth++;
      if (curMonth > 11) { curMonth = 0; curYear++; }
      updateGrid();
    });
    document.getElementById('cal-close')?.addEventListener('click', () => this.#closeModal());
    document.getElementById('cal-backdrop')?.addEventListener('click', e => {
      if (e.target.id === 'cal-backdrop') this.#closeModal();
    });
  }

  #showRunTrackerModal() {
    // ── Haversine distance (meters) ──────────────────────────────────
    const haversine = (lat1, lon1, lat2, lon2) => {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    const fmtTime = secs => {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      return h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };

    const fmtPace = (distM, secs) => {
      if (distM < 10 || secs < 1) return '--:--';
      const minPerKm = (secs / 60) / (distM / 1000);
      const m = Math.floor(minPerKm);
      const s = Math.round((minPerKm - m) * 60);
      return `${m}:${String(s).padStart(2,'0')}`;
    };

    // ── Render modal ─────────────────────────────────────────────────
    this.#modalLayer.innerHTML = `
      <div class="fixed inset-0 z-[80] flex flex-col bg-black/95 backdrop-blur-sm animate-zoom-in">
        <div class="flex items-center justify-between px-5 pt-5 pb-3">
          <div class="flex items-center gap-2">
            <i data-lucide="crosshair" class="w-5 h-5 text-theme-primary"></i>
            <span class="text-sm font-black uppercase text-white tracking-widest">Rastreio GPS</span>
          </div>
          <button id="close-run-modal" class="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 active:scale-90 transition-all">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- GPS status -->
        <div id="gps-status" class="mx-5 mb-3 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-500 flex items-center gap-2">
          <div id="gps-dot" class="w-2 h-2 rounded-full bg-zinc-700"></div>
          <span id="gps-text">Aguardando GPS...</span>
        </div>

        <!-- Main metrics -->
        <div class="flex-1 flex flex-col items-center justify-center px-5 gap-6">
          <div class="text-center">
            <div id="run-timer" class="text-7xl font-black font-mono text-white tracking-tighter leading-none">00:00</div>
            <div class="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Tempo</div>
          </div>
          <div class="text-center">
            <div id="run-dist" class="text-5xl font-black font-mono text-theme-primary leading-none">0.00</div>
            <div class="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">km</div>
          </div>
          <div class="grid grid-cols-2 gap-6 text-center">
            <div>
              <div id="run-pace-now" class="text-2xl font-black font-mono text-white leading-none">--:--</div>
              <div class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider mt-1">Ritmo atual</div>
            </div>
            <div>
              <div id="run-pace-avg" class="text-2xl font-black font-mono text-zinc-400 leading-none">--:--</div>
              <div class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider mt-1">Ritmo médio</div>
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div id="run-controls" class="px-5 pb-8 space-y-3">
          <button id="run-start-btn"
                  class="w-full py-4 bg-theme-primary text-black font-black text-base uppercase rounded-2xl
                         shadow-[0_0_20px_var(--theme-primary)] active:scale-95 transition-all tracking-widest">
            <i data-lucide="zap" class="w-5 h-5 inline -mt-0.5 mr-2"></i> Iniciar
          </button>
        </div>

        <!-- Save panel (hidden until stopped) -->
        <div id="run-save-panel" class="hidden px-5 pb-8 space-y-3 border-t border-zinc-800 pt-4">
          <div class="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Salvar Corrida</div>
          <div>
            <div class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Local</div>
            <div class="grid grid-cols-2 gap-2">
              <button data-save-local="rua"
                      class="save-local-btn flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all active:scale-95 bg-theme-dim border-theme-accent text-theme-primary">
                <i data-lucide="wind" class="w-4 h-4 pointer-events-none"></i>
                <span class="text-xs font-black pointer-events-none">Rua</span>
              </button>
              <button data-save-local="esteira"
                      class="save-local-btn flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all active:scale-95 bg-zinc-900 border-zinc-800 text-zinc-500">
                <i data-lucide="repeat" class="w-4 h-4 pointer-events-none"></i>
                <span class="text-xs font-black pointer-events-none">Esteira</span>
              </button>
            </div>
          </div>
          <div>
            <div class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Esforço</div>
            <div class="grid grid-cols-3 gap-2">
              <button data-save-effort="fácil"  class="save-effort-btn py-2.5 rounded-xl border text-xs font-black transition-all active:scale-95 bg-zinc-900 border-zinc-800 text-zinc-500">Fácil</button>
              <button data-save-effort="moderado" class="save-effort-btn py-2.5 rounded-xl border text-xs font-black transition-all active:scale-95 text-amber-400 bg-amber-900/20 border-amber-900/40">Moderado</button>
              <button data-save-effort="forte"  class="save-effort-btn py-2.5 rounded-xl border text-xs font-black transition-all active:scale-95 bg-zinc-900 border-zinc-800 text-zinc-500">Forte</button>
            </div>
          </div>
          <input type="text" id="run-notes" placeholder="Notas (opcional)..."
                 class="input-ninja w-full py-2.5 rounded-lg text-xs font-mono" />
          <button id="run-save-btn"
                  class="w-full py-3.5 bg-theme-primary text-black font-black text-sm uppercase rounded-xl shadow-[0_0_15px_var(--theme-primary)] active:scale-95 transition-all">
            <i data-lucide="check" class="w-4 h-4 inline -mt-0.5 mr-1"></i> Salvar Corrida
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    const ml = this.#modalLayer;
    let watchId     = null;
    let wakeLock    = null;
    let timerHandle = null;

    let running     = false;
    let paused      = false;
    let startTime   = null;
    let elapsed     = 0;
    let distMeters  = 0;
    let lastPos     = null;
    let recentPaces = []; // last 5 pace samples for smoothed current pace
    let saveLocal   = 'rua';
    let saveEffort  = 'moderado';

    const $ = id => ml.querySelector(id);

    // ── GPS watch ────────────────────────────────────────────────────
    const startGPS = () => {
      if (!navigator.geolocation) {
        $('#gps-text').textContent = 'GPS não disponível neste dispositivo';
        return;
      }
      watchId = navigator.geolocation.watchPosition(pos => {
        const acc = pos.coords.accuracy;
        $('#gps-dot').style.background = acc <= 15 ? '#4ade80' : acc <= 40 ? '#fbbf24' : '#ef4444';
        $('#gps-text').textContent = `GPS · ±${Math.round(acc)}m`;

        if (!running || paused) { lastPos = pos; return; }
        if (acc > 60) return; // filtra leituras ruins

        if (lastPos) {
          const d = haversine(
            lastPos.coords.latitude, lastPos.coords.longitude,
            pos.coords.latitude,    pos.coords.longitude,
          );
          const dt = (pos.timestamp - lastPos.timestamp) / 1000;
          if (d > 0 && dt > 0 && d / dt < 20) { // ignora speed > 72km/h (glitch)
            distMeters += d;
            const instantPace = (dt / 60) / (d / 1000); // min/km
            if (instantPace > 1 && instantPace < 20) {
              recentPaces.push(instantPace);
              if (recentPaces.length > 5) recentPaces.shift();
            }
          }
        }
        lastPos = pos;
        updateDisplay();
      }, err => {
        $('#gps-text').textContent = err.code === 1 ? 'GPS bloqueado — ative a localização' : 'Erro ao obter GPS';
        $('#gps-dot').style.background = '#ef4444';
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    };

    // ── Timer tick ───────────────────────────────────────────────────
    const tick = () => {
      elapsed = Math.round((Date.now() - startTime) / 1000);
      updateDisplay();
    };

    const updateDisplay = () => {
      const km = distMeters / 1000;
      $('#run-timer').textContent = fmtTime(elapsed);
      $('#run-dist').textContent  = km.toFixed(2);
      $('#run-pace-avg').textContent = fmtPace(distMeters, elapsed);
      const smoothPace = recentPaces.length
        ? recentPaces.reduce((a, b) => a + b, 0) / recentPaces.length
        : null;
      $('#run-pace-now').textContent = smoothPace
        ? `${Math.floor(smoothPace)}:${String(Math.round((smoothPace % 1) * 60)).padStart(2,'0')}`
        : '--:--';
    };

    // ── Wake lock ────────────────────────────────────────────────────
    const requestWakeLock = async () => {
      try { wakeLock = await navigator.wakeLock?.request('screen'); } catch (_) {}
    };
    const releaseWakeLock = () => { wakeLock?.release(); wakeLock = null; };

    // ── Button sync ──────────────────────────────────────────────────
    const EFFORT_COLORS = {
      'fácil':    'text-green-400 bg-green-900/20 border-green-900/40',
      'moderado': 'text-amber-400 bg-amber-900/20 border-amber-900/40',
      'forte':    'text-rose-400  bg-rose-900/20  border-rose-900/40',
    };
    const syncSaveLocal = () => {
      ml.querySelectorAll('.save-local-btn').forEach(b => {
        const on = b.dataset.saveLocal === saveLocal;
        b.className = `save-local-btn flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all active:scale-95 ${on ? 'bg-theme-dim border-theme-accent text-theme-primary' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`;
      });
    };
    const syncSaveEffort = () => {
      ml.querySelectorAll('.save-effort-btn').forEach(b => {
        const on = b.dataset.saveEffort === saveEffort;
        b.className = `save-effort-btn py-2.5 rounded-xl border text-xs font-black transition-all active:scale-95 ${on ? EFFORT_COLORS[b.dataset.saveEffort] : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`;
      });
    };

    ml.querySelectorAll('.save-local-btn').forEach(b => b.addEventListener('click', () => { saveLocal = b.dataset.saveLocal; syncSaveLocal(); }));
    ml.querySelectorAll('.save-effort-btn').forEach(b => b.addEventListener('click', () => { saveEffort = b.dataset.saveEffort; syncSaveEffort(); }));

    // ── Start ────────────────────────────────────────────────────────
    $('#run-start-btn')?.addEventListener('click', () => {
      running = true; paused = false;
      startTime = Date.now() - elapsed * 1000;
      requestWakeLock();
      timerHandle = setInterval(tick, 1000);
      $('#run-controls').innerHTML = `
        <div class="grid grid-cols-2 gap-3">
          <button id="run-pause-btn"
                  class="py-3.5 bg-zinc-800 border border-zinc-700 text-white font-black text-sm uppercase rounded-2xl active:scale-95 transition-all">
            <i data-lucide="pause" class="w-5 h-5 inline -mt-0.5 mr-1"></i> Pausar
          </button>
          <button id="run-stop-btn"
                  class="py-3.5 bg-red-900/40 border border-red-800/60 text-red-400 font-black text-sm uppercase rounded-2xl active:scale-95 transition-all">
            <i data-lucide="square" class="w-5 h-5 inline -mt-0.5 mr-1"></i> Encerrar
          </button>
        </div>`;
      if (window.lucide) lucide.createIcons({ nodes: [$('#run-controls')] });

      $('#run-pause-btn')?.addEventListener('click', () => {
        if (!paused) {
          paused = true; clearInterval(timerHandle);
          releaseWakeLock();
          $('#run-pause-btn').innerHTML = '<i data-lucide="zap" class="w-5 h-5 inline -mt-0.5 mr-1 pointer-events-none"></i> Retomar';
          if (window.lucide) lucide.createIcons({ nodes: [$('#run-pause-btn')] });
        } else {
          paused = false;
          startTime = Date.now() - elapsed * 1000;
          timerHandle = setInterval(tick, 1000);
          requestWakeLock();
          $('#run-pause-btn').innerHTML = '<i data-lucide="pause" class="w-5 h-5 inline -mt-0.5 mr-1 pointer-events-none"></i> Pausar';
          if (window.lucide) lucide.createIcons({ nodes: [$('#run-pause-btn')] });
        }
      });

      $('#run-stop-btn')?.addEventListener('click', () => {
        running = false; paused = false;
        clearInterval(timerHandle);
        releaseWakeLock();
        if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
        $('#run-controls').classList.add('hidden');
        $('#run-save-panel').classList.remove('hidden');
      });
    });

    // ── Save ─────────────────────────────────────────────────────────
    $('#run-save-btn')?.addEventListener('click', () => {
      const km       = Math.round(distMeters / 10) / 100; // 2 decimal km
      const durMin   = Math.round((elapsed / 60) * 100) / 100; // decimal minutes
      const pace     = distMeters > 50 ? (() => {
        const p = (elapsed / 60) / (distMeters / 1000);
        const m = Math.floor(p); const s = Math.round((p-m)*60);
        return `${m}:${String(s).padStart(2,'0')}`;
      })() : null;
      const notes = $('#run-notes')?.value?.trim() || null;
      const entry = {
        date:     new Date().toISOString(),
        type:     'corrida',
        local:    saveLocal,
        distance: km > 0 ? km : null,
        duration: durMin > 0 ? durMin : null,
        pace,
        effort:   saveEffort,
        notes,
      };
      this.#store.setState(s => ({
        cardioHistory: [entry, ...(s.cardioHistory ?? [])].slice(0, 100),
      }));
      this.#closeModal();
    });

    // ── Close ─────────────────────────────────────────────────────────
    $('#close-run-modal')?.addEventListener('click', () => {
      clearInterval(timerHandle);
      releaseWakeLock();
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
      this.#closeModal();
    });

    startGPS();
  }

  static #HINTS = {
    streak: {
      title: 'Sequência de Treinos',
      icon: 'zap',
      body: 'Conta dias consecutivos com pelo menos um treino ou cardio (se "Cardio conta para streak" estiver ativo). O streak quebra se você passar um dia inteiro sem atividade. Treinar mais de uma vez no mesmo dia conta como um único dia.',
    },
    cycles: {
      title: 'Ciclo de Treino',
      icon: 'repeat',
      body: 'Um ciclo é completado quando você atinge a meta de sessões configurada (padrão: 6). Diferente de semanas, o ciclo não tem data de início — ele avança conforme você treina. O ciclo se reinicia automaticamente após inatividade configurada, ou manualmente.',
    },
    cardio_zones: {
      title: 'Zonas de Cardio',
      icon: 'activity',
      body: 'Zona 2 (moderado, 60–70% FCmáx): queima gordura e desenvolve base aeróbica. Ideal para a maioria das sessões. VO2Max (intenso, 90–95% FCmáx): aumenta capacidade cardiovascular máxima. Requer recuperação de 48h. Livre: sem estrutura automática, você controla o ritmo.',
    },
    recovery: {
      title: 'Recuperação Muscular',
      icon: 'clock',
      body: 'Músculos grandes (pernas, costas, peito) precisam de 48–72h para se recuperar. Músculos menores (bíceps, tríceps, ombros) recuperam em 24–48h. Treinar antes do prazo reduz a síntese proteica e aumenta risco de lesão. O app sinaliza grupos musculares negligenciados no Motor de Insights.',
    },
    volume: {
      title: 'Volume de Treino',
      icon: 'bar-chart-2',
      body: 'Volume = peso × repetições × séries. É o principal indicador de progressão a longo prazo. O app compara o volume do treino atual com a sessão anterior e exibe ▲/▼. Aumentar 5–10% por semana é considerado seguro. Volume excessivo sem recuperação leva a platô ou lesão.',
    },
    progressive_overload: {
      title: 'Sobrecarga Progressiva',
      icon: 'trending-up',
      body: 'Princípio fundamental: para continuar progredindo, você precisa aumentar gradualmente o estímulo. Isso pode ser feito com mais peso, mais repetições, mais séries, menos descanso ou melhora na técnica. O app acompanha seus PRs com fórmula Epley (1RM estimado) para comparar cargas entre faixas de repetições diferentes.',
    },
  };

  #showHintModal(key) {
    const hint = AppController.#HINTS[key];
    if (!hint) return;
    this.#modalLayer.innerHTML = `
      <div class="fixed inset-0 z-[90] flex items-end justify-center p-4" style="background:rgba(0,0,0,0.7)">
        <div class="glass-card w-full max-w-md rounded-3xl p-6 animate-zoom-in">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-9 h-9 rounded-full bg-theme-dim border border-theme-accent flex items-center justify-center shrink-0">
              <i data-lucide="${hint.icon}" class="w-4 h-4 text-theme-primary"></i>
            </div>
            <h3 class="text-white font-black text-base">${hint.title}</h3>
          </div>
          <p class="text-sm text-zinc-400 leading-relaxed">${hint.body}</p>
          <button id="hint-close" class="mt-5 w-full py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 text-sm font-bold active:scale-95 transition-transform">Entendi</button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });
    this.#modalLayer.querySelector('#hint-close')?.addEventListener('click', () => this.#closeModal());
    this.#modalLayer.addEventListener('click', (e) => { if (e.target === this.#modalLayer.firstElementChild) this.#closeModal(); }, { once: true });
  }

  #showPlateCalcModal() {
    const PLATES = [20, 15, 10, 5, 2.5, 1.25];
    const PLATE_CLS = {
      20: 'bg-yellow-400 text-black', 15: 'bg-red-500 text-white',
      10: 'bg-green-500 text-black',   5: 'bg-zinc-100 text-black',
      2.5: 'bg-blue-500 text-white', 1.25: 'bg-zinc-600 text-white',
    };

    const calcPlates = (total, bar) => {
      let rem = Math.max(0, (total - bar) / 2);
      return PLATES.reduce((acc, p) => {
        const n = Math.floor(rem / p + 0.0001);
        if (n > 0) { acc.push({ p, n }); rem -= n * p; }
        return acc;
      }, []);
    };

    const resultHTML = (plates, perSide) => {
      if (!plates.length) return `<p class="text-xs text-zinc-600 font-mono text-center py-2">Sem anilhas — só a barra</p>`;
      const chips = plates.flatMap(({ p, n }) =>
        Array.from({ length: n }, () => `
          <div class="flex flex-col items-center gap-0.5">
            <div class="${PLATE_CLS[p] || 'bg-zinc-700 text-white'} text-[9px] font-black rounded px-2 py-1.5 min-w-[2.1rem] text-center leading-none">${p}</div>
            <div class="text-[7px] text-zinc-600">kg</div>
          </div>`)
      ).join('');
      const sum = plates.map(({ p, n }) => `${n}×${p}`).join(' + ');
      return `
        <div class="flex flex-wrap gap-2 justify-center">${chips}</div>
        <div class="text-[10px] font-mono text-zinc-600 text-center mt-3 pt-3 border-t border-zinc-800/60">
          ${sum} = ${perSide.toFixed(2).replace(/\.?0+$/, '')} kg / lado
        </div>`;
    };

    let weight = 100;
    let bar    = 20;

    this.#modalLayer.innerHTML = `
      <div id="plate-backdrop" class="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-zoom-in">
        <div class="glass-card w-full max-w-md rounded-t-3xl border-t border-x border-zinc-800">
          <div class="flex justify-center pt-3 pb-2"><div class="w-10 h-1 rounded-full bg-zinc-600"></div></div>
          <div class="flex items-center justify-between px-5 pb-3">
            <div class="flex items-center gap-2">
              <i data-lucide="ruler" class="w-4 h-4 text-theme-primary"></i>
              <span class="text-sm font-black uppercase text-white tracking-widest">Anilhas</span>
            </div>
            <button id="plate-close" class="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 active:scale-90 transition-all">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
          <div class="px-5 pb-6">
            <div class="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Peso Total na Barra</div>
            <div class="flex items-center gap-3 mb-3">
              <button id="plate-minus" class="w-11 h-11 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 text-xl font-black active:scale-90 transition-all touch-manipulation">−</button>
              <div class="flex-1 relative">
                <input id="plate-weight-input" type="number" value="100" min="0" step="2.5"
                       class="input-ninja w-full text-center text-xl font-black py-2.5 pr-8" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-bold pointer-events-none">kg</span>
              </div>
              <button id="plate-plus" class="w-11 h-11 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 text-xl font-black active:scale-90 transition-all touch-manipulation">+</button>
            </div>
            <div class="flex items-center gap-1.5 mb-4">
              <span class="text-[9px] text-zinc-600 uppercase tracking-wider shrink-0 mr-0.5">Barra:</span>
              ${[5, 10, 15, 20].map(b => `
                <button data-bar="${b}"
                        class="bar-btn flex-1 py-1.5 text-[11px] font-black rounded-lg border transition-all active:scale-90
                               ${b === 20 ? 'border-theme-accent bg-theme-dim text-theme-primary' : 'border-zinc-800 bg-zinc-900 text-zinc-500'}">
                  ${b}kg
                </button>`).join('')}
            </div>
            <div id="plate-result" class="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 min-h-[80px]"></div>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    const ml = this.#modalLayer;
    const updateResult = () => {
      const perSide = Math.max(0, (weight - bar) / 2);
      ml.querySelector('#plate-result').innerHTML = resultHTML(calcPlates(weight, bar), perSide);
      const inp = ml.querySelector('#plate-weight-input');
      if (inp && document.activeElement !== inp) inp.value = weight;
    };
    updateResult();

    ml.querySelector('#plate-close')?.addEventListener('click', () => { ml.innerHTML = ''; });
    ml.querySelector('#plate-backdrop')?.addEventListener('click', e => { if (e.target.id === 'plate-backdrop') ml.innerHTML = ''; });
    ml.querySelector('#plate-minus')?.addEventListener('click', () => { weight = Math.max(bar, weight - 2.5); updateResult(); });
    ml.querySelector('#plate-plus')?.addEventListener('click', () => { weight += 2.5; updateResult(); });
    ml.querySelector('#plate-weight-input')?.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v) && v >= 0) { weight = v; updateResult(); }
    });
    ml.querySelectorAll('.bar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        bar = parseFloat(btn.dataset.bar);
        if (weight < bar) weight = bar;
        ml.querySelectorAll('.bar-btn').forEach(b => {
          const active = parseFloat(b.dataset.bar) === bar;
          b.className = `bar-btn flex-1 py-1.5 text-[11px] font-black rounded-lg border transition-all active:scale-90 ${
            active ? 'border-theme-accent bg-theme-dim text-theme-primary' : 'border-zinc-800 bg-zinc-900 text-zinc-500'
          }`;
        });
        updateResult();
      });
    });
  }

  #showWarmupModal({ exId, wId, weight, reps } = {}) {
    if (!weight) return;
    const state       = this.#store.getState();
    const allWorkouts = this.#allWorkouts();
    const workout     = allWorkouts.find(w => w.id === wId);
    const ex          = workout?.exercises?.find(e => e.id === exId);
    const exName      = ex?.name ?? 'Exercício';
    const inc         = 2.5;
    const round       = v => Math.max(inc, Math.round(v / inc) * inc);

    const plan = [
      { pct: 40, reps: 15, label: 'Ativação',   color: 'text-green-400',  bg: 'bg-green-900/20 border-green-900/40'   },
      { pct: 60, reps: 10, label: 'Primer',      color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-900/40' },
      { pct: 75, reps: 6,  label: 'Aproximação', color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-900/40' },
      { pct: 85, reps: 3,  label: 'Contraste',   color: 'text-red-400',    bg: 'bg-red-900/20 border-red-900/40'       },
    ].map(s => ({ ...s, w: round(weight * s.pct / 100) }));

    const rows = plan.map(s => `
      <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl border ${s.bg}">
        <div class="w-24 shrink-0">
          <div class="text-[8px] font-black uppercase tracking-wider text-zinc-500">${s.label}</div>
          <div class="text-[9px] text-zinc-700">${s.pct}% da carga</div>
        </div>
        <div class="flex-1 text-center">
          <span class="text-lg font-black font-mono ${s.color}">${s.w}<span class="text-xs text-zinc-600 ml-0.5">kg</span></span>
        </div>
        <div class="text-center w-10 shrink-0">
          <div class="text-sm font-black font-mono text-white">${s.reps}</div>
          <div class="text-[8px] text-zinc-600">reps</div>
        </div>
      </div>`).join('');

    this.#modalLayer.classList.remove('hidden');
    setHTML(this.#modalLayer, `
      <div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center p-4 z-50" id="warmup-bd">
        <div class="glass-card w-full max-w-sm rounded-2xl p-5 animate-zoom-in">
          <div class="flex items-start justify-between mb-4">
            <div class="min-w-0 flex-1">
              <div class="text-[9px] font-black uppercase tracking-widest text-orange-500 mb-0.5 flex items-center gap-1">
                <i data-lucide="flame" class="w-3 h-3"></i> AQUECIMENTO INTELIGENTE
              </div>
              <h3 class="text-base font-black text-white truncate">${exName}</h3>
              <div class="text-xs text-zinc-500 mt-0.5">
                Alvo: <span class="font-mono font-bold text-theme-primary">${weight}kg</span>${reps ? ` · ${reps} reps` : ''}
              </div>
            </div>
            <button id="warmup-close" class="ml-3 shrink-0 w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 flex items-center justify-center active:scale-90 transition-all">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
          <div class="space-y-2 mb-4">${rows}</div>
          <p class="text-[9px] text-zinc-600 text-center">Pesos arredondados para múltiplos de ${inc}kg · pule séries já aquecidas</p>
        </div>
      </div>`);
    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });
    this.#modalLayer.querySelector('#warmup-close')?.addEventListener('click', () => this.#closeModal());
    this.#modalLayer.querySelector('#warmup-bd')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) this.#closeModal();
    });
  }

  #showDeloadModal(cycleCount) {
    this.#modalLayer.classList.remove('hidden');
    setHTML(this.#modalLayer, `
      <div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center p-4 z-50" id="deload-bd">
        <div class="glass-card w-full max-w-sm rounded-2xl p-5 animate-zoom-in">
          <div class="text-center mb-5">
            <div class="text-4xl mb-2">🏆</div>
            <div class="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1">${cycleCount} CICLOS COMPLETOS</div>
            <h3 class="text-xl font-black text-white">Semana de Deload</h3>
            <p class="text-xs text-zinc-400 mt-2 leading-relaxed">
              Você completou ${cycleCount} ciclos seguidos. O músculo cresce na recuperação, não no esforço.<br>
              Essa semana: <strong class="text-white">reduza o volume em ~40%</strong>.
            </p>
          </div>
          <div class="space-y-2 mb-5">
            <div class="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <i data-lucide="trending-up" class="w-4 h-4 text-green-400 shrink-0"></i>
              <div>
                <div class="text-[10px] font-bold text-white">Mesma carga, menos séries</div>
                <div class="text-[9px] text-zinc-500">3 séries → 2 séries por exercício</div>
              </div>
            </div>
            <div class="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <i data-lucide="activity" class="w-4 h-4 text-blue-400 shrink-0"></i>
              <div>
                <div class="text-[10px] font-bold text-white">Menos intensidade</div>
                <div class="text-[9px] text-zinc-500">Trabalhe em 70-75% do esforço máximo</div>
              </div>
            </div>
            <div class="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <i data-lucide="heart" class="w-4 h-4 text-rose-400 shrink-0"></i>
              <div>
                <div class="text-[10px] font-bold text-white">Priorize recuperação</div>
                <div class="text-[9px] text-zinc-500">Sono, hidratação e mobilidade em foco</div>
              </div>
            </div>
          </div>
          <button id="deload-ok" class="btn-akatsuki w-full py-3 rounded-xl font-black text-sm active:scale-95 transition-all">
            ENTENDIDO — VAMOS RECUPERAR
          </button>
        </div>
      </div>`);
    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });
    this.#modalLayer.querySelector('#deload-ok')?.addEventListener('click', () => this.#closeModal());
    this.#modalLayer.querySelector('#deload-bd')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) this.#closeModal();
    });
  }

  #showExerciseDetailModal(data = {}) {
    const { exId, exName } = data;
    if (!exId) return;
    const mediaUrl = getExerciseMedia(exName);
    const state = this.#store.getState();
    const pr    = (state.prs ?? {})[exId];

    // ── Dados completos (sem limite) ────────────────────────────────────
    const allDesc   = (state.history ?? []).filter(h => h.sets?.[exId]?.some(s => s?.done && !s?.warmup));
    const chrono    = [...allDesc].reverse(); // oldest → newest
    const recentTop = allDesc.slice(0, 10);   // últimas 10 para listar
    const n         = chrono.length;

    // helpers
    const exMaxW = h => {
      const ws = (h.sets[exId] ?? []).filter(s => s?.done && !s?.warmup && s?.w).map(s => parseFloat(s.w) || 0);
      return ws.length ? Math.max(...ws) : 0;
    };
    const exBest1RM = h => {
      const pts = (h.sets[exId] ?? []).filter(s => s?.done && !s?.warmup && s?.w && s?.r)
                                       .map(s => parseFloat(s.w) * (1 + parseFloat(s.r) / 30));
      return pts.length ? Math.max(...pts) : 0;
    };
    const exVol = h =>
      (h.sets[exId] ?? []).filter(s => s?.done && !s?.warmup && s?.w && s?.r)
                           .reduce((acc, s) => acc + parseFloat(s.w) * parseFloat(s.r), 0);

    // ── Séries de dados (cronológico) ────────────────────────────────────
    const weightSeries = chrono.map(exMaxW).filter(w => w > 0);
    const oneRMSeries  = chrono.map(h => { const v = exBest1RM(h); return v > 0 ? Math.round(v) : null; }).filter(Boolean);
    const totalVol     = chrono.reduce((acc, h) => acc + exVol(h), 0);

    // ── Timeline de PRs ──────────────────────────────────────────────────
    let runMax = 0;
    const prTimeline = [];
    chrono.forEach(h => {
      const epley = exBest1RM(h);
      const maxW  = exMaxW(h);
      if (epley > runMax && maxW > 0) { runMax = epley; prTimeline.push({ date: h.date, weight: maxW }); }
    });

    // ── Tendência ────────────────────────────────────────────────────────
    const recent3  = weightSeries.slice(-3);
    const before3  = weightSeries.slice(-6, -3);
    const avgR = recent3.length  ? recent3.reduce((a, b) => a + b, 0)  / recent3.length  : 0;
    const avgB = before3.length  ? before3.reduce((a, b) => a + b, 0)  / before3.length  : 0;
    const weightGain = weightSeries.length >= 2 ? +(weightSeries[weightSeries.length - 1] - weightSeries[0]).toFixed(1) : 0;
    const trendDir = !before3.length
      ? (weightGain > 0 ? '↑' : '→')
      : avgR > avgB + 1 ? '↑' : avgR < avgB - 1 ? '↓' : '→';
    const trendCls = trendDir === '↑' ? 'text-green-400' : trendDir === '↓' ? 'text-red-400' : 'text-zinc-400';

    // ── Interpretação automática ─────────────────────────────────────────
    let interpText = '';
    if (n === 0) {
      interpText = 'Nenhuma série válida registrada ainda.';
    } else if (n === 1) {
      interpText = `Primeira sessão em ${formatDate(chrono[0].date)}. Continue firme!`;
    } else {
      const firstDate = new Date(chrono[0].date);
      const lastDate  = new Date(chrono[n - 1].date);
      const daySpan   = Math.max(1, Math.round((lastDate - firstDate) / 86400000));
      const weekSpan  = Math.max(1, Math.round(daySpan / 7));
      const wkRate    = (n / weekSpan).toFixed(1);

      if (trendDir === '↑') {
        interpText = `Progresso de +${weightGain}kg em ${n} sessões (${weekSpan} sem).`;
        if (parseFloat(wkRate) >= 1.5) interpText += ` Freq. alta: ${wkRate}/sem.`;
        if (prTimeline.length >= 3) interpText += ` ${prTimeline.length} recordes batidos no período.`;
      } else if (trendDir === '↓') {
        const lost = +(weightSeries[0] < weightSeries[weightSeries.length - 1] ? 0 : weightSeries[0] - weightSeries[weightSeries.length - 1]).toFixed(1);
        interpText = `Queda de ${lost}kg nas últimas sessões. Avalie recuperação ou técnica.`;
      } else {
        const stableSince = before3.length ? 6 : n;
        interpText = `Estável nas últimas ${stableSince} sessões. Mude o estímulo?`;
        if (pr) {
          const gapKg = +(weightSeries[weightSeries.length - 1] - pr.weight).toFixed(1);
          if (gapKg < 0) interpText += ` A ${Math.abs(gapKg)}kg do PR.`;
        }
      }
    }

    // ── Sparklines ───────────────────────────────────────────────────────
    const wSvg   = renderSparkline(weightSeries.slice(-10), 200, 48);
    const rmSvg  = renderSparkline(oneRMSeries.slice(-10),  200, 48);

    // ── Construção do HTML ────────────────────────────────────────────────
    const statsRow = n > 0 ? `
      <div class="grid grid-cols-3 gap-2">
        ${[
          { label: 'Sessões',    value: n },
          { label: 'Vol. total', value: totalVol >= 1000 ? `${(totalVol / 1000).toFixed(1)}t` : `${Math.round(totalVol)}kg` },
          { label: 'PRs hist.', value: prTimeline.length },
        ].map(m => `
          <div class="bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-2 py-2 text-center">
            <div class="text-[9px] text-zinc-500 uppercase tracking-wide font-bold mb-0.5">${m.label}</div>
            <div class="text-sm font-black font-mono text-white">${m.value}</div>
          </div>`).join('')}
      </div>` : '';

    const mkSparkCard = (label, svg, seriesArr) => !svg ? '' : `
      <div class="bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-3 py-2.5">
        <div class="flex items-center justify-between mb-1.5">
          <div class="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">${label}</div>
          <div class="flex items-center gap-2 text-[9px] font-mono">
            <span class="text-zinc-600">min ${Math.min(...seriesArr)}</span>
            <span class="text-zinc-800">·</span>
            <span class="font-black text-white">${seriesArr[seriesArr.length-1]}</span>
            ${seriesArr[seriesArr.length-1] > seriesArr[0] ? `<span class="text-green-400 font-black">↑</span>` : ''}
            <span class="text-zinc-600">kg</span>
          </div>
        </div>
        <div class="w-full overflow-hidden">${svg}</div>
      </div>`;

    const prBadge = pr ? `
      <div class="flex items-center gap-3 bg-yellow-900/15 border border-yellow-800/40 rounded-xl px-3 py-2.5">
        <div class="w-8 h-8 rounded-full bg-yellow-900/20 border border-yellow-800/40 flex items-center justify-center shrink-0">
          <i data-lucide="trophy" class="w-4 h-4 text-yellow-400"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[9px] text-yellow-600 uppercase tracking-widest font-black">Personal Record</div>
          <div class="text-sm font-black text-yellow-300 font-mono">${pr.weight}kg × ${pr.reps} reps</div>
        </div>
        <div class="text-right shrink-0">
          <div class="text-[10px] text-zinc-600 font-mono">1RM ~${Math.round(pr.weight * (1 + pr.reps / 30))}kg</div>
        </div>
      </div>` : '';

    const interpCard = n > 0 ? `
      <div class="bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-3 py-2.5">
        <div class="flex items-start gap-2.5">
          <span class="text-lg leading-none font-black ${trendCls} mt-0.5 shrink-0">${trendDir}</span>
          <p class="text-[11px] text-zinc-300 leading-relaxed">${interpText}</p>
        </div>
      </div>` : '';

    const prTimelineSection = prTimeline.length >= 2 ? `
      <div class="bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-3 py-2.5">
        <div class="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-2">Timeline de PRs</div>
        <div class="space-y-1.5">
          ${prTimeline.slice(-5).map((p, i, arr) => `
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full ${i === arr.length - 1 ? 'bg-yellow-400' : 'bg-zinc-600'}"></div>
                <span class="text-[10px] font-mono text-zinc-500">${formatDate(p.date)}</span>
              </div>
              <span class="text-[11px] font-mono font-bold ${i === arr.length - 1 ? 'text-yellow-300' : 'text-zinc-400'}">${p.weight}kg</span>
            </div>`).join('')}
        </div>
      </div>` : '';

    const sessionRows = recentTop.map((h, i) => {
      const sets = (h.sets[exId] ?? []).filter(s => s?.done && !s?.warmup);
      if (!sets.length) return '';
      const setsStr = sets.map(s => `${s.w}×${s.r}`).join(' · ');
      const maxW    = Math.max(...sets.filter(s => s.w).map(s => parseFloat(s.w)));
      const daysAgo = Math.floor((Date.now() - new Date(h.date)) / 86400000);
      const agoStr  = daysAgo === 0 ? 'hoje' : daysAgo === 1 ? 'ontem' : `há ${daysAgo}d`;
      return `
        <div class="bg-zinc-900/40 border border-zinc-800/50 px-3 py-2.5 rounded-xl">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="text-[9px] text-zinc-500 font-mono mb-1">${formatDate(h.date)} · <span class="text-zinc-700">${agoStr}</span></div>
              <div class="text-[11px] font-mono text-zinc-300 leading-relaxed">${setsStr}</div>
              ${h.exerciseNotes?.[exId] ? `<div class="text-[9px] text-amber-400/60 italic mt-1 truncate">"${h.exerciseNotes[exId]}"</div>` : ''}
            </div>
            <div class="text-sm font-black font-mono shrink-0 ml-2 ${i === 0 ? 'text-theme-primary' : 'text-zinc-400'}">${maxW}kg</div>
          </div>
        </div>`;
    }).filter(Boolean).join('');

    this.#modalLayer.innerHTML = `
      <div id="exd-backdrop" class="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-zoom-in">
        <div class="glass-card w-full max-w-md rounded-t-3xl border-t border-x border-zinc-800 overflow-hidden">
          <div class="flex justify-center pt-3 pb-1"><div class="w-10 h-1 rounded-full bg-zinc-600"></div></div>
          <div class="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60">
            <div>
              <div class="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Análise · Exercício</div>
              <div class="text-sm font-black text-white leading-tight truncate max-w-[200px]">${exName || exId}</div>
            </div>
            <button id="exd-close" class="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 active:scale-90 transition-all">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
          ${mediaUrl ? `
          <div class="ex-media-wrap bg-zinc-950 border-b border-zinc-800/60 relative overflow-hidden" style="aspect-ratio:16/9;max-height:220px">
            <video
              autoplay loop muted playsinline
              class="w-full h-full object-contain"
              src="${mediaUrl}"
              onerror="this.closest('.ex-media-wrap').style.display='none'">
            </video>
            <div class="absolute bottom-2 right-2">
              <span class="text-[8px] font-mono text-zinc-700 bg-black/60 px-1.5 py-0.5 rounded">demonstração</span>
            </div>
          </div>` : ''}
          <div class="overflow-y-auto no-scrollbar p-4 space-y-2" style="max-height:${mediaUrl ? '55' : '70'}vh">
            ${n === 0
              ? `<p class="text-xs text-zinc-600 text-center py-8 font-mono">Nenhuma sessão com séries válidas concluídas</p>`
              : `${statsRow}
                 ${mkSparkCard('Evolução de Carga', wSvg, weightSeries)}
                 ${mkSparkCard('Evolução 1RM Epley', rmSvg, oneRMSeries)}
                 ${prBadge}
                 ${interpCard}
                 ${prTimelineSection}
                 ${sessionRows ? `<div class="text-[9px] text-zinc-600 uppercase tracking-widest font-bold pt-1">Últimas sessões</div>${sessionRows}` : ''}`}
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    this.#modalLayer.querySelector('#exd-close')?.addEventListener('click', () => this.#closeModal());
    this.#modalLayer.querySelector('#exd-backdrop')?.addEventListener('click', e => {
      if (e.target.id === 'exd-backdrop') this.#closeModal();
    });
  }

  #showExNoteModal(exId, wId) {
    const state    = this.#store.getState();
    const ex       = this.#allWorkouts().flatMap(w => w.exercises ?? []).find(e => e.id === exId);
    const exName   = ex?.name ?? exId;
    const existing = state.exerciseNotes?.[wId]?.[exId] ?? '';

    this.#modalLayer.innerHTML = `
      <div id="exnote-backdrop" class="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm animate-zoom-in">
        <div class="glass-card w-full max-w-md rounded-t-3xl border-t border-x border-zinc-800 p-5 space-y-3">
          <div class="flex justify-center"><div class="w-10 h-1 rounded-full bg-zinc-600"></div></div>
          <div class="flex items-center gap-2">
            <i data-lucide="pencil" class="w-4 h-4 text-amber-400"></i>
            <div class="text-xs font-black text-white uppercase tracking-wider truncate flex-1 min-w-0">${exName}</div>
            <button id="exnote-close" class="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 active:scale-90 transition-all">
              <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          <textarea id="exnote-input" rows="3" placeholder="Observação desta sessão..."
                    class="input-ninja w-full rounded-xl text-sm px-4 py-3 resize-none"
                    maxlength="200">${existing}</textarea>
          <div class="flex gap-2">
            ${existing ? `
            <button id="exnote-clear"
                    class="ripple-target flex-none px-4 py-3 rounded-xl border border-zinc-700 text-zinc-400 text-xs font-bold active:scale-95 transition-all">
              Apagar
            </button>` : ''}
            <button id="exnote-save"
                    class="ripple-target flex-1 btn-akatsuki py-3 rounded-xl text-xs font-black uppercase tracking-widest active:scale-[0.98] transition-all">
              Salvar
            </button>
          </div>
        </div>
      </div>`;
    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    const save = () => {
      const note = this.#modalLayer.querySelector('#exnote-input')?.value ?? '';
      this.#handleAction('save-ex-note', JSON.stringify({ exId, wId, note }));
      this.#closeModal();
    };
    this.#modalLayer.querySelector('#exnote-save')?.addEventListener('click', save);
    this.#modalLayer.querySelector('#exnote-clear')?.addEventListener('click', () => {
      this.#handleAction('save-ex-note', JSON.stringify({ exId, wId, note: '' }));
      this.#closeModal();
    });
    this.#modalLayer.querySelector('#exnote-close')?.addEventListener('click', () => this.#closeModal());
    this.#modalLayer.querySelector('#exnote-backdrop')?.addEventListener('click', e => {
      if (e.target.id === 'exnote-backdrop') this.#closeModal();
    });
    setTimeout(() => this.#modalLayer.querySelector('#exnote-input')?.focus(), 100);
  }

  #showExerciseDemoModal(data = {}) {
    const { exId, exName } = data;
    if (!exName) return;
    const mediaUrl = getExerciseMedia(exName);

    this.#modalLayer.innerHTML = `
      <div id="demo-backdrop" class="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-zoom-in">
        <div class="glass-card w-full max-w-md rounded-t-3xl border-t border-x border-zinc-800 overflow-hidden">
          <div class="flex justify-center pt-3 pb-1"><div class="w-10 h-1 rounded-full bg-zinc-600"></div></div>
          <div class="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60">
            <div>
              <div class="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Demonstração</div>
              <div class="text-sm font-black text-white leading-tight truncate max-w-[220px]">${exName}</div>
            </div>
            <button id="demo-close" class="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 active:scale-90 transition-all">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
          ${mediaUrl ? `
          <div class="bg-zinc-950 relative overflow-hidden" style="aspect-ratio:16/9;max-height:260px">
            <div class="demo-skeleton absolute inset-0 bg-zinc-900 animate-pulse flex items-center justify-center">
              <i data-lucide="zap" class="w-8 h-8 text-zinc-800"></i>
            </div>
            <video id="demo-video" autoplay loop muted playsinline
                   class="w-full h-full object-contain"
                   style="opacity:0;transition:opacity 0.4s ease"
                   src="${mediaUrl}"
                   onerror="this.closest('[style]').remove()">
            </video>
            <div class="absolute bottom-2 right-2">
              <span class="text-[8px] font-mono text-zinc-700 bg-black/60 px-1.5 py-0.5 rounded">demonstração</span>
            </div>
          </div>` : `
          <div class="flex flex-col items-center justify-center py-10 gap-3 bg-zinc-900/30">
            <i data-lucide="video-off" class="w-8 h-8 text-zinc-700"></i>
            <p class="text-xs text-zinc-600 font-mono">Demonstração não disponível</p>
            <p class="text-[10px] text-zinc-700 text-center px-8 leading-relaxed">Coloque um arquivo WebM em<br><span class="text-theme-primary/50 font-mono">/media/exercises/</span></p>
          </div>`}
          <div class="p-4 pb-6 flex gap-2">
            ${exId ? `
            <button data-action="open-exercise-detail" data-ex-id="${exId}" data-ex-name="${exName}"
                    class="ripple-target flex-1 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700
                           text-xs font-black text-zinc-300 active:scale-95 transition-all
                           hover:border-theme-accent hover:text-theme-primary">
              <i data-lucide="bar-chart-2" class="w-3.5 h-3.5 inline -mt-0.5 mr-1"></i> Ver Análise
            </button>` : ''}
            <button id="demo-close2"
                    class="ripple-target ${exId ? '' : 'flex-1'} px-5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800
                           text-xs font-black text-zinc-500 active:scale-95 transition-all">
              Fechar
            </button>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    const video = this.#modalLayer.querySelector('#demo-video');
    if (video) {
      video.addEventListener('loadeddata', () => {
        video.style.opacity = '1';
        this.#modalLayer.querySelector('.demo-skeleton')?.remove();
      }, { once: true });
    }

    const close = () => this.#closeModal();
    this.#modalLayer.querySelector('#demo-close')?.addEventListener('click', close);
    this.#modalLayer.querySelector('#demo-close2')?.addEventListener('click', close);
    this.#modalLayer.querySelector('#demo-backdrop')?.addEventListener('click', e => {
      if (e.target.id === 'demo-backdrop') close();
    });
    this.#modalLayer.querySelector('[data-action="open-exercise-detail"]')?.addEventListener('click', () => {
      close();
      this.#store.setState({ activeModal: 'exercise-detail', modalData: { exId, exName } });
    });
  }

  #showNotesModal() {
    const L = getLabels(this.#store.getState().appMode);
    this.#modalLayer.innerHTML = `
      <div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-zoom-in p-4">
        <div class="glass-card w-full max-w-sm p-6 rounded-3xl border border-theme-dim shadow-[0_0_50px_var(--theme-dim)]">
          <div class="mb-4 text-theme-primary animate-pulse flex justify-center">
            <i data-lucide="trophy" class="w-12 h-12"></i>
          </div>
          <h2 class="text-2xl font-black uppercase italic mb-1 text-white text-center">${L.doneTile}</h2>
          <p class="text-zinc-500 text-xs text-center mb-4 font-mono">${L.doneSub}</p>
          <textarea
            id="workout-notes-input"
            placeholder="Como foi o treino? Alguma observação..."
            class="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-theme-primary resize-none mb-4 transition-all"
            rows="3"
          ></textarea>
          <button id="confirm-finish"
            class="w-full py-3 bg-theme-primary text-black font-black text-sm uppercase rounded-xl shadow-[0_0_15px_var(--theme-primary)] active:scale-95 transition-all">
            FINALIZAR TREINO
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    $("#confirm-finish", this.#modalLayer)?.addEventListener("click", () => {
      const notes = (
        $("#workout-notes-input", this.#modalLayer)?.value ?? ""
      ).trim();
      this.#closeModal();
      this.#workoutCtrl.finishWorkout(notes);
    });
  }

  #showWeeklyRetroModal() {
    const state = this.#store.getState();
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    this.#store.setState({ retroLastShown: todayKey });

    const lastMon = new Date(now); lastMon.setDate(now.getDate() - 7); lastMon.setHours(0, 0, 0, 0);
    const lastSun = new Date(now); lastSun.setDate(now.getDate() - 1); lastSun.setHours(23, 59, 59, 999);

    const weekHistory = (state.history ?? []).filter(h => {
      const d = new Date(h.date); return d >= lastMon && d <= lastSun;
    });
    const weekCardio = (state.cardioHistory ?? []).filter(c => {
      const d = new Date(c.date); return d >= lastMon && d <= lastSun;
    });

    if (weekHistory.length === 0 && weekCardio.length === 0) return;

    const totalVol      = weekHistory.reduce((s, h) => s + (h.vol || 0), 0);
    const totalReps     = weekHistory.reduce((s, h) => s + (h.reps || 0), 0);
    const totalDuration = weekHistory.reduce((s, h) => s + (h.duration || 0), 0);
    const cardioKm      = weekCardio.reduce((s, c) => s + (c.distance || 0), 0);
    const cardioDuration = weekCardio.reduce((s, c) => s + (c.duration || 0), 0);
    const bestWorkout   = weekHistory.length > 0
      ? weekHistory.reduce((best, h) => (h.vol || 0) > (best.vol || 0) ? h : best)
      : null;

    const MESES_ABR = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const monStr = `${lastMon.getDate()} ${MESES_ABR[lastMon.getMonth()]}`;
    const sunStr = `${lastSun.getDate()} ${MESES_ABR[lastSun.getMonth()]}`;

    const metric = (icon, label, value, sub = '') => `
      <div class="flex items-center gap-3 py-2.5 border-b border-zinc-800/50 last:border-0">
        <div class="w-8 h-8 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center shrink-0">
          <i data-lucide="${icon}" class="w-3.5 h-3.5 text-zinc-400"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">${label}</div>
          ${sub ? `<div class="text-[9px] text-zinc-600 mt-0.5">${sub}</div>` : ''}
        </div>
        <div class="text-sm font-black font-mono text-white">${value}</div>
      </div>`;

    const rows = [];
    if (weekHistory.length > 0) {
      rows.push(metric('dumbbell', 'Treinos', String(weekHistory.length),
        bestWorkout ? `melhor: ${bestWorkout.title}` : ''));
      if (totalVol > 0) rows.push(metric('trending-up', 'Volume', formatVolume(totalVol),
        `${totalReps} repetições`));
      if (totalDuration > 0) rows.push(metric('clock', 'Tempo ativo', formatDuration(totalDuration)));
    }
    if (weekCardio.length > 0) {
      rows.push(metric('activity', 'Cardio',
        cardioKm > 0 ? `${cardioKm.toFixed(1)}km` : `${weekCardio.length} sess.`,
        cardioKm > 0 ? `${weekCardio.length} sess. · ${Math.round(cardioDuration)}min` : ''));
    }

    const hitGoal = weekHistory.length >= (state.cycleGoal ?? 6);

    this.#modalLayer.innerHTML = `
      <div class="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 backdrop-blur-md animate-zoom-in">
        <div class="glass-card w-11/12 max-w-sm rounded-3xl border border-zinc-700 overflow-hidden">
          <div class="px-6 pt-5 pb-4 border-b border-zinc-800/50">
            <div class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Retrospectiva semanal</div>
            <div class="text-white font-black text-lg uppercase italic">${monStr} – ${sunStr}</div>
            ${hitGoal ? `
            <div class="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-900/30 border border-green-800/40">
              <i data-lucide="check-circle" class="w-3 h-3 text-green-400"></i>
              <span class="text-[10px] font-bold text-green-400">Meta atingida</span>
            </div>` : ''}
          </div>
          <div class="px-6 py-1">
            ${rows.join('')}
          </div>
          <div class="px-6 pb-5 pt-3">
            <button id="retro-close"
                    class="w-full py-3 rounded-xl bg-theme-primary text-black font-black
                           text-sm uppercase active:scale-[0.98] transition-transform">
              Fechar
            </button>
          </div>
        </div>
      </div>`;

    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });
    $("#retro-close", this.#modalLayer)?.addEventListener("click", () => this.#closeModal());
  }

  #showPDFImportModal(data = {}) {
    const { loading, ok, exercises = [], fileName = '', error = '', rawText = '' } = data;

    const exerciseRows = exercises.map((ex, i) => `
      <div class="flex items-center gap-2 py-2 border-b border-zinc-800/50 last:border-0" data-ex-idx="${i}">
        <div class="flex-1 min-w-0">
          <input class="pdf-ex-name w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-2 py-1
                        text-xs text-white font-mono focus:outline-none focus:border-theme-accent"
                 value="${ex.name.replace(/"/g, '&quot;')}" data-idx="${i}">
        </div>
        <input class="pdf-ex-sets w-12 bg-zinc-800/60 border border-zinc-700 rounded-lg px-2 py-1
                      text-xs text-white font-mono text-center focus:outline-none focus:border-theme-accent"
               value="${ex.sets}" placeholder="sets" data-idx="${i}">
        <span class="text-zinc-700 text-xs">×</span>
        <input class="pdf-ex-reps w-16 bg-zinc-800/60 border border-zinc-700 rounded-lg px-2 py-1
                      text-xs text-white font-mono text-center focus:outline-none focus:border-theme-accent"
               value="${ex.reps}" placeholder="reps" data-idx="${i}">
        <button class="pdf-ex-remove w-7 h-7 rounded-full flex items-center justify-center
                       text-zinc-600 hover:text-red-400 hover:bg-red-900/20 transition-all"
                data-idx="${i}">
          <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `).join('');

    const content = loading ? `
      <div class="flex flex-col items-center gap-4 py-8">
        <div class="w-10 h-10 border-2 border-theme-primary border-t-transparent rounded-full animate-spin"></div>
        <p class="text-xs text-zinc-400 font-mono">Analisando PDF...</p>
        <p class="text-[9px] text-zinc-600">${fileName}</p>
      </div>
    ` : !ok ? `
      <div class="text-center py-6">
        <i data-lucide="alert-triangle" class="w-8 h-8 text-red-400 mx-auto mb-3"></i>
        <p class="text-sm font-bold text-white mb-1">Não foi possível ler o PDF</p>
        <p class="text-[10px] text-zinc-500 mb-1">${error || 'PDF pode estar protegido ou sem texto extraível.'}</p>
        <p class="text-[9px] text-zinc-600">Dica: PDFs escaneados (imagens) não funcionam. Use PDFs com texto digital.</p>
      </div>
    ` : exercises.length === 0 ? `
      <div class="text-center py-6">
        <i data-lucide="file-text" class="w-8 h-8 text-zinc-600 mx-auto mb-3"></i>
        <p class="text-sm font-bold text-white mb-1">Nenhum exercício detectado</p>
        <p class="text-[10px] text-zinc-500 mb-3">O texto foi extraído mas não identificamos exercícios conhecidos.</p>
        <p class="text-[9px] text-zinc-600 font-mono bg-zinc-800/60 rounded-lg p-2 text-left leading-relaxed overflow-auto max-h-24">${rawText.slice(0, 400)}</p>
        <p class="text-[9px] text-zinc-600 mt-2">Use o editor manual para criar o treino.</p>
      </div>
    ` : `
      <div>
        <div class="flex items-center gap-2 mb-3">
          <i data-lucide="check-circle" class="w-4 h-4 text-green-400 shrink-0"></i>
          <p class="text-[10px] text-zinc-400">${exercises.length} exercício${exercises.length !== 1 ? 's' : ''} detectado${exercises.length !== 1 ? 's' : ''} · revise antes de salvar</p>
        </div>
        <div class="mb-3">
          <label class="text-[9px] text-zinc-600 uppercase tracking-widest font-bold mb-1 block">Nome do treino</label>
          <input id="pdf-workout-name"
                 class="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2
                        text-sm text-white font-bold focus:outline-none focus:border-theme-accent"
                 placeholder="Ex: Treino A — Peito" value="">
        </div>
        <div class="overflow-y-auto max-h-[45vh] pr-1" id="pdf-ex-list">
          ${exerciseRows}
        </div>
        <button id="pdf-save-btn"
                class="ripple-target btn-akatsuki w-full py-3 rounded-xl text-xs font-black uppercase
                       tracking-widest flex items-center justify-center gap-2 mt-3 active:scale-95">
          <i data-lucide="check" class="w-4 h-4"></i> Salvar Treino
        </button>
      </div>
    `;

    this.#modalLayer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div class="glass-card w-full max-w-lg rounded-2xl border border-zinc-800 p-5 overflow-hidden">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <i data-lucide="file-text" class="w-4 h-4 text-theme-primary"></i>
              <h3 class="font-black text-sm text-white uppercase tracking-wide">Importar PDF</h3>
            </div>
            <button id="pdf-close" class="w-8 h-8 rounded-full flex items-center justify-center
                                          text-zinc-600 hover:text-white hover:bg-zinc-800 transition-all">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
          ${!loading && fileName ? `<p class="text-[9px] text-zinc-600 font-mono mb-3 truncate">${fileName}</p>` : ''}
          ${content}
        </div>
      </div>
    `;

    this.#modalLayer.style.display = 'block';
    if (window.lucide) window.lucide.createIcons({ node: this.#modalLayer });

    $("#pdf-close", this.#modalLayer)?.addEventListener("click", () => this.#closeModal());

    if (!loading && ok && exercises.length > 0) {
      $("#pdf-save-btn", this.#modalLayer)?.addEventListener("click", () => {
        const nameEl = $("#pdf-workout-name", this.#modalLayer);
        const rows   = this.#modalLayer.querySelectorAll("#pdf-ex-list [data-ex-idx]");
        const saved  = [];
        rows.forEach(row => {
          const idx  = row.dataset.exIdx;
          const name = row.querySelector(`.pdf-ex-name`)?.value?.trim();
          const sets = row.querySelector(`.pdf-ex-sets`)?.value;
          const reps = row.querySelector(`.pdf-ex-reps`)?.value?.trim();
          if (name) saved.push({ name, sets: parseInt(sets) || 3, reps: reps || '8-12', rest: 60 });
        });
        this.#handleAction("pdf-import-save", { workoutName: nameEl?.value?.trim() || 'Importado', exercises: saved });
        this.#closeModal();
      });

      this.#modalLayer.querySelectorAll(".pdf-ex-remove").forEach(btn => {
        btn.addEventListener("click", () => {
          const row = btn.closest("[data-ex-idx]");
          row?.remove();
        });
      });
    }
  }

  #showStaleSessionModal(hours) {
    this.#modalLayer.innerHTML = `
      <div class="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 backdrop-blur-md animate-zoom-in">
        <div class="glass-card w-11/12 max-w-sm p-6 rounded-3xl border border-zinc-700 text-center">
          <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-orange-900/20 border border-orange-800/40 flex items-center justify-center">
            <i data-lucide="clock" class="w-7 h-7 text-orange-400"></i>
          </div>
          <h3 class="text-white font-black uppercase italic text-lg mb-1">Sessão Pausada</h3>
          <p class="text-zinc-400 text-sm mb-6 font-mono">Treino em andamento há ${hours}h. O que deseja fazer?</p>
          <div class="flex gap-3">
            <button id="stale-discard" class="flex-1 py-3 bg-zinc-900 border border-red-900/50 rounded-xl text-red-400 font-bold text-sm uppercase active:scale-95">
              Descartar
            </button>
            <button id="stale-continue" class="flex-1 py-3 bg-theme-primary text-black font-black text-sm uppercase rounded-xl shadow-[0_0_15px_var(--theme-primary)] active:scale-95">
              Continuar
            </button>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    $("#stale-continue", this.#modalLayer)?.addEventListener("click", () => {
      this.#closeModal();
      this.#navigate("workout");
    });
    $("#stale-discard", this.#modalLayer)?.addEventListener("click", () => {
      this.#closeModal();
      this.#store.setState({ workoutStartTime: null, workoutId: null });
    });
  }

  #openNotesModal() {
    this.#store.setState({ activeModal: "notes", modalData: null });
  }

  #closeModal() {
    this.#store.setState({ activeModal: null, modalData: null });
    this.#modalLayer.innerHTML = "";
  }

  #closeReport() {
    this.#reportLayer.innerHTML = "";
    this.#store.setState({ activeModal: null, modalData: null });
  }

  /* ─── Confirm actions ─────────────────────────────────────────── */

  #confirm(message, actionName, payload = null) {
    this.#store.setState({
      activeModal: "confirm",
      modalData: {
        message,
        confirmAction: actionName,
        confirmPayload: payload,
      },
    });
  }

  #executeConfirmedAction(action, payload) {
    switch (action) {
      case "reset-workout":
        this.#workoutCtrl.resetWorkout(payload);
        this.#render(this.#store.getState());
        break;
      case "reset-week":
        this.#workoutCtrl.resetWeek();
        this.#render(this.#store.getState());
        break;
      case "start-new-week":
        this.#workoutCtrl.startNewWeek();
        this.#render(this.#store.getState());
        break;
      case "open-cycle-modal":
        this.#store.setState({ activeModal: 'cycle-overview', modalData: null });
        break;
      case "open-workout-picker":
        this.#store.setState({ activeModal: 'workout-picker', modalData: null });
        break;
      case "undo-mission":
        this.#workoutCtrl.undoMission(payload);
        this.#render(this.#store.getState());
        break;
      case "confirm-delete-workout":
        this.#store.setState((s) => ({
          customWorkouts: (s.customWorkouts ?? []).filter(
            (w) => w.id !== payload,
          ),
          editorWorkout: null,
          tab: "treinar",
        }));
        break;

      case "reset-cycle":
        this.#store.setState({ cyclePosition: 0 });
        this.#render(this.#store.getState());
        break;
      case "reset-data":
        this.#storage.clearAll();
        location.reload();
        break;

      case "cardio-abandon-confirmed":
        this.#cardioCtrl.abandon();
        this.#stopCardioInterval();
        this.#stopCardioGPS();
        this.#navigate("treinar");
        break;

      case "navigate-from-workout": {
        const { tab, workoutId: wId } = payload ?? {};
        if (!tab) break;
        const s = this.#store.getState();
        if (s.workoutStartTime) {
          this.#store.setState({ tab });
        } else {
          this.#store.setState({ tab, workoutId: wId ?? null });
        }
        this.#checkReminderNotification();
        break;
      }
    }
  }

  /* ─── Action dispatcher ───────────────────────────────────────── */

  #handleAction(action, payload) {
    switch (action) {
      case "start-workout": {
        this.#usedWorkoutPhrases.clear();
        this.#workoutCtrl.startWorkout(payload);
        const stAF = this.#store.getState();
        const hasLogs = Object.keys(stAF.logs[payload] ?? {}).some(k => k !== '_c');
        if (stAF.autoFillOnStart && !hasLogs) this.#workoutCtrl.autoFillAll(payload);
        break;
      }
      case "resume-workout":
        this.#workoutCtrl.startWorkout(payload);
        break;
      case "finish-workout":
        this.#openNotesModal();
        break;
      case "toggle-set": {
        const tRest = parseInt(payload.rest) || this.#store.getState().defaultRestTime || 60;
        this.#workoutCtrl.toggleSet(payload.wId, payload.exId, payload.idx, tRest);
        if (!this.#timer.isRunning && this.#timerBadge) hide(this.#timerBadge);
        if (this.#store.getState().logs?.[payload.wId]?.[payload.exId]?.[payload.idx]?.done) {
          this.#lastRestDuration = tRest;
          this.#timerCardKey = `${payload.wId}|${payload.exId}`;
          const rb = document.getElementById('timer-restart-btn');
          if (rb) rb.classList.add('hidden');
        } else {
          if (this.#timerCardKey === `${payload.wId}|${payload.exId}`) this.#timerCardKey = null;
        }
        break;
      }
      case "start-set-timer":
        this.#startSetTimer(payload.wId, payload.exId, payload.idx, payload.seconds, payload.rest);
        break;
      case "cancel-set-timer":
        this.#cancelSetTimer();
        break;
      case "set-rpe": {
        const parts = payload.split('|');
        const rpe   = parseInt(parts.pop());
        const [rpeWId, rpeExId, rpeIdx] = parts;
        this.#workoutCtrl.saveRPE(rpeWId, rpeExId, parseInt(rpeIdx), rpe);
        break;
      }
      case "mod-sets":
        this.#workoutCtrl.modSets(payload.wId, payload.exId, payload.delta);
        break;
      case "toggle-skip-exercise": {
        const { wId: skipWId, exid: skipExId } = payload;
        this.#workoutCtrl.toggleSkipExercise(skipWId, skipExId);
        break;
      }
      case "save-log":
        this.#workoutCtrl.saveLog(
          payload.wId,
          payload.exId,
          payload.idx,
          payload.field,
          payload.value,
        );
        break;
      case "quick-reps": {
        const [qWid, qExId, qIdxStr, qReps] = payload.split('|');
        const qIdx = parseInt(qIdxStr);
        const qRow = document.querySelector(`[data-set-key="${qWid}|${qExId}|${qIdx}"]`);
        if (qRow) {
          const repsInput = qRow.querySelectorAll('input')[1];
          if (repsInput) repsInput.value = qReps;
        }
        this.#workoutCtrl.saveLog(qWid, qExId, qIdx, 'r', qReps);
        break;
      }
      case "adjust-weight": {
        const [aWid, aExId, aIdxStr, aDelta] = payload.split('|');
        const aIdx  = parseInt(aIdxStr);
        const sign  = parseFloat(aDelta) >= 0 ? 1 : -1;
        const inc   = parseFloat(this.#store.getState().weightIncrement) || 2.5;
        const delta = sign * inc;
        const aRow  = document.querySelector(`[data-set-key="${aWid}|${aExId}|${aIdx}"]`);
        const wInput = aRow?.querySelectorAll('input')[0];
        const base  = parseFloat(wInput?.value) || parseFloat(wInput?.placeholder) || 0;
        const newW  = Math.max(0, parseFloat((base + delta).toFixed(2)));
        const newWStr = newW % 1 === 0 ? String(newW) : parseFloat(newW.toFixed(2)).toString();
        if (wInput) wInput.value = newWStr;
        this.#workoutCtrl.saveLog(aWid, aExId, aIdx, 'w', newWStr);
        break;
      }
      case "reset-workout":
        this.#confirm(
          "Reiniciar este treino? Dados não salvos serão perdidos.",
          "reset-workout",
          payload,
        );
        break;
      case "reset-week":
        this.#confirm(
          "Zerar o status da semana? O histórico será mantido.",
          "reset-week",
        );
        break;
      case "reset-cycle":
        this.#confirm(
          "Reiniciar o ciclo? A posição voltará ao início.",
          "reset-cycle",
        );
        break;
      case "start-new-week":
        this.#confirm(
          "Iniciar nova semana? O ciclo atual será arquivado.",
          "start-new-week",
        );
        break;
      case "undo-mission":
        this.#confirm("Reabrir esta missão?", "undo-mission", payload);
        break;
      case "skip-flex-day": {
        this.#advanceFlexDay();
        this.#showQuickToast('Dia Flex registrado ✓', 'rgba(34,211,238,0.4)');
        break;
      }
      case "register-off-day": {
        this.#advanceOffDay();
        this.#showQuickToast('Descanso registrado ✓', 'rgba(113,113,122,0.4)');
        break;
      }
      case "set-cycle-position": {
        const { idx, wId } = JSON.parse(payload);
        const order = [...(this.#store.getState().cycleOrder ?? [])];
        order[idx] = wId || null;
        this.#store.setState({ cycleOrder: order, cyclePosition: 0, cycleDone: [] });
        break;
      }
      case "reset-data":
        this.#confirm(
          "RESETAR TUDO? ISSO APAGARÁ TODO SEU PROGRESSO.",
          "reset-data",
        );
        break;
      case "goto-workouts":
        this.#navigate("treinar");
        break;
      case "goto-settings":
        this.#navigate("settings");
        break;
      case "show-hint":
        this.#showHintModal(payload);
        break;
      case "goto-tab":
        this.#navigate(payload);
        break;
      case "open-hub":
        this.#store.setState({ activeModal: "hub", modalData: null });
        break;
      case "open-calendar":
        this.#store.setState({ activeModal: "calendar", modalData: null });
        break;
      case "back-from-settings":
        this.#navigate("home");
        break;
      case "set-analytics-tab":
        if (payload) this.#store.setState({ analyticsTab: payload, historyPage: 0 });
        break;
      case "save-user-name": {
        if (payload?.trim()) this.#store.setState({ userName: payload.trim() });
        break;
      }
      case "save-project-name": {
        if (payload?.trim())
          this.#store.setState({ projectName: payload.trim() });
        break;
      }
      case "save-goal": {
        if (payload) this.#store.setState({ goal: payload });
        break;
      }
      case "set-theme": {
        if (payload) {
          this.#store.setState({ theme: payload });
          this.#theme.apply(payload);
        }
        break;
      }
      case "auto-fill":
        this.#workoutCtrl.autoFill(payload.wId, payload.exId);
        break;
      case "auto-fill-all":
        this.#workoutCtrl.autoFillAll(payload);
        break;

      case "quick-save-weight": {
        const val = parseFloat(payload);
        if (isNaN(val) || val <= 0) break;
        const qwState = this.#store.getState();
        const qwEntry = { date: new Date().toISOString(), value: val };
        const todayKey = qwEntry.date.slice(0, 10);
        const existing = (qwState.bodyWeights ?? []).filter(e => (e.date ?? '').slice(0, 10) !== todayKey);
        const next = [qwEntry, ...existing].slice(0, 365);
        this.#store.setState({ bodyWeights: next });
        break;
      }

      case "open-ex-note": {
        const { exId, wId } = typeof payload === 'string' ? JSON.parse(payload) : payload;
        this.#showExNoteModal(exId, wId);
        break;
      }

      case "open-warmup": {
        const p = typeof payload === 'string' ? JSON.parse(payload) : payload;
        this.#showWarmupModal(p);
        break;
      }

      case "save-ex-note": {
        if (typeof payload === 'string') {
          const { exId, wId, note } = JSON.parse(payload);
          const state = this.#store.getState();
          const cur   = state.exerciseNotes ?? {};
          this.#store.setState({
            exerciseNotes: { ...cur, [wId]: { ...(cur[wId] ?? {}), [exId]: note.trim() } }
          });
        }
        break;
      }
      case "set-week-goal": {
        const current = this.#store.getState().cycleGoal ?? 6;
        const next = Math.max(2, Math.min(7, current + parseInt(payload)));
        this.#store.setState({ cycleGoal: next });
        break;
      }
      case "set-week-reset-days": {
        const days = parseInt(payload);
        this.#store.setState({ inactivityResetDays: isNaN(days) ? 0 : days });
        break;
      }
      case "toggle-vibration":
        this.#store.setState({ vibrationEnabled: !(this.#store.getState().vibrationEnabled ?? true) });
        break;
      case "toggle-timer-sound":
        this.#store.setState({ timerSoundEnabled: !(this.#store.getState().timerSoundEnabled ?? true) });
        break;
      case "toggle-auto-fill-on-start":
        this.#store.setState({ autoFillOnStart: !(this.#store.getState().autoFillOnStart ?? false) });
        break;
      case "set-weight-increment": {
        const inc = parseFloat(payload);
        if (!isNaN(inc) && inc > 0) this.#store.setState({ weightIncrement: inc });
        break;
      }
      case "set-commute-return": {
        const mode = payload;
        if (['walk', 'run', 'bike'].includes(mode)) {
          this.#store.setState({ commuteReturnOverride: { mode } });
        }
        break;
      }
      case "toggle-active-commute": {
        const cur = this.#store.getState().activeCommute ?? {};
        this.#store.setState({ activeCommute: { ...cur, enabled: !cur.enabled } });
        break;
      }
      case "set-commute-mode": {
        const cur = this.#store.getState().activeCommute ?? {};
        this.#store.setState({ activeCommute: { ...cur, mode: payload } });
        break;
      }
      case "set-commute-speed": {
        const spd = parseFloat(payload);
        if (!isNaN(spd) && spd > 0) {
          const cur = this.#store.getState().activeCommute ?? {};
          this.#store.setState({ activeCommute: { ...cur, estimatedSpeed: spd } });
        }
        break;
      }
      case "set-commute-km": {
        const km = parseFloat(payload);
        if (!isNaN(km) && km > 0) {
          const cur = this.#store.getState().activeCommute ?? {};
          this.#store.setState({ activeCommute: { ...cur, oneWayDistanceKm: km } });
        }
        break;
      }
      case "set-default-rest": {
        const secs = parseInt(payload);
        if (!isNaN(secs) && secs >= 0) this.#store.setState({ defaultRestTime: secs });
        break;
      }
      case "set-app-mode": {
        const cur = this.#store.getState().appMode ?? "ninja";
        this.#store.setState({ appMode: cur === "ninja" ? "normal" : "ninja" });
        break;
      }
      case "toggle-light-mode": {
        const cur = this.#store.getState().lightMode ?? false;
        this.#store.setState({ lightMode: !cur });
        break;
      }
      case "set-activity-level": {
        const v = parseFloat(payload);
        if (!isNaN(v)) this.#store.setState({ activityLevel: v });
        break;
      }
      case "goto-profile":
        this.#navigate("corpo");
        break;
      case "export-bio-pdf":
        this.#exportBioPDF();
        break;
      case "save-biometrics": {
        const bio = payload;
        if (!bio?.weight) break;
        const prev = this.#store.getState().biometrics;
        const now  = new Date().toISOString();
        const entry = { ...bio, date: now };
        const weightValue = parseFloat(bio.weight);
        this.#store.setState((s) => {
          const patch = {
            biometrics: entry,
            bioHistory: prev
              ? [prev, ...(s.bioHistory ?? [])].slice(0, 20)
              : (s.bioHistory ?? []),
          };
          // Sincroniza bodyWeights para manter única fonte de verdade no gráfico de peso.
          // Só insere se não houver entrada do mesmo dia calendário (evita duplicata ao editar).
          const todayKey = now.slice(0, 10);
          const hasEntryToday = (s.bodyWeights ?? []).some(w => (w.date ?? '').slice(0, 10) === todayKey);
          if (!isNaN(weightValue) && weightValue > 0 && !hasEntryToday) {
            patch.bodyWeights = [{ date: now, value: weightValue }, ...(s.bodyWeights ?? [])].slice(0, 365);
          }
          return patch;
        });
        break;
      }
      case "save-weight": {
        const entry = {
          date: new Date().toISOString(),
          value: parseFloat(payload),
        };
        if (!isNaN(entry.value) && entry.value > 0) {
          this.#store.setState((s) => ({
            bodyWeights: [entry, ...(s.bodyWeights ?? [])].slice(0, 365),
          }));
        }
        break;
      }
      case "delete-weight": {
        const dateToRemove = payload;
        this.#store.setState((s) => ({
          bodyWeights: (s.bodyWeights ?? []).filter((w) => w.date !== dateToRemove),
        }));
        break;
      }
      case "delete-bio-history": {
        const dateToRemove = payload;
        this.#store.setState((s) => ({
          bioHistory: (s.bioHistory ?? []).filter((b) => b.date !== dateToRemove),
        }));
        break;
      }
      case "load-more-history":
        this.#store.setState((s) => ({ historyPage: (s.historyPage ?? 0) + 1 }));
        break;
      case "open-cardio-log":
        this.#store.setState({ activeModal: "cardio-log", modalData: null });
        break;
      case "start-run-tracker":
        this.#showRunTrackerModal();
        break;
      case "delete-cardio": {
        const dateToRemove = payload;
        this.#store.setState((s) => ({
          cardioHistory: (s.cardioHistory ?? []).filter((c) => c.date !== dateToRemove),
        }));
        break;
      }
      case "delete-workout-history": {
        const entryId = Number(payload);
        this.#store.setState((s) => {
          const entry = s.history.find((h) => h.id === entryId);
          const history = s.history.filter((h) => h.id !== entryId);
          if (!entry) return { history };
          const done = s.cycleDone ?? [];
          const idx = done.lastIndexOf(entry.workoutId);
          const newDone = idx === -1 ? done : [...done.slice(0, idx), ...done.slice(idx + 1)];
          const newPos = idx === -1 ? (s.cyclePosition ?? 0) : Math.max(0, (s.cyclePosition ?? 0) - 1);
          return { history, cycleDone: newDone, cyclePosition: newPos };
        });
        break;
      }
      case "save-circum": {
        const entry = { date: new Date().toISOString(), ...payload };
        this.#store.setState((s) => ({
          circumHistory: [entry, ...(s.circumHistory ?? [])].slice(0, 24),
        }));
        break;
      }

      /* ── Metas Pessoais ─────────────────────────────────────────── */
      case "add-goal": {
        const label = String(payload ?? '').trim();
        if (!label) break;
        const goal = { id: `goal_${Date.now()}`, label, doneAt: null };
        this.#store.setState((s) => ({
          personalGoals: [goal, ...(s.personalGoals ?? [])],
        }));
        break;
      }
      case "achieve-goal": {
        const id = payload;
        this.#store.setState((s) => ({
          personalGoals: (s.personalGoals ?? []).map((g) =>
            g.id === id ? { ...g, doneAt: new Date().toISOString() } : g,
          ),
        }));
        break;
      }
      case "delete-goal": {
        const id = payload;
        this.#store.setState((s) => ({
          personalGoals: (s.personalGoals ?? []).filter((g) => g.id !== id),
        }));
        break;
      }

      /* ── Workout Editor ─────────────────────────────────────────── */
      case "new-workout":
        this.#store.setState({
          tab: "workout-editor",
          editorWorkout: {
            id: null,
            title: "",
            label: "",
            subtitle: "",
            exercises: [],
          },
        });
        break;

      case "edit-workout": {
        const target = this.#allWorkouts().find((w) => w.id === payload);
        if (!target) break;
        this.#store.setState({
          tab: "workout-editor",
          editorWorkout: {
            ...target,
            exercises: (target.exercises ?? []).map((e) => ({ ...e })),
          },
        });
        break;
      }

      case "add-ex": {
        const { name, sets } = payload;
        const id = `cex_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        this.#store.setState((s) => ({
          editorWorkout: {
            ...s.editorWorkout,
            exercises: [
              ...(s.editorWorkout?.exercises ?? []),
              { id, name, sets, icon: "dumbbell" },
            ],
          },
        }));
        break;
      }

      case "remove-ex": {
        const idx = payload;
        this.#store.setState((s) => ({
          editorWorkout: {
            ...s.editorWorkout,
            exercises: (s.editorWorkout?.exercises ?? []).filter(
              (_, i) => i !== idx,
            ),
          },
        }));
        break;
      }

      case "save-workout": {
        const title = this.#main.querySelector("#editor-title")?.value?.trim();
        const label = (
          this.#main.querySelector("#editor-label")?.value?.trim() || "CUSTOM"
        ).toUpperCase();
        const subtitle =
          this.#main.querySelector("#editor-subtitle")?.value?.trim() || "";
        if (!title) {
          const inp = this.#main.querySelector("#editor-title");
          inp?.focus();
          inp?.classList.add("ring-1", "ring-red-500/70");
          setTimeout(
            () => inp?.classList.remove("ring-1", "ring-red-500/70"),
            1200,
          );
          break;
        }
        const s = this.#store.getState();
        const editor = s.editorWorkout ?? {};
        const exercises = editor.exercises ?? [];
        const isNew = !editor.id;
        const isCustom = editor.isCustom;
        const id = isNew ? `custom_${Date.now()}` : editor.id;

        if (!isNew && !isCustom) {
          // Treino built-in: salva overrides de exercícios + meta (título/label/subtítulo)
          this.#store.setState((prev) => ({
            workoutExercises: {
              ...(prev.workoutExercises ?? {}),
              [id]: exercises,
            },
            workoutMeta: {
              ...(prev.workoutMeta ?? {}),
              [id]: { title, label, subtitle },
            },
            editorWorkout: null,
            tab: "treinar",
          }));
        } else {
          const workout = {
            id,
            title,
            label,
            subtitle,
            muscleFocus: [],
            exercises,
            isCustom: true,
          };
          this.#store.setState((prev) => ({
            customWorkouts: isNew
              ? [...(prev.customWorkouts ?? []), workout]
              : (prev.customWorkouts ?? []).map((w) =>
                  w.id === id ? workout : w,
                ),
            editorWorkout: null,
            tab: "treinar",
          }));
        }
        break;
      }

      case "back-from-editor":
        this.#store.setState({ tab: "treinar", editorWorkout: null });
        break;

      case "delete-custom-workout":
        this.#confirm(
          "Excluir este treino? O histórico relacionado será mantido.",
          "confirm-delete-workout",
          this.#store.getState().editorWorkout?.id,
        );
        break;

      /* ── Fim Workout Editor ──────────────────────────────────────── */

      /* ── Cardio guiado ──────────────────────────────────────────── */
      case "open-cardio-protocol-modal":
        this.#showCardioProtocolModal();
        break;

      case "start-cardio-protocol":
        this.#showCardioPreSessionModal(payload);
        break;

      case "cardio-pause":
        this.#cardioCtrl.pause();
        // Force re-render to show paused UI
        setHTML(this.#main, renderCardio(this.#store.getState(), this.#cardioProtocols));
        mountCardio(this.#main, (action, payload) => this.#handleAction(action, payload));
        this.#syncIcons();
        break;

      case "cardio-resume":
        this.#cardioCtrl.resume();
        setHTML(this.#main, renderCardio(this.#store.getState(), this.#cardioProtocols));
        mountCardio(this.#main, (action, payload) => this.#handleAction(action, payload));
        this.#syncIcons();
        break;

      case "cardio-skip-block":
        this.#cardioCtrl.skipBlock();
        break;

      case "cardio-finish":
        this.#showCardioFinishModal();
        break;

      case "cardio-abandon":
        this.#confirm(
          "Abandonar a sessão? O tempo e distância não serão salvos.",
          "cardio-abandon-confirmed",
        );
        break;

      case "set-cardio-counts-streak": {
        const cur = this.#store.getState().cardioCountsStreak ?? false;
        this.#store.setState({ cardioCountsStreak: !cur });
        break;
      }

      case "set-weekly-cardio-km": {
        const val = parseFloat(payload);
        this.#store.setState({ weeklyCardioKmGoal: isNaN(val) || val <= 0 ? null : val });
        break;
      }

      case "set-weekly-cardio-min": {
        const val = parseInt(payload);
        this.#store.setState({ weeklyCardioMinGoal: isNaN(val) || val <= 0 ? null : val });
        break;
      }

      case "set-default-cardio-protocol": {
        if (payload) this.#store.setState({ defaultCardioProtocol: payload });
        break;
      }
      case "toggle-notifications":
        this.#toggleNotifications();
        break;
      case "save-notification-time": {
        if (payload) this.#store.setState({ notificationTime: payload });
        break;
      }

      /* ── Fim Cardio guiado ─────────────────────────────────────── */

      case "toggle-theme":
        this.#toggleTheme();
        break;
      case "export-json":
        this.#exportService.exportJSON(this.#store.getState());
        break;
      case "export-csv":
        this.#exportService.exportCSV(this.#store.getState().history);
        break;

      case "toggle-section": {
        const cur = this.#store.getState().hiddenSections ?? [];
        const next = cur.includes(payload)
          ? cur.filter((s) => s !== payload)
          : [...cur, payload];
        this.#store.setState({ hiddenSections: next });
        break;
      }

      case "set-day-plan": {
        const { day, workoutId } = payload;
        const cur = this.#store.getState().weekPlan ?? {};
        this.#store.setState({ weekPlan: { ...cur, [day]: workoutId } });
        break;
      }

      case "show-workout-history": {
        const workoutId = payload;
        const state = this.#store.getState();
        const workout = this.#allWorkouts().find((w) => w.id === workoutId);
        if (!workout) break;
        this.#showWorkoutHistoryModal(workout, state.history);
        break;
      }

      case "import-json": {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const data = JSON.parse(ev.target.result);
              const allowed = [
                "logs",
                "history",
                "cycleDone",
                "cycleStart",
                "cycleOrder",
                "cycleGoal",
                "completedCycles",
                "prs",
                "bodyWeights",
                "biometrics",
                "bioHistory",
                "customWorkouts",
                "workoutExercises",
                "workoutMeta",
                "weekPlan",
                "cardioHistory",
                "achievements",
                "circumHistory",
                "cardioCountsStreak",
                "personalGoals",
                "inactivityResetDays",
              ];
              // backward-compat: aceita backups com nomes antigos (v2)
              const legacyMap = {
                week:          'cycleDone',
                weekStart:     'cycleStart',
                weekGoal:      'cycleGoal',
                weekResetDays: 'inactivityResetDays',
              };
              const patch = {};
              allowed.forEach((k) => {
                if (data[k] !== undefined) patch[k] = data[k];
              });
              Object.entries(legacyMap).forEach(([oldKey, newKey]) => {
                if (data[oldKey] !== undefined && patch[newKey] === undefined) {
                  patch[newKey] = data[oldKey];
                }
              });
              if (!Object.keys(patch).length) return;
              const count = Object.keys(patch).join(", ");
              if (
                !confirm(
                  `Restaurar backup?\n\nCampos: ${count}\n\nOs dados atuais serão substituídos.`,
                )
              )
                return;
              this.#store.setState(patch);
              this.#render(this.#store.getState());
            } catch {
              alert(
                "Arquivo inválido. Selecione um backup JSON exportado pelo app.",
              );
            }
          };
          reader.readAsText(file);
        };
        input.click();
        break;
      }

      case "import-pdf": {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".pdf,application/pdf";
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          this.#showPDFImportModal({ loading: true, fileName: file.name });
          const result = await parsePDFWorkout(file);
          this.#showPDFImportModal({ ...result, fileName: file.name });
        };
        input.click();
        break;
      }

      case "pdf-import-save": {
        const { workoutName, exercises } = payload ?? {};
        if (!exercises?.length) break;
        const ts   = Date.now();
        const rand = Math.random().toString(36).slice(2, 6);
        const newWorkout = {
          id:          `custom_${ts}${rand}`,
          label:       workoutName || 'Importado',
          title:       (workoutName || 'Importado').toUpperCase(),
          subtitle:    'Importado via PDF',
          muscleFocus: [],
          isCustom:    true,
          exercises:   exercises.map((ex, i) => ({
            id:   `pdf_${ts}${rand}_${i}`,
            icon: 'dumbbell',
            name: ex.name,
            sets: parseInt(ex.sets) || 3,
            reps: ex.reps || '8-12',
            rest: parseInt(ex.rest) || 60,
          })),
        };
        const s = this.#store.getState();
        this.#store.setState({ customWorkouts: [...(s.customWorkouts ?? []), newWorkout], activeModal: null });
        break;
      }

      case "reorder-ex": {
        const { idx, dir } = payload;
        const s = this.#store.getState();
        const exs = [...(s.editorWorkout?.exercises ?? [])];
        const dest = idx + dir;
        if (dest < 0 || dest >= exs.length) break;
        [exs[idx], exs[dest]] = [exs[dest], exs[idx]];
        this.#store.setState({
          editorWorkout: { ...s.editorWorkout, exercises: exs },
        });
        break;
      }

      case "repeat-workout": {
        this.#workoutCtrl.startWorkout(payload);
        break;
      }

      case "toggle-warmup": {
        this.#workoutCtrl.toggleWarmup(payload.wId, payload.exId, payload.idx);
        break;
      }

      case "update-ex": {
        const { idx, name, sets, reps, rest, note } = payload;
        this.#store.setState((s) => {
          const exs = [...(s.editorWorkout?.exercises ?? [])];
          if (idx < 0 || idx >= exs.length) return s;
          const updated = { ...exs[idx], name, sets };
          if (reps != null) updated.reps = reps;
          else delete updated.reps;
          if (rest != null) updated.rest = rest;
          else delete updated.rest;
          if (note) updated.note = note;
          else delete updated.note;
          exs[idx] = updated;
          return { editorWorkout: { ...s.editorWorkout, exercises: exs } };
        });
        break;
      }

      case "cancel-edit-ex":
        this.#patchEditorExercises(this.#store.getState().editorWorkout);
        break;

      case "open-exercise-detail":
        this.#store.setState({ activeModal: "exercise-detail", modalData: payload });
        break;

      case "open-exercise-demo":
        this.#store.setState({ activeModal: "exercise-demo", modalData: payload });
        break;

      /* ─── Onboarding ────────────────────────────────────────── */
      case 'ob-next': {
        // Collect form values from the container (payload = container DOM element)
        const obContainer = (payload instanceof Element) ? payload : this.#obLayer;
        if (this.#obStep === 1) {
          const nameEl    = obContainer?.querySelector('#ob-name');
          const projectEl = obContainer?.querySelector('#ob-project');
          if (nameEl?.value.trim())    this.#obData.name        = nameEl.value.trim();
          if (projectEl?.value.trim()) this.#obData.projectName = projectEl.value.trim();
        } else if (this.#obStep === 5) {
          const acEl = obContainer?.querySelector('#ob-academy');
          if (acEl?.value.trim()) this.#obData.academyName = acEl.value.trim();
          const kmEl = obContainer?.querySelector('#ob-commute-km');
          const km   = parseFloat(kmEl?.value);
          if (!isNaN(km) && km > 0) this.#obData.commute = { ...(this.#obData.commute ?? {}), oneWayDistanceKm: km };
        } else if (this.#obStep === 6) {
          const wEl  = obContainer?.querySelector('#ob-weight');
          const hEl  = obContainer?.querySelector('#ob-height');
          const aEl  = obContainer?.querySelector('#ob-age');
          const bfEl = obContainer?.querySelector('#ob-body-fat');
          const lmEl = obContainer?.querySelector('#ob-lean-mass');
          const mmEl = obContainer?.querySelector('#ob-muscle-mass');
          const w  = parseFloat(wEl?.value);  if (!isNaN(w)  && w  > 0) this.#obData.weight     = w;
          const h  = parseFloat(hEl?.value);  if (!isNaN(h)  && h  > 0) this.#obData.height     = h;
          const a  = parseInt(aEl?.value);    if (!isNaN(a)  && a  > 0) this.#obData.age        = a;
          const bf = parseFloat(bfEl?.value); if (!isNaN(bf) && bf > 0) this.#obData.bodyFat    = bf;
          const lm = parseFloat(lmEl?.value); if (!isNaN(lm) && lm > 0) this.#obData.leanMass   = lm;
          const mm = parseFloat(mmEl?.value); if (!isNaN(mm) && mm > 0) this.#obData.muscleMass = mm;
        }
        // steps: 0=welcome 1-7=form steps 8=summary
        this.#obStep = Math.min(this.#obStep + 1, 8);
        this.#renderObStep();
        if (this.#obLayer) this.#obLayer.scrollTop = 0;
        break;
      }
      case 'ob-back':
        this.#obStep = Math.max(this.#obStep - 1, 0);
        this.#renderObStep();
        if (this.#obLayer) this.#obLayer.scrollTop = 0;
        break;
      case 'ob-complete':
        this.#completeOnboarding();
        break;
      case 'ob-set-mode':
        this.#obData.mode = payload;
        this.#renderObStep();
        break;
      case 'ob-set-goal':
        this.#obData.goal = payload;
        this.#renderObStep();
        break;
      case 'ob-set-training-style': {
        this.#obData.trainingStyle = payload;
        // Pré-preenche cycleGoal com o padrão do split escolhido
        const tpl = SPLIT_TEMPLATES[payload];
        if (tpl?.defaultCycleGoal) this.#obData.cycleGoal = tpl.defaultCycleGoal;
        this.#renderObStep();
        break;
      }
      case 'ob-set-frequency':
        this.#obData.cycleGoal = parseInt(payload);
        this.#renderObStep();
        break;
      case 'ob-set-commute-mode':
        this.#obData.commute = { ...(this.#obData.commute ?? {}), mode: payload };
        this.#renderObStep();
        break;
      case 'ob-set-commute-speed':
        this.#obData.commute = { ...(this.#obData.commute ?? {}), estimatedSpeed: parseFloat(payload) };
        this.#renderObStep();
        break;
      case 'ob-set-sex':
        this.#obData.sex = payload;
        this.#renderObStep();
        break;
      case 'ob-set-experience':
        this.#obData.experience = payload;
        this.#renderObStep();
        break;
      case 'ob-toggle-eval':
        this.#obData.hasEval = !this.#obData.hasEval;
        this.#renderObStep();
        break;
      case 'ob-set-activity':
        this.#obData.activityLevel = parseFloat(payload);
        this.#renderObStep();
        break;
    }
  }

  navigate(tab, workoutId = null) {
    this.#navigate(tab, workoutId);
  }

  #navigate(tab, workoutId = null) {
    const state = this.#store.getState();

    // Cancela timer de série cronometrada ao sair do treino
    if (tab !== 'workout' && this.#activeSetTimer) this.#cancelSetTimer();

    // A9: intercepta saída do treino ativo quando há séries marcadas
    if (state.tab === 'workout' && tab !== 'workout' && state.workoutId) {
      const workoutLogs = state.logs?.[state.workoutId] ?? {};
      const hasDoneSets = Object.values(workoutLogs).some(exLogs =>
        Object.values(exLogs).some(set => set?.done)
      );
      if (hasDoneSets) {
        this.#confirm(
          'Sair do treino? A sessão ficará ativa — você pode retomar depois pelo banner.',
          'navigate-from-workout',
          { tab, workoutId },
        );
        return;
      }
    }

    // Preserva workoutId enquanto há sessão ativa (necessário para o banner de retomada)
    if (state.workoutStartTime) {
      this.#store.setState({ tab });
    } else {
      this.#store.setState({ tab, workoutId });
    }
    this.#checkReminderNotification();
  }

  /* ─── Timer de Série Cronometrada ───────────────────────────────── */

  #startSetTimer(wId, exId, idx, seconds, rest) {
    this.#cancelSetTimer();
    this.#activeSetTimer = { wId, exId, idx, seconds, remaining: seconds, rest };

    // Swap the start button for countdown display
    const key  = `${wId}|${exId}|${idx}`;
    const area = document.querySelector(`[data-timed-reps="${key}"]`);
    if (area) {
      area.innerHTML = `
        <div class="flex items-center justify-center gap-3 py-1">
          <span data-timer-display class="text-2xl font-mono font-black text-theme-primary tabular-nums min-w-[64px] text-center">
            ${this.#fmtSetTimer(seconds)}
          </span>
          <button data-action="cancel-set-timer"
                  class="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-500
                         flex items-center justify-center active:scale-90 transition-all">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>`;
      if (window.lucide) window.lucide.createIcons({ nameAttr: 'data-lucide', node: area });
    }

    this.#setTimerInterval = setInterval(() => {
      this.#activeSetTimer.remaining--;
      const rem = this.#activeSetTimer.remaining;

      if (rem <= 0) {
        clearInterval(this.#setTimerInterval);
        this.#setTimerInterval = null;
        const { wId: w, exId: ex, idx: i, rest: r, seconds: s } = this.#activeSetTimer;
        this.#activeSetTimer = null;
        // Restore area before toggle (toggle will update row via patchSetRow)
        const finArea = document.querySelector(`[data-timed-reps="${w}|${ex}|${i}"]`);
        if (finArea) finArea.innerHTML = '';
        this.#handleAction('toggle-set', { wId: w, exId: ex, idx: i, rest: r });
      } else {
        patchTimedSetCountdown(key, rem, seconds);
      }
    }, 1000);
  }

  #cancelSetTimer() {
    if (this.#setTimerInterval) {
      clearInterval(this.#setTimerInterval);
      this.#setTimerInterval = null;
    }
    if (this.#activeSetTimer) {
      const { wId, exId, idx, seconds } = this.#activeSetTimer;
      this.#activeSetTimer = null;
      const key  = `${wId}|${exId}|${idx}`;
      const area = document.querySelector(`[data-timed-reps="${key}"]`);
      if (area) {
        area.innerHTML = `
          <button data-action="start-set-timer"
                  data-wid="${wId}" data-exid="${exId}" data-idx="${idx}"
                  data-seconds="${seconds}" data-rest="60"
                  class="ripple-target w-full py-3 rounded-xl bg-zinc-900/70 border border-zinc-700
                         text-theme-primary font-black text-sm flex items-center justify-center gap-2
                         active:scale-95 transition-all hover:border-theme-dim hover:bg-theme-dim/30">
            <i data-lucide="timer" class="w-4 h-4"></i> ${seconds}s — Iniciar
          </button>`;
        if (window.lucide) window.lucide.createIcons({ nameAttr: 'data-lucide', node: area });
      }
    }
  }

  #fmtSetTimer(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  #toggleTheme() {
    const newTheme = this.#theme.toggle();
    this.#store.setState({ theme: newTheme });
  }

  /* ─── Notificações ────────────────────────────────────────────── */

  async #toggleNotifications() {
    const state = this.#store.getState();
    if (state.notificationsEnabled) {
      this.#store.setState({ notificationsEnabled: false });
      return;
    }
    if (!('Notification' in window)) {
      alert('Seu navegador não suporta notificações.');
      return;
    }
    let permission = Notification.permission;
    if (permission === 'denied') {
      alert('Notificações bloqueadas. Ative nas configurações do navegador.');
      return;
    }
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }
    if (permission === 'granted') {
      this.#store.setState({ notificationsEnabled: true });
    }
  }

  #checkReminderNotification() {
    const state = this.#store.getState();
    if (!state.notificationsEnabled) return;
    if (Notification.permission !== 'granted') return;

    const now     = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    if (state.notifLastDate === todayKey) return;

    const [hh, mm] = (state.notificationTime ?? '08:00').split(':').map(Number);
    if (now.getHours() < hh || (now.getHours() === hh && now.getMinutes() < mm)) return;

    const trainedToday = (state.history ?? []).some(h => {
      const d = new Date(h.date);
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth()    === now.getMonth()    &&
             d.getDate()     === now.getDate();
    });
    const cardioToday = (state.cardioHistory ?? []).some(c => {
      const d = new Date(c.date);
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth()    === now.getMonth()    &&
             d.getDate()     === now.getDate();
    });
    if (trainedToday || cardioToday) return;

    const nextWId    = state.cycleOrder?.[state.cyclePosition ?? 0];
    const nextW      = nextWId ? this.#allWorkouts().find(w => w.id === nextWId) : null;
    const notifBody  = nextW
      ? `Hoje: ${nextW.title} — ${nextW.subtitle}. Hora de ativar o chakra!`
      : 'Você ainda não treinou hoje. Hora de ativar o chakra!';

    this.#store.setState({ notifLastDate: todayKey });
    const n = new Notification('⚡ TREINO MONSTRO', {
      body: notifBody,
      icon: '/treino-monstro/icons/icon-192.png',
      badge: '/treino-monstro/icons/icon-192.png',
      tag: 'treino-reminder',
      renotify: false,
    });
    n.onclick = () => { window.focus(); n.close(); };
  }

  /* ─── Nav ─────────────────────────────────────────────────────── */

  #updateNav(state) {
    const light = state.lightMode ?? false;
    const inactiveCol = light ? "#94a3b8" : "#52525b";
    const activeText = light ? "var(--theme-primary)" : "#fff";

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      const active = btn.dataset.tab === state.tab;
      const icon = btn.querySelector("i");
      const text = btn.querySelector("span");
      const dot = btn.querySelector(".active-indicator");

      if (icon) {
        icon.style.color = active ? "var(--theme-primary)" : inactiveCol;
        icon.style.filter = active
          ? "drop-shadow(0 0 5px var(--theme-dim))"
          : "none";
        icon.parentElement.style.transform = active
          ? "translateY(-2px)"
          : "translateY(0)";
      }
      if (text) {
        text.style.color = active ? activeText : inactiveCol;
        text.style.opacity = active ? "1" : "0.7";
      }
      if (dot) {
        dot.style.opacity = active ? "1" : "0";
        dot.style.transform = active ? "scale(1)" : "scale(0)";
      }
    });
  }

  /* ─── PR Toast ────────────────────────────────────────────────── */

  #detectAndShowPRToast(newPrs, prevPrs) {
    for (const exId in newPrs) {
      const isNew = !prevPrs[exId];
      const isBetter =
        prevPrs[exId] && newPrs[exId].date !== prevPrs[exId].date;
      if (!isNew && !isBetter) continue;

      const ex = this.#allWorkouts()
        .flatMap((w) => w.exercises)
        .find((e) => e.id === exId);
      if (ex) this.#showPRToast(ex.name, newPrs[exId].weight);
      break; // mostra apenas um toast por ciclo
    }
  }

  #showPRToast(exerciseName, weight) {
    // Remove toast anterior se ainda estiver visível
    document.querySelector("#pr-toast")?.remove();

    const toast = document.createElement("div");
    toast.id = "pr-toast";
    toast.className =
      "fixed top-20 inset-x-0 z-[200] flex justify-center px-4 pointer-events-none";
    toast.innerHTML = `
      <div class="bg-yellow-950/95 border border-yellow-500/60 text-yellow-300 font-bold text-sm
                  px-5 py-3 rounded-2xl flex items-center gap-2.5
                  shadow-[0_0_30px_rgba(234,179,8,0.25)] animate-zoom-in max-w-xs">
        <i data-lucide="trophy" class="w-4 h-4 text-yellow-400 shrink-0"></i>
        <div class="min-w-0">
          <div class="text-[10px] text-yellow-500 uppercase tracking-widest font-black">NOVO RECORDE PESSOAL</div>
          <div class="text-yellow-200 font-bold truncate">${exerciseName} — ${weight}kg</div>
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    if (window.lucide) lucide.createIcons({ nodes: [toast] });

    setTimeout(() => {
      if (!toast.isConnected) return;
      toast.style.transition = "opacity 0.5s ease, transform 0.5s ease";
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-8px)";
      setTimeout(() => toast.remove(), 500);
    }, 3500);
  }

  #showCelebrationOverlay(id) {
    const a = ACHIEVEMENT_MAP[id];
    if (!a) return;
    document.querySelector('#celebration-overlay')?.remove();

    const palette = ['bg-theme-primary','bg-amber-400','bg-rose-400','bg-cyan-400','bg-emerald-400','bg-violet-400'];
    const particles = Array.from({ length: 12 }, (_, i) =>
      `<span class="celebration-particle ${palette[i % palette.length]}"
             style="--a:${i * 30}deg;--delay:${(i * 0.06).toFixed(2)}s"></span>`
    ).join('');

    const el = document.createElement('div');
    el.id = 'celebration-overlay';
    el.className = 'fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-sm';
    el.innerHTML = `
      <div class="animate-zoom-in flex flex-col items-center gap-6 px-8 py-12 text-center max-w-xs w-full">
        <div class="relative">
          <div class="celebration-burst">${particles}</div>
          <div class="absolute inset-0 rounded-full celebration-ping border border-theme-primary/40"></div>
          <div class="relative w-28 h-28 rounded-full border-2 border-theme-accent
                      flex items-center justify-center bg-zinc-900
                      shadow-[0_0_60px_var(--theme-primary),0_0_120px_var(--theme-dim)]">
            <i data-lucide="${a.icon}" class="w-14 h-14 ${a.color}"></i>
          </div>
        </div>
        <div class="space-y-2">
          <div class="text-[9px] tracking-[0.35em] uppercase text-theme-primary font-black">
            Conquista Desbloqueada
          </div>
          <div class="text-3xl font-black text-white glitch-text" data-text="${a.name}">${a.name}</div>
          <div class="text-sm text-zinc-400 font-mono">${a.desc}</div>
        </div>
        <button id="close-celebration"
                class="ripple-target mt-2 px-10 py-3 rounded-xl border border-theme-accent
                       bg-theme-dim text-theme-primary font-black text-sm uppercase tracking-widest
                       hover:bg-theme-primary hover:text-black transition-all active:scale-95">
          Continuar
        </button>
      </div>
    `;
    document.body.appendChild(el);
    if (window.lucide) lucide.createIcons({ nodes: [el] });

    const close = () => {
      el.style.transition = 'opacity 0.4s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 400);
    };
    el.querySelector('#close-celebration').addEventListener('click', close);
    el.addEventListener('click', e => { if (e.target === el) close(); });
    setTimeout(close, 9000);
  }

  #showAchievementToast(ids) {
    if (!ids?.length) return;
    document.querySelector('#achievement-toast')?.remove();

    const a = ACHIEVEMENT_MAP[ids[0]];
    if (!a) return;

    const extra = ids.length > 1 ? ` +${ids.length - 1}` : '';
    const toast = document.createElement('div');
    toast.id = 'achievement-toast';
    toast.className = 'fixed top-20 inset-x-0 z-[201] flex justify-center px-4 pointer-events-none';
    toast.innerHTML = `
      <div class="bg-yellow-950/95 border border-yellow-600/60
                  px-5 py-3 rounded-2xl flex items-center gap-2.5
                  shadow-[0_0_30px_rgba(234,179,8,0.3)] animate-zoom-in max-w-xs">
        <div class="w-8 h-8 rounded-full bg-yellow-900/40 border border-yellow-700/60
                    flex items-center justify-center shrink-0">
          <i data-lucide="${a.icon}" class="w-4 h-4 ${a.color}"></i>
        </div>
        <div class="min-w-0">
          <div class="text-[9px] text-yellow-500 uppercase tracking-widest font-black">CONQUISTA DESBLOQUEADA${extra}</div>
          <div class="text-sm font-black text-white truncate">${a.name}</div>
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    if (window.lucide) lucide.createIcons({ nodes: [toast] });

    setTimeout(() => {
      if (!toast.isConnected) return;
      toast.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      setTimeout(() => toast.remove(), 500);
    }, 4000);
  }

  /* ─── Helper: lista completa de treinos (estáticos + custom + overrides) */

  #resolveWorkout(w) {
    const state = this.#store.getState();
    const exOvr = state.workoutExercises ?? {};
    const metaOvr = state.workoutMeta ?? {};
    const withEx = exOvr[w.id] ? { ...w, exercises: exOvr[w.id] } : w;
    const withMeta = metaOvr[w.id] ? { ...withEx, ...metaOvr[w.id] } : withEx;
    return withMeta;
  }

  #advanceFlexDay() {
    const s   = this.#store.getState();
    const len = Math.max(1, (s.cycleOrder ?? []).length);
    const pos = ((s.cyclePosition ?? 0) + 1) % len;
    const completed = pos === 0 ? (s.completedCycles ?? 0) + 1 : (s.completedCycles ?? 0);
    this.#store.setState({
      cycleDone:       [...(s.cycleDone ?? []), 'flex'],
      cyclePosition:   pos,
      completedCycles: completed,
      cycleStart:      s.cycleStart ?? new Date().toISOString(),
    });
  }

  #advanceOffDay() {
    const s   = this.#store.getState();
    const len = Math.max(1, (s.cycleOrder ?? []).length);
    const pos = ((s.cyclePosition ?? 0) + 1) % len;
    const completed = pos === 0 ? (s.completedCycles ?? 0) + 1 : (s.completedCycles ?? 0);
    this.#store.setState({
      cyclePosition:   pos,
      completedCycles: completed,
      lastOffDayDate:  new Date().toISOString().slice(0, 10),
      ...(pos === 0
        ? { cycleDone: [], cycleStart: null }
        : { cycleStart: s.cycleStart ?? new Date().toISOString() }),
    });
  }

  #allWorkouts() {
    const s      = this.#store.getState();
    const custom = s.customWorkouts ?? [];
    if (custom.length > 0) {
      // Usuário tem programa próprio: mostra apenas customWorkouts + itens de sistema (flex, cardio)
      const system = (this.#workouts || []).filter(w => w.isFlexDay || w.isCardio);
      return [...custom, ...system].map(w => this.#resolveWorkout(w));
    }
    // Sem programa próprio: mostra todos os built-ins (comportamento legado)
    return (this.#workouts || []).map(w => this.#resolveWorkout(w));
  }

  #templateWorkouts() {
    const s      = this.#store.getState();
    const custom = s.customWorkouts ?? [];
    if (custom.length === 0) return []; // já aparecem como main
    return (this.#workouts || [])
      .filter(w => !w.isFlexDay && !w.isCardio)
      .map(w => this.#resolveWorkout(w));
  }

  /* ─── Patch cirúrgico: lista de exercícios do editor ─────────── */

  #patchEditorExercises(editorWorkout) {
    const section = this.#main.querySelector("#editor-exercises-section");
    const countEl = this.#main.querySelector("#editor-ex-count");
    const exercises = editorWorkout?.exercises ?? [];
    if (section) {
      section.innerHTML = renderExercisesListHTML(exercises);
      if (window.lucide) lucide.createIcons({ nodes: [section] });
    }
    if (countEl) countEl.textContent = exercises.length;
  }

  /* ─── Cardio interval + GPS ──────────────────────────────────── */

  #startCardioInterval() {
    if (this.#cardioInterval) return; // already running
    this.#cardioInterval = setInterval(() => {
      const s = this.#store.getState().activeCardioSession;
      if (!s || s.paused) return;
      this.#cardioCtrl.tick();
    }, 1000);
  }

  #stopCardioInterval() {
    if (this.#cardioInterval) {
      clearInterval(this.#cardioInterval);
      this.#cardioInterval = null;
    }
  }

  #haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  #startCardioGPS() {
    if (this.#cardioGpsWatchId !== null) return;
    if (!navigator.geolocation) return;
    this.#cardioGpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const s = this.#store.getState().activeCardioSession;
        if (!s || s.paused || s.completed) return;
        if (pos.coords.accuracy > 60) return;

        if (this.#cardioLastGpsPos) {
          const last = this.#cardioLastGpsPos;
          const dt   = (pos.timestamp - last.timestamp) / 1000;
          const d    = this.#haversine(
            last.coords.latitude, last.coords.longitude,
            pos.coords.latitude,  pos.coords.longitude,
          );
          if (dt > 0 && d > 0 && d / dt < 20) {
            this.#cardioCtrl.addGpsPoint(pos.coords.latitude, pos.coords.longitude, d);
          }
        }
        this.#cardioLastGpsPos = pos;
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
    // Request wake lock
    navigator.wakeLock?.request('screen').then(wl => { this.#cardioWakeLock = wl; }).catch(() => {});
  }

  #stopCardioGPS() {
    if (this.#cardioGpsWatchId !== null) {
      navigator.geolocation.clearWatch(this.#cardioGpsWatchId);
      this.#cardioGpsWatchId = null;
      this.#cardioLastGpsPos = null;
    }
    if (this.#cardioWakeLock) {
      this.#cardioWakeLock.release().catch(() => {});
      this.#cardioWakeLock = null;
    }
  }

  /* ─── Modal: seleção de protocolo de cardio ────────────────────── */

  #showCardioProtocolModal() {
    const protocols = this.#cardioProtocols;
    const state     = this.#store.getState();
    const defProto  = state.defaultCardioProtocol ?? 'zona2-30';

    const effortBadge = (ef) => {
      if (ef === 'forte')    return 'bg-red-900/40 text-red-300 border-red-700/50';
      if (ef === 'fácil')    return 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50';
      return 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50';
    };

    const cards = protocols.map(p => {
      const isDef = p.id === defProto;
      return `
        <button data-action="start-cardio-protocol" data-payload="${p.id}"
          class="w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98]
                 ${isDef ? 'bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/40' : 'bg-white/5 border-white/10'}">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                      ${isDef ? 'bg-[var(--theme-accent)]/20' : 'bg-white/5'}">
            <i data-lucide="${p.icon}" class="w-5 h-5 ${isDef ? 'text-[var(--theme-accent)]' : 'text-white/40'}"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-black text-white">${p.name}</span>
              ${isDef ? '<span class="text-[8px] font-black text-[var(--theme-accent)] bg-[var(--theme-accent)]/10 px-1.5 py-0.5 rounded">padrão</span>' : ''}
            </div>
            <div class="text-xs text-white/40 mt-0.5 truncate">${p.description}</div>
            <div class="flex items-center gap-2 mt-1.5">
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full border ${effortBadge(p.effort)}">
                ${p.effort.toUpperCase()}
              </span>
              ${p.totalDuration > 0 ? `<span class="text-[9px] text-white/30 font-mono">${Math.round(p.totalDuration/60)}min</span>` : '<span class="text-[9px] text-white/30">Livre</span>'}
              <span class="text-[9px] text-white/20">${p.blocks.length} blocos</span>
            </div>
          </div>
        </button>`;
    }).join('');

    this.#modalLayer.innerHTML = `
      <div class="fixed inset-0 z-[80] flex items-end justify-center bg-black/90 backdrop-blur-sm animate-zoom-in"
           id="proto-backdrop">
        <div class="glass-card w-full max-w-sm rounded-t-3xl border border-white/10 overflow-hidden">
          <div class="flex justify-center pt-3 pb-1">
            <div class="w-10 h-1 rounded-full bg-zinc-700"></div>
          </div>
          <div class="p-5 pb-8">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <i data-lucide="activity" class="w-5 h-5 text-[var(--theme-accent)]"></i>
                <h2 class="text-base font-black uppercase text-white">Selecionar Protocolo</h2>
              </div>
              <button id="close-proto-modal"
                class="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 active:scale-90 transition-all">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            </div>
            <div class="space-y-2 overflow-y-auto max-h-[60vh] no-scrollbar">${cards}</div>
            <div class="mt-4 border-t border-white/10 pt-4">
              <button data-action="open-cardio-log"
                class="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-white/50 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                <i data-lucide="list" class="w-4 h-4"></i>
                Registrar manualmente
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    this.#modalLayer.querySelector('#close-proto-modal')?.addEventListener('click', () => this.#closeModal());
    this.#modalLayer.querySelector('#proto-backdrop')?.addEventListener('click', e => {
      if (e.target.id === 'proto-backdrop') this.#closeModal();
    });
    this.#modalLayer.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#handleAction(btn.dataset.action, btn.dataset.payload);
      });
    });
  }

  /* ─── Modal: pré-sessão de cardio (tipo + local) ────────────────── */

  #showCardioPreSessionModal(protocolId) {
    const protocol = this.#cardioProtocols.find(p => p.id === protocolId);
    const protocolName = protocol?.name ?? 'Protocolo';

    const MODES = [
      { id: 'corrida-rua',     type: 'corrida', local: 'rua',     icon: 'wind',   label: 'Corrida',  sub: 'Rua'      },
      { id: 'corrida-esteira', type: 'corrida', local: 'esteira', icon: 'repeat', label: 'Corrida',  sub: 'Esteira'  },
      { id: 'bike',            type: 'bike',    local: null,       icon: 'activity', label: 'Bike',   sub: 'Ciclismo' },
    ];

    const savedMode = this.#store.getState().lastCardioMode;
    let selected = MODES.find(m => m.id === savedMode) ? savedMode : MODES[0].id;

    const renderBtns = () => MODES.map(m => `
      <button data-presession-mode="${m.id}"
              class="presession-btn flex flex-col items-center gap-1.5 py-4 rounded-2xl border transition-all active:scale-95
                     ${m.id === selected
                       ? 'bg-theme-dim border-theme-accent text-theme-primary'
                       : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'}">
        <i data-lucide="${m.icon}" class="w-5 h-5 pointer-events-none"></i>
        <span class="text-xs font-black pointer-events-none">${m.label}</span>
        <span class="text-[9px] font-bold pointer-events-none ${m.id === selected ? 'text-theme-primary/70' : 'text-zinc-600'}">${m.sub}</span>
      </button>`).join('');

    this.#modalLayer.innerHTML = `
      <div class="fixed inset-0 z-[80] flex items-end justify-center bg-black/90 backdrop-blur-sm animate-zoom-in">
        <div class="glass-card w-full max-w-sm rounded-t-3xl border border-zinc-700/60 p-5 pb-8 space-y-4">
          <div class="flex justify-center pt-1 pb-1">
            <div class="w-10 h-1 rounded-full bg-zinc-700"></div>
          </div>
          <div>
            <div class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-0.5">Iniciar sessão</div>
            <div class="text-white font-black text-base uppercase italic">${protocolName}</div>
          </div>
          <div class="grid grid-cols-3 gap-2" id="presession-btns">
            ${renderBtns()}
          </div>
          <button id="presession-confirm"
                  class="w-full py-4 bg-theme-primary text-black font-black text-sm uppercase rounded-2xl
                         shadow-[0_0_15px_var(--theme-primary)] active:scale-95 transition-all">
            Iniciar
          </button>
        </div>
      </div>`;

    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    const ml = this.#modalLayer;

    const syncBtns = () => {
      ml.querySelectorAll('.presession-btn').forEach(b => {
        const on = b.dataset.presessionMode === selected;
        b.className = `presession-btn flex flex-col items-center gap-1.5 py-4 rounded-2xl border transition-all active:scale-95
          ${on ? 'bg-theme-dim border-theme-accent text-theme-primary' : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'}`;
        const span = b.querySelectorAll('span')[1];
        if (span) span.className = `text-[9px] font-bold pointer-events-none ${on ? 'text-theme-primary/70' : 'text-zinc-600'}`;
      });
      if (window.lucide) lucide.createIcons({ nodes: [ml] });
    };

    ml.querySelectorAll('.presession-btn').forEach(b => {
      b.addEventListener('click', () => { selected = b.dataset.presessionMode; syncBtns(); });
    });

    ml.querySelector('#presession-confirm')?.addEventListener('click', () => {
      const mode = MODES.find(m => m.id === selected);
      this.#store.setState({ lastCardioMode: selected });
      this.#closeModal();
      this.#cardioCtrl.startProtocol(protocolId, { type: mode.type, local: mode.local });
    });
  }

  /* ─── Modal: finalizar sessão de cardio ─────────────────────────── */

  #showCardioFinishModal() {
    const s = this.#store.getState().activeCardioSession;
    if (!s) return;
    if (this.#modalLayer.innerHTML.trim() !== '') return;

    const EFFORT_COLORS = {
      'fácil':    'text-green-400 bg-green-900/20 border-green-900/40',
      'moderado': 'text-amber-400 bg-amber-900/20 border-amber-900/40',
      'forte':    'text-rose-400  bg-rose-900/20  border-rose-900/40',
    };

    const fmtSecs = (sec) => {
      const m = Math.floor(sec / 60), r = sec % 60;
      return `${m}:${String(r).padStart(2, '0')}`;
    };
    const distKm = (s.distanceM || 0) / 1000;
    const durMin = s.totalElapsed / 60;
    const isBike = s.type === 'bike';
    const paceFmt = () => {
      if (distKm < 0.05 || durMin < 0.1) return isBike ? '--' : '--:--';
      if (isBike) return (distKm / (durMin / 60)).toFixed(1);
      const dec = durMin / distKm;
      return `${Math.floor(dec)}:${String(Math.round((dec - Math.floor(dec)) * 60)).padStart(2, '0')}`;
    };

    // Badge informativo do tipo/local escolhido na pré-sessão
    const typeLabel = s.type === 'bike' ? 'Bike' : 'Corrida';
    const localLabel = s.local === 'esteira' ? 'Esteira' : s.local === 'rua' ? 'Rua' : null;
    const typeIcon  = s.type === 'bike' ? 'activity' : s.local === 'esteira' ? 'repeat' : 'wind';
    const badgeHtml = `
      <div class="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400">
        <i data-lucide="${typeIcon}" class="w-3 h-3"></i>
        ${typeLabel}${localLabel ? ` · ${localLabel}` : ''}
      </div>`;

    const defaultEffort = s.protocolId === 'zona2-30' || s.protocolId === 'zona2-45' ? 'moderado' : 'forte';

    this.#modalLayer.innerHTML = `
      <div class="fixed inset-0 z-[80] flex items-end justify-center bg-black/90 backdrop-blur-sm animate-zoom-in">
        <div class="glass-card w-full max-w-sm rounded-t-3xl border border-white/10 p-5 pb-8 space-y-4">
          <div class="flex items-center justify-between pt-1 pb-1">
            <div class="w-10 h-1 rounded-full bg-zinc-700 mx-auto"></div>
          </div>
          <div class="flex items-center justify-between">
            <div class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Finalizar sessão</div>
            ${badgeHtml}
          </div>

          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-white/5 rounded-xl p-3">
              <div class="text-lg font-black text-white font-mono">${fmtSecs(s.totalElapsed)}</div>
              <div class="text-[9px] text-white/40 mt-0.5 uppercase">Tempo</div>
            </div>
            <div class="bg-white/5 rounded-xl p-3">
              <div class="text-lg font-black text-white">${distKm >= 0.1 ? distKm.toFixed(2)+'km' : Math.round(s.distanceM||0)+'m'}</div>
              <div class="text-[9px] text-white/40 mt-0.5 uppercase">Distância</div>
            </div>
            <div class="bg-white/5 rounded-xl p-3">
              <div class="text-lg font-black text-[var(--theme-accent)]">${paceFmt()}</div>
              <div class="text-[9px] text-white/40 mt-0.5 uppercase">${isBike ? 'km/h' : 'Pace/km'}</div>
            </div>
          </div>

          <div>
            <div class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Esforço</div>
            <div class="grid grid-cols-3 gap-2">
              <button data-finish-effort="fácil"    class="finish-effort-btn py-2.5 rounded-xl border text-xs font-black transition-all active:scale-95 bg-zinc-900 border-zinc-800 text-zinc-500">Fácil</button>
              <button data-finish-effort="moderado" class="finish-effort-btn py-2.5 rounded-xl border text-xs font-black transition-all active:scale-95 ${defaultEffort === 'moderado' ? EFFORT_COLORS.moderado : 'bg-zinc-900 border-zinc-800 text-zinc-500'}">Moderado</button>
              <button data-finish-effort="forte"    class="finish-effort-btn py-2.5 rounded-xl border text-xs font-black transition-all active:scale-95 ${defaultEffort === 'forte'    ? EFFORT_COLORS.forte    : 'bg-zinc-900 border-zinc-800 text-zinc-500'}">Forte</button>
            </div>
          </div>

          <input type="text" id="cardio-finish-notes" placeholder="Notas (opcional)..."
                 class="input-ninja w-full py-2.5 rounded-lg text-xs font-mono" />

          <button id="save-cardio-finish"
                  class="w-full py-4 bg-[var(--theme-accent)] text-black font-black text-sm uppercase rounded-2xl
                         shadow-[0_0_15px_var(--theme-accent)] active:scale-95 transition-all">
            Salvar & Ver Relatório
          </button>
        </div>
      </div>`;

    if (window.lucide) lucide.createIcons({ nodes: [this.#modalLayer] });

    const ml = this.#modalLayer;
    let finishEffort = defaultEffort;

    const syncEffort = () => {
      ml.querySelectorAll('.finish-effort-btn').forEach(b => {
        const on = b.dataset.finishEffort === finishEffort;
        b.className = `finish-effort-btn py-2.5 rounded-xl border text-xs font-black transition-all active:scale-95
          ${on ? EFFORT_COLORS[b.dataset.finishEffort] : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`;
      });
    };

    ml.querySelectorAll('.finish-effort-btn').forEach(b =>
      b.addEventListener('click', () => { finishEffort = b.dataset.finishEffort; syncEffort(); }));

    ml.querySelector('#save-cardio-finish')?.addEventListener('click', () => {
      const notes = ml.querySelector('#cardio-finish-notes')?.value?.trim() || '';
      this.#stopCardioInterval();
      this.#stopCardioGPS();
      const result = this.#cardioCtrl.finish({ effort: finishEffort, notes });
      this.#closeModal();
      if (result) this.#showCardioBattleReport(result);
      else this.#navigate('cardio');
    });
  }

  /* ─── Battle Report de Cardio ───────────────────────────────────── */

  #showCardioBattleReport({ entry, newAchievements = [], quote = null, quoteAuthor = null }) {
    const fmtSecs = (sec) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    };

    const effortColors = { fácil: 'text-emerald-400', moderado: 'text-yellow-400', forte: 'text-red-400' };
    const effortColor = effortColors[entry.effort] || 'text-white';

    const achievementHtml = newAchievements.length ? `
      <div class="bg-yellow-900/10 border border-yellow-800/40 rounded-2xl p-4 mb-4">
        <div class="text-[10px] font-bold text-yellow-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <i data-lucide="trophy" class="w-3.5 h-3.5"></i> Conquista Desbloqueada!
        </div>
        <div class="space-y-2">
          ${newAchievements.map(a => `
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-yellow-900/20 border border-yellow-800/40 flex items-center justify-center shrink-0">
                <i data-lucide="${a.icon}" class="w-4 h-4 text-yellow-400"></i>
              </div>
              <div>
                <div class="text-sm font-black text-white">${a.name}</div>
                <div class="text-[9px] text-zinc-500">${a.desc}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    const durSecs = Math.round((entry.duration || 0) * 60);

    this.#reportLayer.innerHTML = `
      <div class="fixed inset-0 z-[100] overflow-y-auto no-scrollbar bg-black">
        <div class="relative min-h-screen flex flex-col px-5 pt-6 pb-10 max-w-md mx-auto">

          <div class="flex justify-between items-center mb-8">
            <div class="text-[10px] font-bold text-zinc-600 uppercase tracking-widest font-mono">CARDIO · ${entry.protocolName || 'Livre'}</div>
            <button id="close-cardio-report" class="w-9 h-9 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white active:scale-90 transition-all">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <div class="text-center mb-8">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <i data-lucide="${entry.type === 'bike' ? 'activity' : entry.local === 'esteira' ? 'repeat' : 'wind'}" class="w-8 h-8 text-theme-primary"></i>
            </div>
            <h1 class="text-3xl font-black uppercase italic text-white tracking-tighter leading-none mb-1">Missão Concluída!</h1>
            <div class="${effortColor} text-sm font-bold uppercase tracking-widest">${entry.effort}</div>
          </div>

          <div class="grid grid-cols-3 gap-3 mb-4">
            <div class="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
              <div class="text-xl font-black text-white font-mono">${fmtSecs(durSecs)}</div>
              <div class="text-[9px] text-zinc-500 uppercase mt-1">Tempo</div>
            </div>
            <div class="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
              <div class="text-xl font-black text-white">${entry.distance ? entry.distance + 'km' : '--'}</div>
              <div class="text-[9px] text-zinc-500 uppercase mt-1">Distância</div>
            </div>
            <div class="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
              ${entry.type === 'bike' && entry.distance && entry.duration
                ? `<div class="text-xl font-black text-[var(--theme-accent)]">${(entry.distance / (entry.duration / 60)).toFixed(1)}</div>
                   <div class="text-[9px] text-zinc-500 uppercase mt-1">km/h</div>`
                : `<div class="text-xl font-black text-[var(--theme-accent)] font-mono">${entry.pace || '--:--'}</div>
                   <div class="text-[9px] text-zinc-500 uppercase mt-1">Pace/km</div>`}
            </div>
          </div>

          <div class="bg-white/3 rounded-2xl border border-white/5 p-4 mb-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span class="text-zinc-600 text-xs">Modalidade</span>
              <div class="text-white font-bold capitalize">
                ${entry.type === 'bike' ? 'Bike' : 'Corrida'}${entry.local ? ` · ${entry.local}` : ''}
              </div>
            </div>
            <div><span class="text-zinc-600 text-xs">GPS</span><div class="text-white font-bold">${entry.gpsTracked ? 'Rastreado' : 'Manual'}</div></div>
          </div>

          ${achievementHtml}

          ${quote ? `
          <div class="rounded-2xl border border-white/5 p-4 mb-4 text-center" style="background:rgba(255,255,255,0.02)">
            <i data-lucide="info" class="w-4 h-4 text-theme-primary/40 mx-auto mb-2"></i>
            <p class="text-sm italic text-zinc-400 leading-relaxed font-mono">"${quote}"</p>
            ${quoteAuthor ? `<p class="text-[10px] text-zinc-600 font-mono mt-2">— ${quoteAuthor}</p>` : ''}
          </div>
          ` : ''}
          ${entry.notes ? `
          <div class="bg-white/3 rounded-2xl border border-white/5 p-4 mb-4 text-center">
            <i data-lucide="info" class="w-4 h-4 text-white/20 mx-auto mb-2"></i>
            <p class="text-sm italic text-zinc-400 font-mono">"${entry.notes}"</p>
          </div>
          ` : ''}

          <button id="cardio-report-close-btn"
            class="btn-akatsuki w-full py-4 ripple-target text-sm font-black">
            <i data-lucide="check-circle" class="w-5 h-5"></i> ENCERRAR OPERAÇÃO
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [this.#reportLayer] });

    const closeReport = () => {
      this.#reportLayer.innerHTML = '';
      this.#navigate('cardio');
    };
    this.#reportLayer.querySelector('#close-cardio-report')?.addEventListener('click', closeReport);
    this.#reportLayer.querySelector('#cardio-report-close-btn')?.addEventListener('click', closeReport);
  }

  /* ─── Ripple no nav ───────────────────────────────────────────── */

  attachGlobalRipple() {
    document.addEventListener(
      "click",
      (e) => {
        const target = e.target.closest(".ripple-target");
        if (target) createRipple(e, target);
      },
      true,
    );
  }

  /* ─── Export PDF da Avaliação Física ─────────────────────────── */

  #exportBioPDF() {
    const s = this.#store.getState();
    const bio = s.biometrics;
    if (!bio) return;

    const {
      userName = "",
      projectName = "AMATERASU",
      activityLevel = 1.55,
    } = s;
    const bmr = bio.leanMass ? Math.round(370 + 21.6 * bio.leanMass) : null;
    const tdee = bmr ? Math.round(bmr * activityLevel) : null;
    const bmi =
      bio.weight && bio.height
        ? (bio.weight / (bio.height / 100) ** 2).toFixed(1)
        : null;
    const rcq =
      bio.cintura && bio.quadril
        ? (bio.cintura / bio.quadril).toFixed(2)
        : null;
    const fatMass =
      bio.weight && bio.bodyFat
        ? ((bio.weight * bio.bodyFat) / 100).toFixed(2)
        : null;
    const residual =
      fatMass && bio.muscleMass && bio.boneMass
        ? (
            bio.weight -
            parseFloat(fatMass) -
            bio.muscleMass -
            bio.boneMass
          ).toFixed(2)
        : null;
    const date = bio.date
      ? new Date(bio.date).toLocaleDateString("pt-BR")
      : "N/D";

    const row = (label, val, unit = "") =>
      val != null
        ? `<tr><td class="lbl">${label}</td><td class="val">${val}${unit ? ` <span class="u">${unit}</span>` : ""}</td></tr>`
        : "";

    const folds = [
      ["Subescapular", bio.dobraSubescapular],
      ["Tricipital", bio.dobraTricipital],
      ["Peitoral", bio.dobraPeitoral],
      ["Axilar-Média", bio.dobraAxilarMedia],
      ["Supra-Ilíaca", bio.dobraSupraIliaca],
      ["Abdominal", bio.dobraAbdominal],
      ["Coxa", bio.dobraCoxa],
    ].filter(([, v]) => v);
    const somaFolds = folds.reduce((a, [, v]) => a + v, 0);

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Avaliação Física — ${userName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#111;background:#fff;padding:24px;font-size:12px}
h1{font-size:22px;font-weight:900;color:#ef4444;text-transform:uppercase;letter-spacing:-.5px}
.sub{font-size:11px;color:#555;margin-top:3px}
.header{border-bottom:3px solid #ef4444;padding-bottom:14px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-end}
.meta{text-align:right;font-size:11px;color:#555;line-height:1.7}
h2{font-size:9.5px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 7px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}
.section{margin-bottom:16px}
table{width:100%;border-collapse:collapse}
tr:nth-child(even) td{background:#f9fafb}
td{padding:5px 9px}
td.lbl{width:55%;color:#374151;font-weight:500}
td.val{font-weight:700;color:#111;font-family:'Courier New',monospace}
.u{font-weight:400;color:#6b7280;font-size:10px}
.red{color:#ef4444}
.footer{margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
@media print{body{padding:12px}}
</style></head><body>
<div class="header">
  <div>
    <h1>Avaliação Física</h1>
    <div class="sub">${userName} · Protocolo Pollock 7 Dobras · Projeto ${projectName}</div>
  </div>
  <div class="meta">
    <div><strong>Data:</strong> ${date}</div>
    ${bio.height ? `<div><strong>Altura:</strong> ${bio.height} cm</div>` : ""}
  </div>
</div>
<div class="grid">
  <div>
    <div class="section"><h2>Composição Corporal</h2><table>
      ${row("Peso", bio.weight, "kg")}
      ${row("% Gordura", bio.bodyFat, "%")}
      ${row("Peso Gordo", fatMass, "kg")}
      ${row("Massa Magra", bio.leanMass, "kg")}
      ${row("Massa Muscular", bio.muscleMass, "kg")}
      ${row("Massa Óssea", bio.boneMass, "kg")}
      ${row("Peso Residual", residual, "kg")}
      ${row("Peso Desejável", bio.targetWeight, "kg")}
      ${row("% Gordura Ideal", bio.targetBodyFat, "%")}
    </table></div>
    <div class="section"><h2>Métricas Calculadas</h2><table>
      ${row("IMC", bmi)}
      ${row("RCQ (Cintura/Quadril)", rcq)}
      ${row("BMR Katch-McArdle", bmr, "kcal")}
      ${row("TDEE estimado", tdee, "kcal/dia")}
      ${bio.leanMass ? row("Proteína recomendada", Math.round(bio.leanMass * 2), "g/dia") : ""}
    </table></div>
  </div>
  <div>
    ${
      folds.length
        ? `<div class="section"><h2>Dobras Cutâneas — Pollock 7 (mm)</h2><table>
      ${folds.map(([l, v]) => row(l, v, "mm")).join("")}
      <tr style="border-top:2px solid #e5e7eb">
        <td class="lbl" style="font-weight:700">SOMA TOTAL</td>
        <td class="val red">${somaFolds} <span class="u">mm</span></td>
      </tr>
    </table></div>`
        : ""
    }
    <div class="section"><h2>Circunferências (cm)</h2><table>
      ${row("Tórax", bio.torax, "cm")}
      ${row("Cintura", bio.cintura, "cm")}
      ${row("Abdome", bio.abdome, "cm")}
      ${row("Quadril", bio.quadril, "cm")}
      ${row("Escapular", bio.escapular, "cm")}
      ${bio.bracoDirContraido ? row("Braço Cont. D / E", `${bio.bracoDirContraido} / ${bio.bracoEsqContraido ?? "—"}`) : ""}
      ${bio.bracoDirRelaxado ? row("Braço Rel. D / E", `${bio.bracoDirRelaxado} / ${bio.bracoEsqRelaxado ?? "—"}`) : ""}
      ${bio.antebracoDireito ? row("Antebraço D / E", `${bio.antebracoDireito} / ${bio.antebracoEsquerdo ?? "—"}`) : ""}
      ${bio.coxaDireita ? row("Coxa D / E", `${bio.coxaDireita} / ${bio.coxaEsquerda ?? "—"}`) : ""}
      ${bio.panturrilhaDireita ? row("Panturrilha D / E", `${bio.panturrilhaDireita} / ${bio.panturrilhaEsquerda ?? "—"}`) : ""}
    </table></div>
  </div>
</div>
<div class="footer">
  <span>Gerado por ${projectName} · Treino Monstro</span>
  <span>${new Date().toLocaleString("pt-BR")}</span>
</div>
<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),350)})<\/script>
</body></html>`;

    const win = window.open("", "_blank", "width=820,height=960");
    if (!win) {
      alert("Permita pop-ups para exportar o relatório.");
      return;
    }
    win.document.write(html);
    win.document.close();
  }

  /* ─── Ícones Lucide ───────────────────────────────────────────── */

  #syncIcons() {
    if (window.lucide) lucide.createIcons();
  }
}
