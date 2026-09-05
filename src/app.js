/**
 * Entry point — instancia todos os serviços, cria o store com
 * estado inicial carregado do localStorage, e inicializa o app.
 */
import { Store }              from './store/store.js';
import { PERSISTED_KEYS }     from './store/persistedKeys.js';
import { StorageService }     from './services/StorageService.js';
import { TimerService }       from './services/TimerService.js';
import { ThemeService }       from './services/ThemeService.js';
import { ExportService }      from './services/ExportService.js';
import { AppController }      from './controllers/AppController.js';
import { WORKOUTS }           from './data/workouts.js';
import { CARDIO_PROTOCOLS }   from './data/cardioProtocols.js';

// ─── Services ────────────────────────────────────────────────────────

const storage = new StorageService('monstro_v2');
const timer   = new TimerService();
const theme   = new ThemeService('default');
const exportSvc = new ExportService();

// ─── Estado inicial (defaults + localStorage) ─────────────────────

const defaults = {
  tab:              'home',
  workoutId:        null,
  logs:             {},
  history:          [],
  cycleDone:        [],
  cycleStart:       null,
  prs:              {},
  theme:            'default',
  workoutStartTime: null,
  activeModal:      null,
  modalData:        null,
  bodyWeights:      [],
  cycleGoal:        6,
  biometrics:       null,
  bioHistory:       [],
  customWorkouts:   [],
  workoutExercises: {},
  appMode:          'ninja',
  userName:         '',
  projectName:      '',
  lightMode:        false,
  activityLevel:    1.55,
  hiddenSections:   [],
  weekPlan:         {},
  circumHistory:    [],
  workoutMeta:      {},
  editorWorkout:    null,
  cycleOrder:       ['1', '2', '3', null, '4', '5', '6', null],
  cyclePosition:    0,
  historyPage:      0,
  inactivityResetDays:   0,
  completedCycles:       0,
  personalGoals:         [],
  achievements:          [],
  cardioHistory:         [],
  defaultRestTime:       60,
  vibrationEnabled:      true,
  timerSoundEnabled:     true,
  weightIncrement:       2.5,
  autoFillOnStart:       false,
  activeCardioSession:   null,
  cardioCountsStreak:    false,
  weeklyCardioKmGoal:    null,
  weeklyCardioMinGoal:   null,
  defaultCardioProtocol: 'zona2-30',
  analyticsTab:          'musculacao',
  notificationsEnabled:  false,
  notificationTime:      '08:00',
  notifLastDate:         null,
  retroLastShown:        null,
  lastCardioMode:        null,
  activeCommute:         { enabled: false, oneWayDistanceKm: 1.1, mode: 'walk', estimatedSpeed: 4.8 },
  commuteReturnOverride: null,
  exerciseNotes:         {},
  onboardingCompleted:   false,
  goal:                  null,
  goals:                 [],
  trainingStyle:         null,
  lastOffDayDate:        null,
};

const persisted = storage.loadState(PERSISTED_KEYS, defaults);
const initialState = { ...defaults, ...persisted };

// ─── Store ────────────────────────────────────────────────────────

const store = new Store(initialState);

// ─── Migração de dados antigos (v1 → v2) ─────────────────────────

(function migrate() {
  const OLD_KEYS = {
    LOGS: 'uchiha_v18_logs',
    HIST: 'uchiha_v18_hist',
    WEEK: 'uchiha_v18_week',
    THEME: 'uchiha_theme',
  };
  const alreadyMigrated = storage.get('migrated_v2');
  if (alreadyMigrated) return;

  const oldLogs  = JSON.parse(localStorage.getItem(OLD_KEYS.LOGS) || 'null');
  const oldHist  = JSON.parse(localStorage.getItem(OLD_KEYS.HIST) || 'null');
  const oldWeek  = JSON.parse(localStorage.getItem(OLD_KEYS.WEEK) || 'null');
  const oldTheme = localStorage.getItem(OLD_KEYS.THEME);

  const patch = {};
  if (oldLogs  && Object.keys(store.getState().logs).length === 0)    patch.logs    = oldLogs;
  if (oldHist  && store.getState().history.length === 0)               patch.history = oldHist;
  if (oldWeek  && store.getState().cycleDone.length === 0)              patch.cycleDone = oldWeek;
  if (oldTheme && store.getState().theme === 'default')                patch.theme   = oldTheme;

  if (Object.keys(patch).length) {
    store.setState(patch);
    console.info('[Migration] Dados v1 migrados com sucesso.');
  }
  storage.set('migrated_v2', true);
})();

// ─── Migração de dados v2 → v3 (renomeação de chaves) ────────────

(function migrateV3() {
  if (storage.get('migrated_v3')) return;
  const oldToNew = {
    week:          'cycleDone',
    weekGoal:      'cycleGoal',
    weekStart:     'cycleStart',
    weekResetDays: 'inactivityResetDays',
  };
  const patch = {};
  for (const [oldKey, newKey] of Object.entries(oldToNew)) {
    const oldValue = storage.get(oldKey, null);
    if (oldValue !== null) {
      patch[newKey] = oldValue;
      storage.remove(oldKey);
    }
  }
  if (Object.keys(patch).length) {
    store.setState(patch);
    console.info('[Migration v3] Chaves renomeadas:', Object.keys(patch).join(', '));
  }
  storage.set('migrated_v3', true);
})();

// ─── Migração ciclo → Push-Legs-Pull com 2x OFF (ordem correta do personal) ──
(function migrateCycleOrder() {
  if (storage.get('migrated_cycle_plp')) return;
  const CORRECT = ['1', '2', '3', null, '4', '5', '6', null];
  const LEGACY  = new Set([
    '[]',
    '["1","2","3","4","5","6"]',
    '["1","3","2","4","6","5"]',
    '["1","3","2","4","6","5",null]',
  ]);
  const raw = JSON.stringify(store.getState().cycleOrder ?? []);
  if (LEGACY.has(raw)) {
    store.setState({ cycleOrder: CORRECT, cyclePosition: 0, cycleDone: [] });
  }
  storage.set('migrated_ppl_order', true);
  storage.set('migrated_off_slot',  true);
  storage.set('migrated_cycle_plp', true);
})();

// ─── App Controller ───────────────────────────────────────────────

const app = new AppController({
  store,
  workouts:        WORKOUTS,
  cardioProtocols: CARDIO_PROTOCOLS,
  timer,
  theme,
  storage,
  exportService:   exportSvc,
});

// ─── Bootstrap ───────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  app.attachGlobalRipple();
  app.init();

  // Vincular botões de navegação (estão no HTML estático)
  document.querySelectorAll('[data-navigate]').forEach(btn => {
    btn.addEventListener('click', () => {
      app.navigate(btn.dataset.navigate);
    });
  });
});
