import { renderSharingan } from '../components/Sharingan.js';
import { delegate, createRipple } from '../utils/dom.js';
import { SPLIT_TEMPLATES, getTemplateSummary } from '../data/workoutTemplates.js';

export const OB_TOTAL_STEPS = 7;

const GOALS = [
  { id: 'hipertrofia',    icon: 'dumbbell',    label: 'Hipertrofia',     sub: 'Ganho de massa muscular'        },
  { id: 'emagrecimento',  icon: 'flame',        label: 'Emagrecimento',   sub: 'Redução de gordura corporal'    },
  { id: 'recomposicao',   icon: 'repeat',       label: 'Recomposição',    sub: 'Perder gordura e ganhar músculo'},
  { id: 'forca',          icon: 'trending-up',  label: 'Força',           sub: 'Aumentar cargas e PRs'          },
  { id: 'condicionamento',icon: 'wind',         label: 'Condicionamento', sub: 'Resistência e cardio'           },
];

const EXPERIENCE_LEVELS = [
  { id: 'iniciante',     icon: 'zap',         label: 'Iniciante',     sub: 'Menos de 1 ano de treino'   },
  { id: 'intermediario', icon: 'trending-up',  label: 'Intermediário', sub: '1 a 3 anos de treino'       },
  { id: 'avancado',      icon: 'trophy',       label: 'Avançado',      sub: 'Mais de 3 anos de treino'   },
];

const GOAL_LBL       = { hipertrofia: 'Hipertrofia', emagrecimento: 'Emagrecimento', recomposicao: 'Recomposição', forca: 'Força', condicionamento: 'Condicionamento' };
const EXP_LBL        = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' };
const COMMUTE_LBL    = { walk: 'Caminhando', bike: 'Bike' };

const GOAL_TO_STYLE = {
  hipertrofia:    { ids: ['ppl', 'abcd'],          hint: 'PPL e ABCD maximizam volume por grupo muscular — ideal para hipertrofia.'  },
  emagrecimento:  { ids: ['full-body', 'upper-lower'], hint: 'Full Body e Upper/Lower mantêm alta frequência metabólica.'             },
  recomposicao:   { ids: ['upper-lower', 'full-body'], hint: 'Alta frequência semanal por grupo favorece ganho e perda simultâneos.' },
  forca:          { ids: ['upper-lower', 'ppl'],    hint: 'Upper/Lower permite maior frequência nos padrões principais de força.'    },
  condicionamento:{ ids: ['full-body', 'abc'],      hint: 'Full Body com menor volume por sessão deixa mais energia pro cardio.'     },
};

const ACTIVITY_LEVELS = [
  { v: 1.2,   label: 'Sedentário',           sub: 'sem exercício' },
  { v: 1.375, label: 'Levemente ativo',      sub: '1-3x/semana'  },
  { v: 1.55,  label: 'Moderadamente ativo',  sub: '3-5x/semana'  },
  { v: 1.725, label: 'Muito ativo',           sub: '6-7x/semana'  },
  { v: 1.9,   label: 'Extremamente ativo',   sub: '2x/dia'       },
];

/* ─── Helpers ──────────────────────────────────────────────────────── */

function progressBar(step) {
  return `
    <div class="flex items-center justify-center gap-1 mb-8">
      ${Array.from({length: OB_TOTAL_STEPS}, (_, i) => {
        const n = i + 1;
        const active = n === step;
        const done   = n < step;
        return `
          <div class="flex items-center gap-1">
            <div class="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all duration-300 shrink-0
                        ${active ? 'bg-theme-primary text-black shadow-[0_0_8px_var(--theme-primary)]'
                                 : done   ? 'bg-theme-dim border border-theme-accent/60 text-theme-primary'
                                          : 'bg-zinc-900/60 border border-zinc-800 text-zinc-600'}">
              ${done ? `<i data-lucide="check" class="w-3 h-3"></i>` : n}
            </div>
            ${n < OB_TOTAL_STEPS ? `<div class="w-3 h-px transition-all ${done ? 'bg-theme-accent/40' : 'bg-zinc-800'}"></div>` : ''}
          </div>`;
      }).join('')}
    </div>`;
}

const btnNext = (label = 'Continuar') => `
  <button data-action="ob-next"
          class="ripple-target w-full btn-akatsuki py-4 rounded-2xl text-sm font-black uppercase tracking-widest
                 active:scale-[0.98] transition-all mt-8">
    ${label}
  </button>`;

const btnBack = () => `
  <button data-action="ob-back"
          class="ripple-target w-full py-3 text-xs font-bold text-zinc-600 active:opacity-60 transition-all">
    Voltar
  </button>`;

const optionCard = (action, attr, val, active, icon, label, sub = '') => `
  <button data-action="${action}" data-${attr}="${val}"
          class="ripple-target w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all active:scale-[0.98]
                 ${active ? 'bg-theme-dim border-theme-accent' : 'bg-zinc-900/30 border-zinc-800'}">
    <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                ${active ? 'bg-theme-dim/60 border border-theme-accent/50' : 'bg-zinc-800/60 border border-zinc-700/40'}">
      <i data-lucide="${icon}" class="w-4 h-4 ${active ? 'text-theme-primary' : 'text-zinc-500'}"></i>
    </div>
    <div class="min-w-0 flex-1">
      <div class="text-xs font-black uppercase tracking-wider ${active ? 'text-theme-primary' : 'text-zinc-300'}">${label}</div>
      ${sub ? `<div class="text-[9px] text-zinc-600 mt-0.5">${sub}</div>` : ''}
    </div>
    ${active ? `<i data-lucide="check" class="w-4 h-4 text-theme-primary ml-auto shrink-0"></i>` : ''}
  </button>`;

const summaryRow = (icon, label, value, highlight = false) => `
  <div class="flex items-center gap-2.5 py-1.5">
    <i data-lucide="${icon}" class="w-3.5 h-3.5 ${highlight ? 'text-theme-primary' : 'text-theme-primary/60'} shrink-0"></i>
    <span class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider w-28 shrink-0">${label}</span>
    <span class="text-xs ${highlight ? 'text-theme-primary font-black' : 'text-zinc-200 font-bold'} truncate">${value}</span>
  </div>`;

/* ─── Steps ─────────────────────────────────────────────────────────── */

function stepWelcome(data, theme) {
  return `
    <div class="flex flex-col items-center justify-center min-h-screen px-6 py-12 text-center">
      <div class="mb-6">${renderSharingan('w-20 h-20', true, theme)}</div>
      <h1 class="text-3xl font-black uppercase italic text-white tracking-tighter leading-none mb-1">
        Treino Monstro
      </h1>
      <p class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-8">Sistema pessoal de progressão</p>

      <div class="max-w-xs space-y-3 mb-10 text-left">
        ${[
          ['zap',         'Progressão de carga inteligente'],
          ['move',        'Missão completa: treino + deslocamento'],
          ['bar-chart-2', 'Insights personalizados ao seu perfil'],
          ['trophy',      '30+ conquistas e acompanhamento de streak'],
        ].map(([icon, txt]) => `
          <div class="flex items-center gap-2.5">
            <i data-lucide="${icon}" class="w-3.5 h-3.5 text-theme-primary shrink-0"></i>
            <span class="text-[11px] text-zinc-400">${txt}</span>
          </div>`).join('')}
      </div>

      <p class="text-[9px] text-zinc-700 font-mono mb-6">Criação do atleta · ~2 min · só no seu dispositivo</p>

      <button data-action="ob-next"
              class="ripple-target w-full max-w-xs btn-akatsuki py-4 rounded-2xl text-sm font-black uppercase tracking-widest
                     active:scale-[0.98] transition-all shadow-[0_0_24px_rgba(var(--theme-rgb),0.3)]">
        Criar meu Atleta
      </button>
    </div>`;
}

function step1Identity(data) {
  return `
    <div class="px-6 py-8 max-w-sm mx-auto">
      ${progressBar(1)}
      <h2 class="text-xl font-black text-white uppercase italic tracking-tight mb-1">Identidade</h2>
      <p class="text-[10px] text-zinc-500 font-mono mb-6">O atleta que vamos acompanhar</p>

      <div class="space-y-5">
        <div>
          <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Seu nome</label>
          <input id="ob-name" type="text" maxlength="32"
                 value="${data.name || ''}" placeholder="Ex: Cláudio"
                 class="input-ninja w-full py-3 rounded-xl text-sm font-bold px-4" />
        </div>

        <div>
          <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Nome do projeto <span class="text-zinc-700 font-normal normal-case">(opcional)</span></label>
          <input id="ob-project" type="text" maxlength="28"
                 value="${data.projectName || ''}" placeholder="Ex: Guerreiro Absoluto"
                 class="input-ninja w-full py-3 rounded-xl text-sm font-bold px-4 uppercase" />
        </div>

        <div>
          <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-2">Experiência</label>
          <div class="space-y-2">
            ${EXPERIENCE_LEVELS.map(e => {
              const active = data.experience === e.id;
              return `
                <button data-action="ob-set-experience" data-exp="${e.id}"
                        class="ripple-target w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all active:scale-[0.98]
                               ${active ? 'bg-theme-dim border-theme-accent' : 'bg-zinc-900/30 border-zinc-800'}">
                  <i data-lucide="${e.icon}" class="w-3.5 h-3.5 ${active ? 'text-theme-primary' : 'text-zinc-500'} shrink-0"></i>
                  <div class="min-w-0 text-left flex-1">
                    <span class="text-xs font-black uppercase tracking-wider ${active ? 'text-theme-primary' : 'text-zinc-300'}">${e.label}</span>
                    <span class="text-[9px] text-zinc-600 ml-2">${e.sub}</span>
                  </div>
                  ${active ? `<i data-lucide="check" class="w-3.5 h-3.5 text-theme-primary shrink-0"></i>` : ''}
                </button>`;
            }).join('')}
          </div>
        </div>

      </div>

      ${btnNext()}
      ${btnBack()}
    </div>`;
}

function step2Goal(data) {
  const selected = data.goals ?? (data.goal ? [data.goal] : []);
  return `
    <div class="px-6 py-8 max-w-sm mx-auto">
      ${progressBar(2)}
      <h2 class="text-xl font-black text-white uppercase italic tracking-tight mb-1">Objetivo</h2>
      <p class="text-[10px] text-zinc-500 font-mono mb-1">Pode selecionar mais de um</p>
      ${selected.length === 0 ? `<p class="text-[9px] text-yellow-500/80 font-mono mb-4">Selecione pelo menos um objetivo para continuar</p>` : `<p class="text-[9px] text-theme-primary/60 font-mono mb-4">${selected.length} selecionado${selected.length > 1 ? 's' : ''}</p>`}

      <div class="space-y-2">
        ${GOALS.map(g => optionCard('ob-set-goal', 'goal', g.id, selected.includes(g.id), g.icon, g.label, g.sub)).join('')}
      </div>

      ${btnNext()}
      ${btnBack()}
    </div>`;
}

function step3Training(data) {
  const splits = Object.entries(SPLIT_TEMPLATES).map(([id, t]) => ({ id, ...t }));
  splits.push({ id: 'custom', icon: 'pencil', label: 'Personalizado', desc: 'Você cria seus próprios treinos' });

  const selectedGoals = data.goals ?? (data.goal ? [data.goal] : []);
  const goalRec = selectedGoals.length > 0 ? (() => {
    const allIds = [...new Set(selectedGoals.flatMap(g => GOAL_TO_STYLE[g]?.ids ?? []))];
    const hint   = GOAL_TO_STYLE[selectedGoals[0]]?.hint ?? null;
    return { ids: allIds, hint };
  })() : null;
  const goalHintLabel = selectedGoals.map(g => GOAL_LBL[g] ?? g).join(' + ');

  return `
    <div class="px-6 py-8 max-w-sm mx-auto">
      ${progressBar(3)}
      <h2 class="text-xl font-black text-white uppercase italic tracking-tight mb-1">Estrutura de Treino</h2>
      <p class="text-[10px] text-zinc-500 font-mono mb-6">Como você divide seus treinos?</p>

      ${goalRec && !data.trainingStyle ? `
      <div class="flex items-start gap-2.5 bg-theme-dim/40 border border-theme-accent/30 rounded-xl px-3 py-2.5 mb-4">
        <i data-lucide="zap" class="w-3.5 h-3.5 text-theme-primary shrink-0 mt-0.5"></i>
        <p class="text-[10px] text-zinc-300 leading-relaxed">
          <span class="text-theme-primary font-black">Para ${goalHintLabel}:</span> ${goalRec.hint}
        </p>
      </div>` : ''}

      <div class="space-y-2">
        ${splits.map(s => {
          const active  = data.trainingStyle === s.id;
          const suggest = goalRec?.ids.includes(s.id) && !data.trainingStyle;
          return `
            <button data-action="ob-set-training-style" data-style="${s.id}"
                    class="ripple-target w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.98]
                           ${active ? 'bg-theme-dim border-theme-accent' : suggest ? 'bg-zinc-900/50 border-zinc-700' : 'bg-zinc-900/30 border-zinc-800'}">
              <i data-lucide="${s.icon}" class="w-4 h-4 ${active ? 'text-theme-primary' : suggest ? 'text-zinc-400' : 'text-zinc-500'} shrink-0"></i>
              <div class="min-w-0 text-left flex-1">
                <div class="text-xs font-black uppercase tracking-wider ${active ? 'text-theme-primary' : suggest ? 'text-zinc-200' : 'text-zinc-300'}">${s.label}</div>
                <div class="text-[9px] ${active ? 'text-zinc-500' : suggest ? 'text-theme-primary/50' : 'text-zinc-600'} mt-0.5">${suggest ? '★ Recomendado' : s.desc}</div>
              </div>
              ${active  ? `<i data-lucide="check" class="w-3.5 h-3.5 text-theme-primary ml-auto shrink-0"></i>` : ''}
              ${suggest ? `<span class="text-[8px] font-black text-theme-primary/60 border border-theme-accent/30 rounded px-1 py-0.5 ml-auto shrink-0">✓</span>` : ''}
            </button>`;
        }).join('')}
      </div>

      ${data.trainingStyle && data.trainingStyle !== 'custom' ? (() => {
        const summary = getTemplateSummary(data.trainingStyle);
        return `<div class="mt-4 space-y-2">
          ${summary.map(w => `
            <div class="rounded-xl bg-zinc-900/50 border border-zinc-800/50 px-3 py-2.5">
              <div class="text-[9px] font-black text-theme-primary uppercase tracking-widest mb-1">${w.label}</div>
              <div class="text-[9px] text-zinc-600 leading-relaxed font-mono">
                ${w.exNames.join(' · ')}${w.exCount > 4 ? ` · <span class="text-zinc-700">+${w.exCount - 4} exercícios</span>` : ''}
              </div>
            </div>`).join('')}
          <p class="text-[9px] text-zinc-700 font-mono px-1">Editável a qualquer momento no editor de treinos.</p>
        </div>`;
      })() : ''}
      ${data.trainingStyle === 'custom' ? `
      <div class="mt-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-3">
        <p class="text-[9px] text-zinc-600 font-mono leading-relaxed">
          Você criará seus próprios treinos depois de concluir a configuração.
        </p>
      </div>` : ''}

      <p class="text-[9px] text-zinc-700 font-mono text-center mt-4">Pode mudar a qualquer momento nas configurações</p>

      ${btnNext()}
      ${btnBack()}
    </div>`;
}

function step4Frequency(data) {
  const days = data.cycleGoal ?? 4;
  return `
    <div class="px-6 py-8 max-w-sm mx-auto">
      ${progressBar(4)}
      <h2 class="text-xl font-black text-white uppercase italic tracking-tight mb-1">Frequência</h2>
      <p class="text-[10px] text-zinc-500 font-mono mb-8">Quantos treinos por ciclo?</p>

      <div class="text-center mb-8">
        <div class="text-8xl font-black font-mono text-theme-primary leading-none">${days}</div>
        <div class="text-[10px] text-zinc-500 uppercase tracking-widest mt-2">treinos por ciclo</div>
      </div>

      <div class="flex gap-2 justify-center mb-3">
        ${[2,3,4,5,6,7].map(n => `
          <button data-action="ob-set-frequency" data-days="${n}"
                  class="ripple-target w-11 h-11 rounded-xl border text-sm font-black transition-all active:scale-90
                         ${days === n ? 'bg-theme-dim border-theme-accent text-theme-primary' : 'bg-zinc-900/40 border-zinc-800 text-zinc-400'}">
            ${n}
          </button>`).join('')}
      </div>
      <p class="text-[9px] text-zinc-700 font-mono text-center">Define a meta do ciclo de treinos</p>

      ${btnNext()}
      ${btnBack()}
    </div>`;
}

function step5Commute(data) {
  const c = data.commute ?? {};
  const isActive = c.mode === 'walk' || c.mode === 'bike';
  const distKm = Math.round((c.oneWayDistanceKm || 0) * 2 * 10) / 10;
  const dMin = distKm > 0 && c.estimatedSpeed > 0 ? Math.round((distKm / c.estimatedSpeed) * 60) : 0;
  const MET  = c.mode === 'bike' ? 6.0 : 3.5;
  const cal  = dMin > 0 ? Math.round(MET * 80 * (dMin / 60)) : 0;
  const speedPresets = c.mode === 'bike' ? [10, 15, 20] : [3.5, 4.8, 6];

  return `
    <div class="px-6 py-8 max-w-sm mx-auto">
      ${progressBar(5)}
      <h2 class="text-xl font-black text-white uppercase italic tracking-tight mb-1">Rotina</h2>
      <p class="text-[10px] text-zinc-500 font-mono mb-6">Onde e como você treina</p>

      <div class="mb-5">
        <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Academia / Espaço de treino <span class="text-zinc-700 font-normal normal-case">(opcional)</span></label>
        <input id="ob-academy" type="text" maxlength="40"
               value="${data.academyName || ''}" placeholder="Ex: New Life Sport"
               class="input-ninja w-full py-3 rounded-xl text-sm font-bold px-4" />
      </div>

      <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-2">Como você chega lá?</label>

      <div class="grid grid-cols-2 gap-2 mb-5">
        ${[
          { id: 'walk',    icon: 'move',     label: 'Caminhando'        },
          { id: 'bike',    icon: 'activity', label: 'Bicicleta'         },
          { id: 'moto',    icon: 'zap',      label: 'Moto / Carro'      },
          { id: 'transit', icon: 'repeat',   label: 'Transporte público'},
        ].map(opt => `
          <button data-action="ob-set-commute-mode" data-mode="${opt.id}"
                  class="ripple-target flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all active:scale-95
                         ${c.mode === opt.id ? 'bg-theme-dim border-theme-accent' : 'bg-zinc-900/30 border-zinc-800'}">
            <i data-lucide="${opt.icon}" class="w-4 h-4 ${c.mode === opt.id ? 'text-theme-primary' : 'text-zinc-500'}"></i>
            <span class="text-[9px] font-bold uppercase tracking-wider ${c.mode === opt.id ? 'text-theme-primary' : 'text-zinc-500'}">${opt.label}</span>
          </button>`).join('')}
      </div>

      ${isActive ? `
      <div class="space-y-4 pt-4 border-t border-zinc-800/60">
        <div>
          <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Distância de casa à academia (km)</label>
          <input id="ob-commute-km" type="tel" inputmode="decimal"
                 value="${c.oneWayDistanceKm || ''}" placeholder="Ex: 1.1"
                 class="input-ninja w-full py-3 rounded-xl text-sm font-bold text-center" />
        </div>
        <div>
          <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-2">Velocidade média (km/h)</label>
          <div class="flex gap-1.5">
            ${speedPresets.map(spd => `
              <button data-action="ob-set-commute-speed" data-speed="${spd}"
                      class="ripple-target flex-1 py-2.5 rounded-xl border text-[10px] font-black transition-all active:scale-95
                             ${c.estimatedSpeed === spd ? 'bg-theme-dim border-theme-accent text-theme-primary' : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'}">
                ${spd}
              </button>`).join('')}
          </div>
        </div>
        ${cal > 0 ? `
        <div class="rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-3 text-center">
          <p class="text-[10px] text-zinc-400 font-mono">
            Ida + volta: <span class="text-white font-black">${distKm}km</span>
            · <span class="text-white font-black">${dMin}min</span>
            · ~<span class="text-white font-black">${cal}kcal</span>
            <span class="text-zinc-700">(MET)</span>
          </p>
        </div>` : ''}
      </div>` : ''}

      ${btnNext()}
      ${btnBack()}
    </div>`;
}

function renderBMRPreview(bmr, tdee, isKatch) {
  return `
    <div class="rounded-xl bg-theme-dim/20 border border-theme-accent/20 p-3 animate-zoom-in">
      <div class="text-[8px] text-zinc-600 uppercase font-bold tracking-widest mb-2 text-center">Metabolismo Estimado</div>
      <div class="flex justify-around gap-2">
        <div class="text-center">
          <div class="text-xl font-black font-mono text-theme-primary">${bmr.toLocaleString('pt-BR')}</div>
          <div class="text-[8px] text-zinc-600 font-bold uppercase tracking-wider">BMR / dia</div>
        </div>
        <div class="w-px bg-zinc-800/60 self-stretch"></div>
        <div class="text-center">
          <div class="text-xl font-black font-mono text-white">${tdee.toLocaleString('pt-BR')}</div>
          <div class="text-[8px] text-zinc-600 font-bold uppercase tracking-wider">TDEE / dia</div>
        </div>
      </div>
      <div class="text-[8px] text-zinc-700 font-mono text-center mt-2">${isKatch ? 'Katch-McArdle' : 'Mifflin-St Jeor'} · kcal/dia</div>
    </div>`;
}

function step6Physical(data) {
  const hasEval = !!data.hasEval;
  return `
    <div class="px-6 py-8 max-w-sm mx-auto">
      ${progressBar(6)}
      <h2 class="text-xl font-black text-white uppercase italic tracking-tight mb-1">Corpo</h2>
      <p class="text-[10px] text-zinc-500 font-mono mb-6">Medidas para cálculo do seu metabolismo</p>

      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Peso (kg)</label>
            <input id="ob-weight" type="tel" inputmode="decimal"
                   value="${data.weight || ''}" placeholder="Ex: 81"
                   class="input-ninja w-full py-3 rounded-xl text-sm font-bold text-center" />
          </div>
          <div>
            <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Altura (cm)</label>
            <input id="ob-height" type="tel" inputmode="numeric"
                   value="${data.height || ''}" placeholder="Ex: 178"
                   class="input-ninja w-full py-3 rounded-xl text-sm font-bold text-center" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Idade</label>
            <input id="ob-age" type="tel" inputmode="numeric"
                   value="${data.age || ''}" placeholder="Ex: 28"
                   class="input-ninja w-full py-3 rounded-xl text-sm font-bold text-center" />
          </div>
          <div>
            <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-2">Sexo</label>
            <div class="flex gap-1.5">
              ${['M','F'].map(s => `
                <button data-action="ob-set-sex" data-sex="${s}" ${data.sex === s ? 'data-selected="1"' : ''}
                        class="ripple-target flex-1 py-2.5 rounded-xl border text-xs font-black transition-all active:scale-95
                               ${data.sex === s ? 'bg-theme-dim border-theme-accent text-theme-primary' : 'bg-zinc-900/40 border-zinc-800 text-zinc-400'}">
                  ${s === 'M' ? 'Masc' : 'Fem'}
                </button>`).join('')}
            </div>
          </div>
        </div>

        <!-- Toggle: Tenho avaliação física -->
        <button data-action="ob-toggle-eval"
                class="ripple-target w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all active:scale-[0.98]
                       ${hasEval ? 'bg-theme-dim border-theme-accent' : 'bg-zinc-900/30 border-zinc-800'}">
          <div class="flex items-center gap-2.5">
            <i data-lucide="file-text" class="w-4 h-4 ${hasEval ? 'text-theme-primary' : 'text-zinc-500'}"></i>
            <div class="text-left">
              <div class="text-xs font-black uppercase tracking-wider ${hasEval ? 'text-theme-primary' : 'text-zinc-300'}">Tenho avaliação física</div>
              <div class="text-[9px] text-zinc-600 mt-0.5">Preencha com dados da sua ficha</div>
            </div>
          </div>
          <div class="w-10 h-5 rounded-full border transition-all relative shrink-0
                      ${hasEval ? 'bg-theme-primary/20 border-theme-accent' : 'bg-zinc-800 border-zinc-700'}">
            <div class="absolute top-0.5 w-4 h-4 rounded-full transition-all
                        ${hasEval ? 'right-0.5 bg-theme-primary' : 'left-0.5 bg-zinc-600'}"></div>
          </div>
        </button>

        ${hasEval ? `
        <div class="space-y-3 pt-1 border-t border-zinc-800/60 animate-zoom-in">
          <p class="text-[9px] text-zinc-600 font-mono">Dados da avaliação — sobrescrevem a estimativa automática</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">% Gordura</label>
              <input id="ob-body-fat" type="tel" inputmode="decimal"
                     value="${data.bodyFat || ''}" placeholder="Ex: 11.6"
                     class="input-ninja w-full py-3 rounded-xl text-sm font-bold text-center" />
            </div>
            <div>
              <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Massa Magra (kg)</label>
              <input id="ob-lean-mass" type="tel" inputmode="decimal"
                     value="${data.leanMass || ''}" placeholder="Ex: 71.8"
                     class="input-ninja w-full py-3 rounded-xl text-sm font-bold text-center" />
            </div>
          </div>
          <div>
            <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Massa Muscular (kg) <span class="text-zinc-700 font-normal normal-case">(opcional)</span></label>
            <input id="ob-muscle-mass" type="tel" inputmode="decimal"
                   value="${data.muscleMass || ''}" placeholder="Ex: 38.2"
                   class="input-ninja w-full py-3 rounded-xl text-sm font-bold text-center" />
          </div>
        </div>` : ''}
      </div>

      ${(() => {
        const lm = data.leanMass;
        const w = data.weight, h = data.height, age = data.age, sex = data.sex;
        let bmr = null;
        if (lm) bmr = Math.round(370 + 21.6 * lm);
        else if (w && h && age) bmr = Math.round(10 * w + 6.25 * h - 5 * age + (sex === 'F' ? -161 : 5));
        const al   = data.activityLevel ?? 1.55;
        const html = bmr ? renderBMRPreview(bmr, Math.round(bmr * al), !!lm) : '';
        return `<div id="ob-tdee-preview" class="mt-4">${html}</div>`;
      })()}

      <p class="text-[9px] text-zinc-700 font-mono text-center mt-4">Dados ficam apenas neste dispositivo · campos opcionais</p>

      ${btnNext()}
      ${btnBack()}
    </div>`;
}

function step7Activity(data) {
  const cur = data.activityLevel ?? 1.55;
  return `
    <div class="px-6 py-8 max-w-sm mx-auto">
      ${progressBar(7)}
      <h2 class="text-xl font-black text-white uppercase italic tracking-tight mb-1">Nível de Atividade</h2>
      <p class="text-[10px] text-zinc-500 font-mono mb-6">Além dos treinos de musculação</p>

      <div class="space-y-2">
        ${ACTIVITY_LEVELS.map(l => `
          <button data-action="ob-set-activity" data-level="${l.v}"
                  class="ripple-target w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.98]
                         ${cur === l.v ? 'bg-theme-dim border-theme-accent' : 'bg-zinc-900/30 border-zinc-800'}">
            <div>
              <span class="text-xs font-black ${cur === l.v ? 'text-theme-primary' : 'text-zinc-300'}">${l.label}</span>
              <span class="text-[9px] text-zinc-600 ml-2">${l.sub}</span>
            </div>
            ${cur === l.v ? `<i data-lucide="check" class="w-3.5 h-3.5 text-theme-primary shrink-0"></i>` : ''}
          </button>`).join('')}
      </div>

      <div class="mt-5 pt-4 border-t border-zinc-800/60">
        <label class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-2">Vocabulário do app <span class="text-zinc-700 font-normal normal-case">(opcional)</span></label>
        <div class="flex gap-2">
          <button data-action="ob-set-mode" data-mode="ninja"
                  class="ripple-target flex-1 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all active:scale-95
                         ${(data.mode ?? 'ninja') === 'ninja' ? 'bg-theme-dim border-theme-accent text-theme-primary' : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'}">
            <i data-lucide="zap" class="w-3.5 h-3.5 mx-auto mb-1"></i>
            Ninja
          </button>
          <button data-action="ob-set-mode" data-mode="normal"
                  class="ripple-target flex-1 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all active:scale-95
                         ${(data.mode ?? 'ninja') === 'normal' ? 'bg-theme-dim border-theme-accent text-theme-primary' : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'}">
            <i data-lucide="dumbbell" class="w-3.5 h-3.5 mx-auto mb-1"></i>
            Normal
          </button>
        </div>
      </div>

      ${btnNext('Ver meu Atleta')}
      ${btnBack()}
    </div>`;
}

function stepSummary(data) {
  const c = data.commute ?? {};
  const isActiveCommute = c.mode === 'walk' || c.mode === 'bike';
  const actLabel     = ACTIVITY_LEVELS.find(l => l.v === (data.activityLevel ?? 1.55))?.label ?? '—';
  const splitLabel   = data.trainingStyle
    ? (SPLIT_TEMPLATES[data.trainingStyle]?.label ?? 'Personalizado')
    : '—';
  const expLabel     = data.experience ? EXP_LBL[data.experience] : null;

  const sectionHeader = label => `
    <div class="text-[8px] font-black text-zinc-600 uppercase tracking-[0.15em] pt-3 pb-1 border-t border-zinc-800/60 first:border-none first:pt-0">
      ${label}
    </div>`;

  return `
    <div class="px-6 py-8 max-w-sm mx-auto">

      <!-- Header dramático -->
      <div class="text-center mb-8">
        <div class="relative inline-block mb-4">
          <div class="w-16 h-16 rounded-full bg-theme-dim border-2 border-theme-accent flex items-center justify-center mx-auto
                      shadow-[0_0_40px_var(--theme-primary)] animate-pulse">
            <i data-lucide="zap" class="w-8 h-8 text-theme-primary"></i>
          </div>
        </div>
        <div class="text-[8px] text-theme-primary/60 uppercase tracking-[0.3em] font-black mb-1">Sistema de Progressão</div>
        <h2 class="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">Atleta Registrado</h2>
        <p class="text-[10px] text-zinc-500 font-mono mt-2">Perfil criado · pronto para iniciar</p>
      </div>

      <!-- Ficha do atleta -->
      <div class="glass-card rounded-2xl border border-zinc-800/60 overflow-hidden mb-6">

        <!-- Identidade -->
        <div class="px-4 py-3 bg-zinc-900/60">
          ${sectionHeader('Identidade')}
          ${summaryRow('circle-user', 'Nome',       data.name || 'NINJA', true)}
          ${expLabel ? summaryRow('trending-up', 'Nível', expLabel) : ''}
          ${summaryRow('zap',         'Modo',        data.mode === 'ninja' ? 'Ninja' : 'Normal')}
        </div>

        <!-- Objetivo & Treino -->
        <div class="px-4 py-3 border-t border-zinc-800/60">
          ${sectionHeader('Missão')}
          ${(() => { const gs = data.goals ?? (data.goal ? [data.goal] : []); return gs.length ? summaryRow('target', 'Objetivo', gs.map(g => GOAL_LBL[g] ?? g).join(' + '), true) : ''; })()}
          ${data.trainingStyle ? summaryRow('layers', 'Divisão',   splitLabel) : ''}
          ${summaryRow('calendar', 'Ciclo', `${data.cycleGoal ?? 4} treinos`)}
          ${data.trainingStyle && data.trainingStyle !== 'custom' ? (() => {
            const summary = getTemplateSummary(data.trainingStyle);
            return `
              <div class="flex flex-wrap items-center gap-1 mt-2 pt-1.5 border-t border-zinc-800/30">
                ${summary.map((w, i) => `
                  <span class="text-[9px] font-black text-zinc-500 bg-zinc-900/60 border border-zinc-800 px-1.5 py-0.5 rounded font-mono">${w.label}</span>
                  ${i < summary.length - 1 ? `<i data-lucide="chevron-right" class="w-2.5 h-2.5 text-zinc-700 shrink-0"></i>` : ''}
                `).join('')}
              </div>`;
          })() : ''}
        </div>

        <!-- Corpo -->
        ${data.weight || data.bodyFat ? `
        <div class="px-4 py-3 border-t border-zinc-800/60">
          ${sectionHeader('Corpo')}
          ${data.weight   ? summaryRow('dumbbell',    'Peso',        `${data.weight}kg`) : ''}
          ${data.bodyFat  ? summaryRow('activity',    '% Gordura',   `${data.bodyFat}%`) : ''}
          ${data.leanMass ? summaryRow('trending-up', 'Massa Magra', `${data.leanMass}kg`) : ''}
        </div>` : ''}

        <!-- Rotina -->
        <div class="px-4 py-3 border-t border-zinc-800/60">
          ${sectionHeader('Rotina')}
          ${data.academyName ? summaryRow('home',         'Academia',     data.academyName, true) : ''}
          ${isActiveCommute
            ? summaryRow('move', 'Deslocamento', `${COMMUTE_LBL[c.mode]} · ${c.oneWayDistanceKm ?? '—'}km (ida)`)
            : summaryRow('move', 'Deslocamento', 'Veículo / não registrado')}
          ${summaryRow('bar-chart-2', 'Atividade', actLabel)}
        </div>

      </div>

      <button data-action="ob-complete"
              class="ripple-target w-full btn-akatsuki py-4 rounded-2xl text-sm font-black uppercase tracking-widest
                     active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(var(--theme-rgb),0.4)]">
        <i data-lucide="zap" class="w-4 h-4 inline -mt-0.5 mr-1"></i>
        Iniciar minha Jornada
      </button>
      ${btnBack()}
    </div>`;
}

/* ─── Export render ─────────────────────────────────────────────────── */

export function renderOnboarding(step, data, theme = 'default') {
  const steps = [
    stepWelcome,    // 0
    step1Identity,  // 1
    step2Goal,      // 2
    step3Training,  // 3
    step4Frequency, // 4
    step5Commute,   // 5
    step6Physical,  // 6
    step7Activity,  // 7
    stepSummary,    // 8
  ];
  return (steps[step] ?? stepWelcome)(data, theme);
}

/* ─── Mount ─────────────────────────────────────────────────────────── */

export function mountOnboarding(container, handler) {
  // Enter em qualquer input de texto avança para o próximo passo
  container.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('input[type="text"], input[type="tel"]')) {
      e.preventDefault();
      handler('ob-next', container);
    }
  });

  delegate(container, '[data-action="ob-next"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('ob-next', container);
  });

  delegate(container, '[data-action="ob-back"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('ob-back');
  });

  delegate(container, '[data-action="ob-complete"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('ob-complete');
  });

  delegate(container, '[data-action="ob-set-mode"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('ob-set-mode', el.dataset.mode);
  });

  delegate(container, '[data-action="ob-set-experience"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('ob-set-experience', el.dataset.exp);
  });

  delegate(container, '[data-action="ob-set-goal"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('ob-set-goal', el.dataset.goal);
  });

  delegate(container, '[data-action="ob-set-training-style"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('ob-set-training-style', el.dataset.style);
  });

  delegate(container, '[data-action="ob-set-frequency"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('ob-set-frequency', parseInt(el.dataset.days));
  });

  delegate(container, '[data-action="ob-set-commute-mode"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('ob-set-commute-mode', el.dataset.mode);
  });

  delegate(container, '[data-action="ob-set-commute-speed"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('ob-set-commute-speed', parseFloat(el.dataset.speed));
  });

  delegate(container, '[data-action="ob-set-sex"]', 'click', (e, el) => {
    createRipple(e, el);
    container.querySelectorAll('[data-action="ob-set-sex"]').forEach(b => b.removeAttribute('data-selected'));
    el.setAttribute('data-selected', '1');
    handler('ob-set-sex', el.dataset.sex);
  });

  delegate(container, '[data-action="ob-set-activity"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('ob-set-activity', parseFloat(el.dataset.level));
  });

  delegate(container, '[data-action="ob-toggle-eval"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('ob-toggle-eval');
  });

  // Live BMR/TDEE preview — step 6
  container.addEventListener('input', e => {
    const LIVE = new Set(['ob-weight', 'ob-height', 'ob-age', 'ob-body-fat', 'ob-lean-mass']);
    if (!LIVE.has(e.target.id)) return;
    const pv = container.querySelector('#ob-tdee-preview');
    if (!pv) return;
    const get = id => { const v = parseFloat(container.querySelector(`#${id}`)?.value ?? ''); return isNaN(v) ? null : v; };
    const lm  = get('ob-lean-mass');
    const w   = get('ob-weight');
    const h   = get('ob-height');
    const age = get('ob-age');
    const sexEl = container.querySelector('[data-action="ob-set-sex"][data-selected]');
    const sex   = sexEl?.dataset?.sex ?? 'M';
    let bmr = null;
    if (lm) bmr = Math.round(370 + 21.6 * lm);
    else if (w && h && age) bmr = Math.round(10 * w + 6.25 * h - 5 * age + (sex === 'F' ? -161 : 5));
    if (!bmr) { pv.innerHTML = ''; return; }
    pv.innerHTML = renderBMRPreview(bmr, Math.round(bmr * 1.55), !!lm);
    if (window.lucide) lucide.createIcons({ nodes: [pv] });
  });
}
