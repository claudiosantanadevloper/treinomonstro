/**
 * CardioController — lógica de negócio do cardio guiado.
 * Sem acesso ao DOM. Só chama store.setState().
 */

import { checkStreakAchievements } from '../data/achievements.js';
import { getCardioContextualQuote } from '../data/quotes.js';

export class CardioController {
  #store;
  #protocols;

  constructor({ store, protocols }) {
    this.#store = store;
    this.#protocols = protocols;
  }

  // ─── Getters de conveniência ────────────────────────────────────────

  get #state() { return this.#store.getState(); }

  getProtocol(id) {
    return this.#protocols.find(p => p.id === id) ?? null;
  }

  // ─── Iniciar sessão ─────────────────────────────────────────────────

  startProtocol(protocolId, { type = 'corrida', local = null } = {}) {
    const protocol = this.getProtocol(protocolId);
    if (!protocol) return;

    const now = Date.now();
    const session = {
      protocolId,
      type,
      local,
      startTime:      now,
      blockStartTime: now,
      blockIndex:     0,
      blockElapsed:   0,
      totalElapsed:   0,
      totalPausedMs:  0,
      blockPausedMs:  0,
      paused:         false,
      pausedAt:       null,
      gpsPoints:      [],
      distanceM:      0,
    };

    this.#store.setState({ activeCardioSession: session, defaultCardioProtocol: protocolId });
  }

  // ─── Tick (chamado a cada 1s pelo AppController) ────────────────────

  tick() {
    const s = this.#state.activeCardioSession;
    if (!s || s.paused) return;

    const protocol = this.getProtocol(s.protocolId);
    if (!protocol) return;

    const now = Date.now();
    // Reconstituir blockStartTime de sessões antigas sem o campo
    const blockStartTime = s.blockStartTime ?? (now - s.blockElapsed * 1000);
    const totalElapsed   = Math.floor((now - s.startTime - (s.totalPausedMs || 0)) / 1000);
    const blockElapsed   = Math.floor((now - blockStartTime - (s.blockPausedMs || 0)) / 1000);

    // Protocolo livre: nunca avança bloco automaticamente
    if (protocol.id === 'livre') {
      this.#store.setState({
        activeCardioSession: { ...s, blockStartTime, blockElapsed, totalElapsed },
      });
      return;
    }

    const block = protocol.blocks[s.blockIndex];

    // Bloco concluído?
    if (block.duration > 0 && blockElapsed >= block.duration) {
      const nextIndex = s.blockIndex + 1;

      // Protocolo completo
      if (nextIndex >= protocol.blocks.length) {
        this.#store.setState({
          activeCardioSession: { ...s, blockStartTime, blockElapsed, totalElapsed, completed: true },
        });
        return;
      }

      // Avança bloco — novo blockStartTime e zera blockPausedMs
      this.#store.setState({
        activeCardioSession: {
          ...s,
          blockIndex:     nextIndex,
          blockStartTime: now,
          blockPausedMs:  0,
          blockElapsed:   0,
          totalElapsed,
        },
      });
      return;
    }

    this.#store.setState({
      activeCardioSession: { ...s, blockStartTime, blockElapsed, totalElapsed },
    });
  }

  // ─── Controles ──────────────────────────────────────────────────────

  pause() {
    const s = this.#state.activeCardioSession;
    if (!s || s.paused) return;
    this.#store.setState({
      activeCardioSession: { ...s, paused: true, pausedAt: Date.now() },
    });
  }

  resume() {
    const s = this.#state.activeCardioSession;
    if (!s || !s.paused) return;
    const pausedDuration = Date.now() - (s.pausedAt ?? Date.now());
    this.#store.setState({
      activeCardioSession: {
        ...s,
        paused:        false,
        pausedAt:      null,
        totalPausedMs: (s.totalPausedMs || 0) + pausedDuration,
        blockPausedMs: (s.blockPausedMs || 0) + pausedDuration,
      },
    });
  }

  skipBlock() {
    const s = this.#state.activeCardioSession;
    if (!s) return;
    const protocol  = this.getProtocol(s.protocolId);
    if (!protocol) return;
    const nextIndex = s.blockIndex + 1;
    if (nextIndex >= protocol.blocks.length) return;
    this.#store.setState({
      activeCardioSession: {
        ...s,
        blockIndex:     nextIndex,
        blockStartTime: Date.now(),
        blockPausedMs:  0,
        blockElapsed:   0,
      },
    });
  }

  // ─── Atualizar GPS ──────────────────────────────────────────────────

  addGpsPoint(lat, lng, distanceDelta) {
    const s = this.#state.activeCardioSession;
    if (!s || s.paused) return;
    const newDist   = (s.distanceM || 0) + distanceDelta;
    const gpsPoints = [...(s.gpsPoints || []), { lat, lng, t: Date.now() }];
    this.#store.setState({
      activeCardioSession: { ...s, distanceM: newDist, gpsPoints },
    });
  }

  // ─── Feedback de bloco (talk test) ──────────────────────────────────

  addBlockFeedback({ blockIndex, elapsedSec, effortScore = null, talkTest = null }) {
    const s = this.#state.activeCardioSession;
    if (!s) return;
    const existing = (s.blockFeedback ?? []).filter(f => f.blockIndex !== blockIndex);
    this.#store.setState({
      activeCardioSession: {
        ...s,
        blockFeedback: [...existing, { blockIndex, elapsedSec, effortScore, talkTest }],
      },
    });
  }

  // ─── Progressão calculada ────────────────────────────────────────────

  static #computeProgression(newEntry, history) {
    const comparable = history
      .filter(h => h.protocolId === newEntry.protocolId && h.effortScore != null)
      .slice(0, 6);

    if (comparable.length < 2) {
      return { decision: 'repeat', reason: 'baseline_insufficient', confidence: 'low' };
    }

    const scores = [newEntry.effortScore, ...comparable.map(h => h.effortScore)].filter(v => v != null);
    const avg3   = scores.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, scores.length);
    // trend: diferença entre esforço mais recente e mais antigo (negativo = melhora)
    const trend  = scores.length >= 3 ? scores[0] - scores[scores.length - 1] : 0;

    if (avg3 >= 8)
      return { decision: 'reduce',           reason: 'high_perceived_effort',   confidence: 'medium' };
    if (avg3 <= 3 && comparable.length >= 3)
      return { decision: 'increase_duration', reason: 'low_effort_consistent',   confidence: 'medium' };
    if (trend <= -2 && avg3 <= 5 && comparable.length >= 3)
      return { decision: 'increase_speed',   reason: 'effort_declining_at_speed', confidence: 'medium' };
    if (comparable.length >= 3)
      return { decision: 'repeat',           reason: 'stable',                  confidence: 'medium' };
    return   { decision: 'repeat',           reason: 'insufficient_sessions',   confidence: 'low' };
  }

  // ─── Finalizar e salvar ─────────────────────────────────────────────

  finish({ effort, notes = '', distanceOverrideM = null, segments = null, effortScore = null, recovery = null } = {}) {
    const s = this.#state.activeCardioSession;
    if (!s) return null;

    const protocol    = this.getProtocol(s.protocolId);
    const durationMin = s.totalElapsed / 60;
    const local       = s.local;

    // Prioridade: segmentos > distância manual > GPS
    const validSegments = Array.isArray(segments) && segments.length > 0
      ? segments.filter(seg => seg.speedKmh > 0 && seg.durationSec > 0)
      : null;

    let distanceKm, distSource;
    if (validSegments?.length) {
      // Calcular distância a partir dos segmentos: sum(km/h * h)
      distanceKm = validSegments.reduce((acc, seg) => acc + seg.speedKmh * (seg.durationSec / 3600), 0);
      distSource = 'segments';
    } else if (distanceOverrideM != null && distanceOverrideM > 0) {
      distanceKm = distanceOverrideM / 1000;
      distSource = 'manual';
    } else {
      distanceKm = (s.distanceM || 0) / 1000;
      distSource = (s.gpsPoints || []).length > 0 ? 'gps' : 'none';
    }

    let pace = '';
    if (s.type !== 'bike' && distanceKm >= 0.1 && durationMin > 0) {
      const paceDecimal = durationMin / distanceKm;
      const mins  = Math.floor(paceDecimal);
      const secs  = Math.round((paceDecimal - mins) * 60);
      pace = `${mins}:${String(secs).padStart(2, '0')}`;
    }

    const scoreNorm = effortScore != null ? Math.min(10, Math.max(1, Math.round(effortScore))) : null;

    const entry = {
      date:           new Date().toISOString(),
      type:           s.type || 'corrida',
      local:          local ?? null,
      distance:       Math.round(distanceKm * 100) / 100,
      distanceSource: distSource,
      duration:       Math.round(durationMin * 100) / 100,
      pace,
      effort:         effort || (s.protocolId === 'zona2-30' || s.protocolId === 'zona2-45' ? 'moderado' : 'forte'),
      effortScore:    scoreNorm,
      segments:       validSegments ?? null,
      blockFeedback:  (s.blockFeedback ?? []).length > 0 ? s.blockFeedback : null,
      recovery:       recovery ?? null,
      notes,
      protocolId:     s.protocolId,
      protocolName:   protocol?.name ?? 'Livre',
      gpsTracked:     (s.gpsPoints || []).length > 0,
    };

    // Calcular progressão recomendada (precisa de effortScore para ser confiável)
    const progression = scoreNorm != null
      ? CardioController.#computeProgression(entry, this.#state.cardioHistory ?? [])
      : null;
    if (progression) entry.progression = progression;

    const prev = this.#state.cardioHistory || [];
    const cardioHistory = [entry, ...prev].slice(0, 100);

    const prevAchievements = this.#state.achievements || [];
    let achievements = this.#checkAchievements(cardioHistory, prevAchievements);

    // Streak — verifica depois de adicionar a nova sessão ao cardioHistory
    const streakNew = checkStreakAchievements(
      this.#state.history ?? [],
      cardioHistory,
      this.#state.cardioCountsStreak ?? false,
      achievements,
    );
    if (streakNew.length) achievements = [...achievements, ...streakNew];

    this.#store.setState({
      activeCardioSession: null,
      cardioHistory,
      achievements,
    });

    const prevIds = new Set(prevAchievements.map(x => typeof x === 'string' ? x : x?.id));
    const newAchievements = achievements.filter(id => !prevIds.has(id));

    // Detecta contexto para citação contextual
    const paceToMin = (p) => {
      if (!p) return Infinity;
      const [m, sec] = p.split(':').map(Number);
      return m + sec / 60;
    };
    let quoteContext = 'fallback';
    if (prev.length === 0) {
      quoteContext = 'first_cardio';
    } else if (newAchievements.some(id => id === 'cardio_streak' || id.startsWith('cardio_streak'))) {
      quoteContext = 'cardio_streak';
    } else if (entry.protocolId === 'vo2max-4x4') {
      quoteContext = 'zone_master';
    } else if (entry.pace && entry.distance >= 1) {
      const bestPrev = Math.min(...prev.filter(c => c.pace && c.distance >= 1).map(c => paceToMin(c.pace)));
      if (paceToMin(entry.pace) < bestPrev) quoteContext = 'new_pace_record';
    } else if (entry.distance > 0 && entry.distance > Math.max(...prev.map(c => c.distance || 0))) {
      quoteContext = 'new_distance_record';
    } else if (entry.duration > Math.max(...prev.map(c => c.duration || 0))) {
      quoteContext = 'new_duration_record';
    }
    const quoteObj = getCardioContextualQuote(quoteContext);

    return { entry, newAchievements, quote: quoteObj.text, quoteAuthor: quoteObj.author ?? null };
  }

  // ─── Abandonar ──────────────────────────────────────────────────────

  abandon() {
    this.#store.setState({ activeCardioSession: null });
  }

  // ─── Achievements (público: usado pelo log rápido no AppController) ──

  checkAchievementsAfterEntry(cardioHistory) {
    const s = this.#store.getState();
    const prev = s.achievements ?? [];
    let achievements = this.#checkAchievements(cardioHistory, prev);
    const streakNew = checkStreakAchievements(
      s.history ?? [],
      cardioHistory,
      s.cardioCountsStreak ?? false,
      achievements,
    );
    if (streakNew.length) achievements = [...achievements, ...streakNew];
    return achievements;
  }

  // ─── Achievements (privado) ──────────────────────────────────────────

  #checkAchievements(cardioHistory, current) {
    const earned = [...current];

    // Normaliza: aceita tanto strings (WorkoutController) quanto objetos legados
    const hasId = id => earned.some(x => (typeof x === 'string' ? x : x?.id) === id);
    const add = (id) => { if (!hasId(id)) earned.push(id); };

    const totalKm = cardioHistory.reduce((s, c) => s + (c.distance || 0), 0);
    const sessions = cardioHistory.length;
    const hasVo2   = cardioHistory.some(c => c.protocolId === 'vo2max-4x4');
    const bestPace = this.#bestPaceKm(cardioHistory);

    if (sessions >= 1)   add('cardio_first');
    if (sessions >= 5)   add('cardio_5');
    if (sessions >= 10)  add('cardio_10');
    if (sessions >= 25)  add('cardio_25');
    if (sessions >= 50)  add('cardio_50');
    if (totalKm >= 10)   add('cardio_10km');
    if (totalKm >= 50)   add('cardio_50km');
    if (totalKm >= 100)  add('cardio_100km');
    if (totalKm >= 250)  add('cardio_250km');
    if (hasVo2)          add('cardio_vo2_first');
    if (bestPace && bestPace <= 5.0) add('cardio_pace_sub5');
    if (bestPace && bestPace <= 4.5) add('cardio_pace_sub4_5');

    return earned;
  }

  #bestPaceKm(cardioHistory) {
    const paces = cardioHistory
      .filter(c => c.pace && c.distance >= 1)
      .map(c => {
        const parts = c.pace.split(':');
        if (parts.length !== 2) return Infinity;
        return parseInt(parts[0]) + parseInt(parts[1]) / 60;
      })
      .filter(v => isFinite(v) && v > 0);
    return paces.length ? Math.min(...paces) : null;
  }
}
