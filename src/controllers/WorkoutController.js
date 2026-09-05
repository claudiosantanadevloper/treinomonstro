import { countSets } from '../views/WorkoutView.js';
import { getContextualQuote } from '../data/quotes.js';
import { checkWorkoutAchievements, checkStreakAchievements, checkCycleAchievements, checkWeekPerfectAchievement } from '../data/achievements.js';

/**
 * Contém toda a lógica de negócio relacionada a treinos.
 * Não acessa o DOM diretamente — opera apenas no Store.
 */
export class WorkoutController {
  #store;
  #workouts;
  #timer;

  constructor({ store, workouts, timer }) {
    this.#store    = store;
    this.#workouts = workouts; // array estático ou () => array (inclui custom)
    this.#timer    = timer;
  }

  #getWorkouts() {
    return typeof this.#workouts === 'function' ? this.#workouts() : this.#workouts;
  }

  /* ─── Navegação ───────────────────────────────────────────────── */

  startWorkout(wId) {
    const state = this.#store.getState();
    const patch = { tab: 'workout', workoutId: wId };

    // Reseta o timer se: nunca iniciado, ou se está iniciando um treino diferente
    if (!state.workoutStartTime || state.workoutId !== wId) {
      patch.workoutStartTime = Date.now();
    }
    this.#store.setState(patch);
  }

  /* ─── Logs ────────────────────────────────────────────────────── */

  saveLog(wId, exId, idx, field, value) {
    const state = this.#store.getState();
    const exLogs = state.logs[wId]?.[exId]?.[idx] ?? {};
    this.#store.setState(s => ({
      logs: {
        ...s.logs,
        [wId]: {
          ...s.logs[wId],
          [exId]: {
            ...(s.logs[wId]?.[exId] ?? {}),
            [idx]: { ...exLogs, [field]: value },
          },
        },
      },
    }));
  }

  toggleSet(wId, exId, idx, defaultRest) {
    const state   = this.#store.getState();
    const current = state.logs[wId]?.[exId]?.[idx] ?? {};
    const newDone = !current.done;
    const newLog  = { ...current, done: newDone };

    // Pré-preenche próxima série com peso+reps da atual (se ainda vazia)
    const exLogs  = state.logs[wId]?.[exId] ?? {};
    const nextLog = exLogs[idx + 1];
    const nextFill = (newDone && (current.w || current.r) && nextLog !== undefined && !nextLog?.done)
      ? { [idx + 1]: { ...nextLog, w: nextLog.w || current.w, r: nextLog.r || current.r } }
      : {};

    this.#store.setState(s => ({
      logs: {
        ...s.logs,
        [wId]: {
          ...s.logs[wId],
          [exId]: {
            ...(s.logs[wId]?.[exId] ?? {}),
            [idx]: newLog,
            ...nextFill,
          },
        },
      },
    }));

    if (newDone) {
      this.#checkPR(wId, exId, newLog);
      if (this.#store.getState().vibrationEnabled !== false && navigator.vibrate) navigator.vibrate(50);
      if (defaultRest > 0) this.#timer.start(defaultRest);
    } else {
      this.#timer.stop();
    }
  }

  modSets(wId, exId, delta) {
    const state = this.#store.getState();
    const w     = this.#getWorkouts().find(x => x.id === wId);
    const ex    = w?.exercises.find(x => x.id === exId);
    if (!ex) return;

    const exLogs  = state.logs[wId]?.[exId] ?? {};
    const current = countSets(exLogs, ex.sets);
    const next    = Math.max(1, current + delta);
    if (next === current) return;

    // _c persiste o override de contagem independente do padrão do exercício
    const newExLogs = { ...exLogs, _c: next };
    if (delta > 0) {
      newExLogs[next - 1] = { w: '', r: '', done: false };
    } else {
      delete newExLogs[current - 1];
    }

    this.#store.setState(s => ({
      logs: { ...s.logs, [wId]: { ...s.logs[wId], [exId]: newExLogs } },
    }));
  }

  toggleSkipExercise(wId, exId) {
    this.#store.setState(s => {
      const exLogs  = s.logs[wId]?.[exId] ?? {};
      const skipped = !exLogs._skip;
      const newEx   = { ...exLogs };
      if (skipped) newEx._skip = true; else delete newEx._skip;
      return {
        logs: {
          ...s.logs,
          [wId]: { ...s.logs[wId], [exId]: newEx },
        },
      };
    });
  }

  /* ─── Finalizar treino ────────────────────────────────────────── */

  finishWorkout(notes = '') {
    const state = this.#store.getState();
    const w     = this.#getWorkouts().find(x => x.id === state.workoutId);
    if (!w) return;

    const wLogs = state.logs[w.id] ?? {};
    let vol = 0, totalReps = 0;
    let mvp = { name: 'Nenhum', weight: 0 };
    const sessionSets = {};

    w.exercises.forEach(ex => {
      const exLogs = wLogs[ex.id] ?? {};
      if (exLogs._skip) return;
      sessionSets[ex.id] = Object.entries(exLogs)
        .filter(([k]) => k !== '_c' && k !== '_skip')
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, s]) => s);

      Object.values(exLogs).forEach(set => {
        if (!set.done || !set.w || !set.r || set.warmup) return;
        const weight = parseFloat(set.w);
        const reps   = parseFloat(set.r);
        if (!weight || !reps) return;
        vol       += weight * reps;
        totalReps += reps;
        if (weight > mvp.weight) mvp = { name: ex.name, weight, reps };
      });
    });

    const breakdown = w.exercises
      .map(ex => {
        const exLogs = wLogs[ex.id] ?? {};
        if (exLogs._skip) return null;
        let exVol = 0, maxW = 0;
        Object.values(exLogs).forEach(s => {
          if (!s.done || !s.w || !s.r || s.warmup) return;
          const v = parseFloat(s.w) * parseFloat(s.r);
          exVol += v;
          maxW   = Math.max(maxW, parseFloat(s.w));
        });
        return exVol > 0 ? { exId: ex.id, name: ex.name, vol: exVol, maxWeight: maxW } : null;
      })
      .filter(Boolean);

    const duration = state.workoutStartTime
      ? Math.round((Date.now() - state.workoutStartTime) / 60000)
      : null;

    // ─── Missão: agrupa carga muscular + locomoção ──────────────────────
    const weightKg = state.biometrics?.weight ?? 80;
    const trainingCalories = duration ? Math.round(5.5 * weightKg * (duration / 60)) : null;

    const ac = state.activeCommute;
    const returnOverride = state.commuteReturnOverride;
    let commuteData = null;
    if (ac?.enabled && (ac.oneWayDistanceKm ?? 0) > 0 && (ac.estimatedSpeed ?? 0) > 0) {
      const dist = ac.oneWayDistanceKm;

      const goMET = ac.mode === 'bike' ? 6.0 : ac.mode === 'run' ? 7.0 : 3.5;
      const goDuration = Math.round((dist / ac.estimatedSpeed) * 60);
      const goCalories = Math.round(goMET * weightKg * (goDuration / 60));

      const retMode = returnOverride?.mode ?? ac.mode;
      const retSpeedMap = { walk: 4.8, run: 8.0, bike: 15.0 };
      const retSpeed = retMode === ac.mode ? ac.estimatedSpeed : (retSpeedMap[retMode] ?? 4.8);
      const retMET = retMode === 'bike' ? 6.0 : retMode === 'run' ? 7.0 : 3.5;
      const retDuration = Math.round((dist / retSpeed) * 60);
      const retCalories = Math.round(retMET * weightKg * (retDuration / 60));

      commuteData = {
        distance: Math.round(dist * 2 * 10) / 10,
        duration: goDuration + retDuration,
        calories: goCalories + retCalories,
        mode: ac.mode,
        go: { distance: Math.round(dist * 10) / 10, duration: goDuration, calories: goCalories, mode: ac.mode },
        return: { distance: Math.round(dist * 10) / 10, duration: retDuration, calories: retCalories, mode: retMode },
      };
    }

    const mission = {
      training: {
        duration: duration ?? 0,
        volume:   vol,
        reps:     totalReps,
        calories: trainingCalories,
      },
      commute: commuteData,
      totals: {
        duration: (duration ?? 0) + (commuteData?.duration ?? 0),
        calories:  (trainingCalories ?? 0) + (commuteData?.calories ?? 0),
      },
    };

    const entry = {
      id:       Date.now(),
      date:     new Date().toISOString(),
      title:    w.title,
      workoutId: w.id,
      muscles:  w.muscleFocus,
      vol,
      reps:     totalReps,
      duration,
      notes,
      sets:     sessionSets,
      mvp,
      breakdown,
      mission,
      exerciseNotes: state.exerciseNotes?.[w.id] ?? {},
    };

    const newHistory    = [entry, ...state.history];
    const prevCycleDone = state.cycleDone ?? [];
    const newCycleDone  = prevCycleDone.includes(w.id) ? prevCycleDone : [...prevCycleDone, w.id];
    // Registra o início do ciclo na primeira sessão
    const cycleStart    = ((state.cycleDone ?? []).length === 0 && !state.cycleStart)
      ? (state.workoutStartTime ?? Date.now())
      : (state.cycleStart ?? null);

    const stats = {
      title:     w.title,
      workoutId: w.id,
      entryId:   entry.id,
      vol,
      reps:      totalReps,
      sets:      sessionSets,
      duration,
      mvp,
      breakdown,
      mission,
    };

    // ─── Progressão: exercícios que bateram o teto do range de reps ───
    const COMPOUND_NAMES = ['Agachamento', 'Leg Press', 'Levantamento Terra', 'Supino', 'Desenvolvimento', 'Remada', 'Puxada', 'Afundo'];
    const progressionChips = [];
    w.exercises.forEach(ex => {
      const exLogs = wLogs[ex.id] ?? {};
      if (exLogs._skip) return;
      const doneSets = Object.values(exLogs).filter(s => s.done && !s.warmup && s.r);
      if (!doneSets.length) return;
      const match = String(ex.reps ?? '').match(/(\d+)\s*[-–]\s*(\d+)/);
      if (!match) return; // só ranges têm critério de progressão
      const hi = parseInt(match[2]);
      if (!doneSets.every(s => parseFloat(s.r) >= hi)) return;
      const isCompound = COMPOUND_NAMES.some(n => ex.name.includes(n));
      progressionChips.push({ exId: ex.id, name: ex.name, increment: isCompound ? 5 : 2.5 });
    });
    stats.progressionChips = progressionChips;

    const { cycleOrder = [], cyclePosition = 0 } = state;
    // Avança sempre +1 a partir de onde o ciclo está — liberdade de treinar fora de ordem
    // sem pular semanas inteiras no ponteiro do ciclo
    const nextPos = cycleOrder.length ? (cyclePosition + 1) % cycleOrder.length : 0;

    const earned    = state.achievements ?? [];
    const cycleGoal = state.cycleGoal ?? 6;

    let newAchievements = checkWorkoutAchievements(newHistory, earned);

    const allEarnedSoFar = [...earned, ...newAchievements];
    const streakNew = checkStreakAchievements(
      newHistory,
      state.cardioHistory ?? [],
      state.cardioCountsStreak ?? false,
      allEarnedSoFar,
    );

    const completedCycles = state.completedCycles ?? 0;
    const cycleJustCompleted = newCycleDone.length >= cycleGoal && (state.cycleDone ?? []).length < cycleGoal;
    const newCompletedCycles = cycleJustCompleted ? completedCycles + 1 : completedCycles;
    const cycleNew = checkCycleAchievements(
      newCycleDone,
      cycleGoal,
      newCompletedCycles,
      [...allEarnedSoFar, ...streakNew],
    );

    const weekPerfectNew = checkWeekPerfectAchievement(
      newHistory,
      cycleGoal,
      [...allEarnedSoFar, ...streakNew, ...cycleNew],
    );

    newAchievements = [...newAchievements, ...streakNew, ...cycleNew, ...weekPerfectNew];
    stats.newAchievements = newAchievements;

    // Detecta contexto para citação contextual
    let quoteContext = 'battle_report';
    if (state.history.length === 0) {
      quoteContext = 'first_workout';
    } else if (newAchievements.some(id => id === 'first_pr')) {
      quoteContext = 'new_pr';
    } else if (newAchievements.some(id => id === 'streak_7' || id === 'streak_30' || id === 'streak_100')) {
      quoteContext = 'streak_7';
    } else if (cycleJustCompleted) {
      quoteContext = 'cycle_complete';
    } else {
      const lastEntry = state.history[0];
      if (lastEntry) {
        const daysSince = Math.floor((Date.now() - new Date(lastEntry.date)) / 86400000);
        if (daysSince > 10) quoteContext = 'return_after_pause';
      }
    }
    const quoteObj = getContextualQuote(quoteContext);
    stats.quote       = quoteObj.text;
    stats.quoteAuthor = quoteObj.author ?? null;

    // Reset do ciclo ao dar volta (caso ciclo não tenha slot Off no final)
    const wrapping = nextPos === 0 && cycleOrder.length > 0;

    this.#timer.stop();
    this.#store.setState(s => ({
      history:               newHistory,
      cycleDone:             wrapping ? [] : newCycleDone,
      cycleStart:            wrapping ? null : cycleStart,
      workoutStartTime:      null,
      workoutId:             null,
      // Limpa os logs do treino encerrado — histórico persiste em history[].sets
      logs: { ...s.logs, [w.id]: {} },
      activeModal:           'battle-report',
      modalData:             stats,
      cyclePosition:         nextPos,
      completedCycles:       newCompletedCycles,
      achievements:          newAchievements.length ? [...earned, ...newAchievements] : earned,
      commuteReturnOverride: null,
    }));
  }

  /* ─── RPE por série ─────────────────────────────────────────── */

  saveRPE(wId, exId, idx, rpe) {
    const state   = this.#store.getState();
    const current = state.logs[wId]?.[exId]?.[idx] ?? {};
    const newRpe  = current.rpe === rpe ? null : rpe; // toggle off se mesmo valor
    this.#store.setState(s => ({
      logs: {
        ...s.logs,
        [wId]: {
          ...(s.logs[wId] ?? {}),
          [exId]: {
            ...(s.logs[wId]?.[exId] ?? {}),
            [idx]: { ...current, rpe: newRpe },
          },
        },
      },
    }));
  }

  /* ─── Aquecimento ────────────────────────────────────────────── */

  toggleWarmup(wId, exId, idx) {
    const state   = this.#store.getState();
    const current = state.logs[wId]?.[exId]?.[idx] ?? {};
    this.#store.setState(s => ({
      logs: {
        ...s.logs,
        [wId]: {
          ...s.logs[wId],
          [exId]: {
            ...(s.logs[wId]?.[exId] ?? {}),
            [idx]: { ...current, warmup: !current.warmup },
          },
        },
      },
    }));
  }

  /* ─── Auto-fill ──────────────────────────────────────────────── */

  autoFill(wId, exId) {
    const state       = this.#store.getState();
    const lastSession = state.history.find(h => h.workoutId === wId);
    const lastSets    = lastSession?.sets?.[exId];
    if (!lastSets?.length) return;

    const newExLogs = {};
    lastSets.forEach((set, idx) => {
      if (set && (set.w || set.r)) {
        newExLogs[idx] = { w: set.w ?? '', r: set.r ?? '', done: false };
      }
    });
    if (!Object.keys(newExLogs).length) return;

    this.#store.setState(s => ({
      logs: {
        ...s.logs,
        [wId]: {
          ...(s.logs[wId] ?? {}),
          [exId]: { ...(s.logs[wId]?.[exId] ?? {}), ...newExLogs },
        },
      },
    }));
  }

  autoFillAll(wId) {
    const state = this.#store.getState();
    const last  = state.history.find(h => h.workoutId === wId);
    if (!last?.sets) return;

    const newLogs = { ...(state.logs[wId] ?? {}) };
    for (const [exId, lastSets] of Object.entries(last.sets)) {
      const fill = {};
      (lastSets ?? []).forEach((set, idx) => {
        if (set?.w || set?.r) fill[idx] = { w: set.w ?? '', r: set.r ?? '', done: false };
      });
      if (Object.keys(fill).length)
        newLogs[exId] = { ...(newLogs[exId] ?? {}), ...fill };
    }
    this.#store.setState(s => ({ logs: { ...s.logs, [wId]: newLogs } }));
  }

  /* ─── Resets ──────────────────────────────────────────────────── */

  resetWorkout(wId) {
    this.#store.setState(s => {
      const logs = { ...s.logs };
      delete logs[wId];
      return { logs };
    });
  }

  resetWeek() {
    this.#store.setState({ cycleDone: [], cycleStart: null, cyclePosition: 0 });
  }

  startNewWeek() {
    this.#store.setState({ cycleDone: [], cycleStart: Date.now(), cyclePosition: 0 });
  }

  undoMission(wId) {
    this.#store.setState(s => {
      const done = s.cycleDone ?? [];
      const doneIdx = done.lastIndexOf(wId);
      const cycleDone = doneIdx === -1 ? done : [...done.slice(0, doneIdx), ...done.slice(doneIdx + 1)];
      const histIdx = s.history.findIndex(h => h.workoutId === wId);
      const history = histIdx >= 0
        ? [...s.history.slice(0, histIdx), ...s.history.slice(histIdx + 1)]
        : s.history;
      return { cycleDone, history, cyclePosition: Math.max(0, s.cyclePosition - 1) };
    });
  }

  discardLastWorkout(entryId, wId) {
    this.#store.setState(s => {
      const done = s.cycleDone ?? [];
      const idx = done.lastIndexOf(wId);
      const cycleDone = idx === -1 ? done : [...done.slice(0, idx), ...done.slice(idx + 1)];
      return {
        history:       s.history.filter(h => h.id !== entryId),
        cycleDone,
        cyclePosition: Math.max(0, (s.cyclePosition ?? 0) - 1),
      };
    });
  }

  /* ─── PR tracking ─────────────────────────────────────────────── */

  #checkPR(wId, exId, log) {
    const weight = parseFloat(log.w);
    const reps   = parseFloat(log.r);
    if (!weight || !reps || reps < 1) return;

    const state    = this.#store.getState();
    const current  = state.prs[exId];
    const new1RM   = weight * (1 + reps / 30);
    const curr1RM  = current ? current.weight * (1 + (current.reps ?? 1) / 30) : 0;
    if (!current || new1RM > curr1RM) {
      const earned     = state.achievements ?? [];
      const isFirstPR  = Object.keys(state.prs).length === 0 && !earned.includes('first_pr');
      this.#store.setState(s => ({
        prs: {
          ...s.prs,
          [exId]: { weight, reps, vol: weight * reps, date: new Date().toISOString() },
        },
        ...(isFirstPR ? { achievements: [...earned, 'first_pr'] } : {}),
      }));
    }
  }
}
