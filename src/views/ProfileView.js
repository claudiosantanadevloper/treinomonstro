import { renderSharingan } from '../components/Sharingan.js';
import { renderCyberBody } from '../components/CyberBody.js';
import { delegate, createRipple, sectionHideBtn } from '../utils/dom.js';
import { formatDate, formatVolume, formatDuration, getRank } from '../utils/format.js';
import { getLabels } from '../utils/labels.js';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP } from '../data/achievements.js';

/* ─── Helpers ──────────────────────────────────────────────────────── */

function localDateKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

/** Conta semanas consecutivas com pelo menos uma atividade (musculação ou cardio). */
function getWeeklyStreak(history, cardioHistory = [], cardioCountsStreak = false) {
  // Chave = data da segunda-feira da semana (YYYY-MM-DD)
  const mondayKey = (dateStr) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay(); // 0=Dom
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const activeWeeks = new Set([
    ...history.map(h => mondayKey(h.date)),
    ...(cardioCountsStreak ? cardioHistory.map(c => mondayKey(c.date)) : []),
  ]);

  if (!activeWeeks.size) return 0;

  let streak = 0;
  const now = new Date();
  for (let w = 0; w < 104; w++) {
    const d = new Date(now);
    d.setDate(now.getDate() - w * 7);
    if (activeWeeks.has(mondayKey(d.toISOString()))) streak++;
    else break;
  }
  return streak;
}

function getBestStreak(history) {
  if (!history.length) return 0;
  const dates = [...new Set([...history].sort((a, b) => new Date(b.date) - new Date(a.date)).map(h => localDateKey(h.date)))];
  let best = 0, cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = Math.round((new Date(dates[i-1]) - new Date(dates[i])) / 86400000);
    if (diff === 1) { cur++; best = Math.max(best, cur); } else cur = 1;
  }
  return Math.max(best, cur);
}

/* ─── Seção de Avaliação Física ────────────────────────────────────── */

function renderBiometricsSection(bio, bioHistory = [], hiddenSections = []) {
  // Form para inserir nova avaliação
  const form = `
    <details class="group" ${!bio ? 'open' : ''}>
      <summary class="cursor-pointer list-none flex items-center justify-between py-1 select-none">
        <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="clipboard-list" class="w-3.5 h-3.5"></i>
          ${bio ? 'Atualizar Avaliação' : 'Inserir Avaliação'}
        </span>
        <i data-lucide="chevron-down" class="w-4 h-4 text-zinc-600 transition-transform group-open:rotate-180"></i>
      </summary>

      <form data-action="bio-form" class="mt-4 space-y-4">

        <div>
          <p class="text-[9px] text-zinc-600 uppercase font-bold tracking-wider mb-2">Composição</p>
          <div class="grid grid-cols-2 gap-2">
            ${bioField('weight',      'Peso (kg)',        bio?.weight)}
            ${bioField('height',      'Altura (cm)',      bio?.height)}
            ${bioField('bodyFat',     '% Gordura',        bio?.bodyFat)}
            ${bioField('leanMass',    'Massa Magra (kg)', bio?.leanMass)}
            ${bioField('muscleMass',  'Massa Muscular', bio?.muscleMass)}
            ${bioField('boneMass',    'Massa Óssea (kg)', bio?.boneMass)}
            ${bioField('targetWeight','Peso Alvo (kg)',   bio?.targetWeight)}
            ${bioField('targetBodyFat','% Gordura Alvo',  bio?.targetBodyFat)}
          </div>
        </div>

        <div>
          <p class="text-[9px] text-zinc-600 uppercase font-bold tracking-wider mb-2">Circunferências (cm)</p>
          <div class="grid grid-cols-2 gap-2">
            ${bioField('torax',               'Tórax',           bio?.torax)}
            ${bioField('cintura',             'Cintura',         bio?.cintura)}
            ${bioField('abdome',              'Abdome',          bio?.abdome)}
            ${bioField('quadril',             'Quadril',         bio?.quadril)}
            ${bioField('escapular',           'Escapular',       bio?.escapular)}
            ${bioField('bracoDirContraido',   'Braço D (Cont.)', bio?.bracoDirContraido)}
            ${bioField('bracoEsqContraido',   'Braço E (Cont.)', bio?.bracoEsqContraido)}
            ${bioField('bracoDirRelaxado',    'Braço D (Rel.)',  bio?.bracoDirRelaxado)}
            ${bioField('bracoEsqRelaxado',    'Braço E (Rel.)',  bio?.bracoEsqRelaxado)}
            ${bioField('antebracoDireito',    'Antebraço D',     bio?.antebracoDireito)}
            ${bioField('antebracoEsquerdo',   'Antebraço E',     bio?.antebracoEsquerdo)}
            ${bioField('coxaDireita',         'Coxa D',          bio?.coxaDireita)}
            ${bioField('coxaEsquerda',        'Coxa E',          bio?.coxaEsquerda)}
            ${bioField('panturrilhaDireita',  'Panturrilha D',   bio?.panturrilhaDireita)}
            ${bioField('panturrilhaEsquerda', 'Panturrilha E',   bio?.panturrilhaEsquerda)}
          </div>
        </div>

        <div>
          <p class="text-[9px] text-zinc-600 uppercase font-bold tracking-wider mb-2">Dobras Cutâneas — Pollock 7 dobras (mm)</p>
          <div class="grid grid-cols-2 gap-2">
            ${bioField('dobraSubescapular', 'Subescapular', bio?.dobraSubescapular)}
            ${bioField('dobraTricipital',   'Tricipital',   bio?.dobraTricipital)}
            ${bioField('dobraPeitoral',     'Peitoral',     bio?.dobraPeitoral)}
            ${bioField('dobraAxilarMedia',  'Axilar-Média', bio?.dobraAxilarMedia)}
            ${bioField('dobraSupraIliaca',  'Supra-Ilíaca', bio?.dobraSupraIliaca)}
            ${bioField('dobraAbdominal',    'Abdominal',    bio?.dobraAbdominal)}
            ${bioField('dobraCoxa',         'Coxa',         bio?.dobraCoxa)}
          </div>
        </div>

        <button type="submit" data-action="save-biometrics"
                class="ripple-target w-full py-3 bg-theme-primary text-black font-black text-xs
                       uppercase rounded-xl shadow-[0_0_15px_var(--theme-primary)] active:scale-95 transition-all">
          Salvar Avaliação
        </button>

      </form>
    </details>
  `;

  if (!bio) {
    return `
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/60 space-y-3">
        <div class="text-center py-4">
          <div class="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3">
            <i data-lucide="clipboard-list" class="w-6 h-6 text-zinc-600"></i>
          </div>
          <p class="text-xs text-zinc-600 font-mono">Nenhuma avaliação física cadastrada</p>
        </div>
        ${form}
      </div>
    `;
  }

  // Cálculos
  const bmi         = bio.weight && bio.height ? (bio.weight / (bio.height / 100) ** 2).toFixed(1) : null;
  const fatMass     = bio.weight && bio.bodyFat ? (bio.weight * bio.bodyFat / 100).toFixed(2) : null;
  const proteinG    = bio.leanMass ? Math.round(bio.leanMass * 2.0) : null;
  const whratio     = bio.cintura && bio.quadril ? (bio.cintura / bio.quadril).toFixed(2) : null;
  const weightDelta = bio.targetWeight && bio.weight ? (bio.targetWeight - bio.weight).toFixed(2) : null;
  const symScore    = calcSymmetryScore(bio);

  // Assimetrias
  const asymmetries = [];
  const checkAsym = (label, valD, valE, threshold = 1.0) => {
    if (!valD || !valE) return;
    const diff = Math.abs(valD - valE);
    if (diff >= threshold) asymmetries.push({ label, diff: diff.toFixed(1), side: valD > valE ? 'D' : 'E' });
  };
  checkAsym('Braço (contraído)', bio.bracoDirContraido, bio.bracoEsqContraido, 0.5);
  checkAsym('Braço (relaxado)',  bio.bracoDirRelaxado,  bio.bracoEsqRelaxado,  0.5);
  checkAsym('Antebraço',        bio.antebracoDireito,   bio.antebracoEsquerdo, 0.5);
  checkAsym('Coxa',             bio.coxaDireita,        bio.coxaEsquerda,      1.0);
  checkAsym('Panturrilha',      bio.panturrilhaDireita, bio.panturrilhaEsquerda, 0.5);

  // Progressão em relação ao histórico anterior
  const prev = bioHistory[0];
  const weightDeltaVsPrev = prev?.weight && bio.weight ? (bio.weight - prev.weight).toFixed(2) : null;
  const fatDeltaVsPrev    = prev?.bodyFat && bio.bodyFat ? (bio.bodyFat - prev.bodyFat).toFixed(2) : null;

  return `
    <div class="space-y-3">

      <!-- Composição Corporal -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <i data-lucide="layers" class="w-3.5 h-3.5"></i>
            Composição Corporal
          </h3>
          <div class="flex items-center gap-2">
            ${symScore !== null ? `
              <span class="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black
                           ${symScore === 100 ? 'border-green-800/60 bg-green-900/20 text-green-400' : symScore >= 60 ? 'border-yellow-800/60 bg-yellow-900/20 text-yellow-400' : 'border-red-800/60 bg-red-900/20 text-red-400'}">
                <i data-lucide="${symScore === 100 ? 'check-circle' : 'alert-circle'}" class="w-2.5 h-2.5"></i>
                Simetria ${symScore}%
              </span>` : ''}
            ${bio.date ? `<span class="text-[9px] text-zinc-700 font-mono">${formatDate(bio.date)}</span>` : ''}
            ${sectionHideBtn('section-assessment', hiddenSections)}
          </div>
        </div>

        ${hiddenSections.includes('section-assessment') ? '' : `

        <!-- Composição Ring -->
        ${bio.bodyFat && bio.leanMass ? (() => {
          const circumference = 314.16; // 2π × 50
          const fatPct  = bio.bodyFat;
          const leanPct = (100 - bio.bodyFat).toFixed(1);
          const fatArc  = (fatPct / 100 * circumference).toFixed(2);
          const leanArc = (circumference - parseFloat(fatArc)).toFixed(2);
          const fatMassRing = (bio.weight && bio.bodyFat) ? (bio.weight * bio.bodyFat / 100).toFixed(1) : null;
          return `
          <div class="flex items-center gap-4 mb-4">
            <svg width="120" height="120" viewBox="0 0 120 120" class="shrink-0">
              <!-- background ring -->
              <circle cx="60" cy="60" r="50" fill="none" stroke="#27272a" stroke-width="14"/>
              <!-- fat arc (orange) — starts at top via rotate(-90) -->
              <circle cx="60" cy="60" r="50" fill="none" stroke="#f97316" stroke-width="14"
                stroke-dasharray="${fatArc} ${(circumference - parseFloat(fatArc)).toFixed(2)}"
                stroke-dashoffset="0"
                transform="rotate(-90 60 60)"
                stroke-linecap="butt"/>
              <!-- lean arc (theme-primary) — offset by fat arc -->
              <circle cx="60" cy="60" r="50" fill="none" stroke-width="14"
                style="stroke:var(--theme-primary)"
                stroke-dasharray="${leanArc} ${(circumference - parseFloat(leanArc)).toFixed(2)}"
                stroke-dashoffset="${(-parseFloat(fatArc)).toFixed(2)}"
                transform="rotate(-90 60 60)"
                stroke-linecap="butt"/>
              <!-- center label -->
              <text x="60" y="55" text-anchor="middle" fill="#22d3ee" font-size="15" font-weight="900" font-family="monospace">${bio.leanMass}</text>
              <text x="60" y="67" text-anchor="middle" fill="#52525b" font-size="8" font-weight="700" font-family="monospace" letter-spacing="1">kg</text>
              <text x="60" y="78" text-anchor="middle" fill="#3f3f46" font-size="7" font-weight="700" font-family="monospace" letter-spacing="2">MAGRA</text>
            </svg>
            <div class="flex-1 space-y-1.5 text-[10px] font-mono">
              <div>
                <span class="text-orange-400 font-bold">Gordura</span>
                <span class="text-zinc-400 ml-1">${fatMassRing ? fatMassRing + 'kg' : ''} (${fatPct}%)</span>
              </div>
              <div>
                <span class="text-cyan-400 font-bold">Magra</span>
                <span class="text-zinc-400 ml-1">${bio.leanMass}kg (${leanPct}%)</span>
              </div>
              ${bio.targetWeight ? `<div><span class="text-amber-400 font-bold">Meta</span><span class="text-zinc-500 ml-1">${bio.targetWeight}kg</span></div>` : ''}
            </div>
          </div>
          `;
        })() : ''}

        <!-- Grid de métricas -->
        <div class="grid grid-cols-2 gap-2">
          ${[
            { label: 'Peso',       value: bio.weight    ? `${bio.weight}kg` : '—',              delta: weightDeltaVsPrev ? `${parseFloat(weightDeltaVsPrev) > 0 ? '+' : ''}${weightDeltaVsPrev}kg` : null, deltaUp: parseFloat(weightDeltaVsPrev) > 0 },
            { label: '% Gordura',  value: bio.bodyFat   ? `${bio.bodyFat}%` : '—',              delta: fatDeltaVsPrev ? `${parseFloat(fatDeltaVsPrev) > 0 ? '+' : ''}${fatDeltaVsPrev}%` : null, deltaUp: parseFloat(fatDeltaVsPrev) < 0 },
            { label: 'Massa Magra',value: bio.leanMass  ? `${bio.leanMass}kg` : '—' },
            { label: 'Muscular',   value: bio.muscleMass ? `${bio.muscleMass}kg` : '—', accent: true },
            { label: 'Ósseo',      value: bio.boneMass  ? `${bio.boneMass}kg` : '—' },
            { label: 'IMC',        value: bmi           ? bmi : '—' },
          ].map(m => `
            <div class="bg-zinc-900/40 border border-zinc-800/60 px-3 py-2 rounded-xl">
              <div class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">${m.label}</div>
              <div class="text-sm font-black font-mono ${m.accent ? 'text-theme-primary' : 'text-white'} leading-tight">
                ${m.value}
                ${m.delta ? `<span class="text-[9px] font-bold ml-1 ${m.deltaUp ? 'text-green-400' : 'text-red-400'}">${m.delta}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Barra de categoria de gordura -->
        ${bio.bodyFat ? (() => {
          const bf  = bio.bodyFat;
          const min = 3, max = 32;
          const pct = Math.min(100, Math.max(0, ((bf - min) / (max - min)) * 100)).toFixed(1);
          const cats = [
            { label: 'Essen.',   max: 6,  color: '#60a5fa' },
            { label: 'Atlético', max: 14, color: '#4ade80' },
            { label: 'Fitness',  max: 18, color: '#a3e635' },
            { label: 'Aceita.',  max: 25, color: '#fbbf24' },
            { label: 'Obeso',    max: 32, color: '#f87171' },
          ];
          const cat = cats.find(c => bf <= c.max) ?? cats[cats.length - 1];
          return `
          <div class="mt-3 pt-3 border-t border-zinc-800/60">
            <div class="flex justify-between items-center mb-2">
              <span class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Categoria Corporal</span>
              <span class="text-[10px] font-black font-mono" style="color:${cat.color}">${cat.label} · ${bf}%</span>
            </div>
            <div class="relative h-2.5 rounded-full overflow-hidden" style="background:linear-gradient(to right,#60a5fa 0%,#4ade80 20%,#a3e635 40%,#fbbf24 65%,#f87171 100%)">
              <div class="absolute top-0 bottom-0 w-[3px] rounded-full shadow-md" style="left:calc(${pct}% - 1.5px);background:#fff"></div>
            </div>
            <div class="flex justify-between text-[7px] text-zinc-700 font-mono mt-0.5">
              ${cats.map(c => `<span>${c.label}</span>`).join('')}
            </div>
          </div>
          `;
        })() : ''}

        <!-- Metas -->
        ${bio.targetWeight || bio.targetBodyFat ? `
          <div class="mt-3 pt-3 border-t border-zinc-800/60 space-y-2">
            ${bio.targetWeight ? (() => {
              const excess  = +(bio.weight - bio.targetWeight).toFixed(1);
              const isEmagrec = excess > 0;
              const isHiper   = excess < 0;
              return `
                <div>
                  <div class="flex justify-between text-[9px] font-mono mb-1">
                    <span class="text-zinc-500">Peso atual: <span class="font-bold text-white">${bio.weight}kg</span></span>
                    <span class="${isEmagrec ? 'text-orange-400' : isHiper ? 'text-theme-primary' : 'text-green-400'} font-bold">
                      Meta: ${bio.targetWeight}kg
                      ${excess !== 0 ? `(${excess > 0 ? '+' : ''}${excess}kg)` : '✓'}
                    </span>
                  </div>
                  <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    ${isEmagrec
                      ? `<div class="h-full rounded-full shadow-sm" style="width:${Math.min(100,(excess/bio.weight*100)).toFixed(1)}%;background:linear-gradient(90deg,#dc2626,#f97316)"></div>`
                      : `<div class="h-full bg-theme-primary rounded-full shadow-[0_0_4px_var(--theme-primary)]" style="width:${Math.min(100,(bio.weight/bio.targetWeight*100)).toFixed(1)}%"></div>`}
                  </div>
                  ${isEmagrec ? `<div class="text-[8px] font-mono text-zinc-600 mt-1">Em excesso: <span class="text-orange-400 font-bold">+${excess}kg</span> · eliminar gordura com treino + nutrição</div>` : ''}
                </div>`;
            })() : ''}
            ${bio.targetBodyFat && bio.bodyFat ? `
              <div class="text-[9px] font-mono text-zinc-500">
                % Gordura alvo: <span class="text-theme-primary font-bold">${bio.targetBodyFat}%</span>
                ${bio.bodyFat <= bio.targetBodyFat
                  ? '<span class="text-green-400 ml-1">✓ meta atingida</span>'
                  : `<span class="text-orange-400 ml-1">faltam ${(bio.bodyFat - bio.targetBodyFat).toFixed(1)}pp</span>`}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Proteína & RCQ -->
        <div class="mt-3 pt-3 border-t border-zinc-800/60 flex gap-3 flex-wrap">
          ${bio.leanMass ? `
            <div class="flex-1 min-w-0 bg-zinc-900/40 border border-zinc-800/50 px-3 py-2 rounded-xl">
              <div class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1.5">Proteína/dia</div>
              ${[
                { mult: 1.6, label: 'Mín.',  color: 'text-zinc-400' },
                { mult: 2.0, label: 'Rec.',  color: 'text-theme-primary' },
                { mult: 2.2, label: 'Máx.',  color: 'text-green-400' },
              ].map(({ mult, label, color }) => `
                <div class="flex items-center justify-between mb-0.5">
                  <span class="text-[8px] text-zinc-600 font-bold">${mult}g/kg · ${label}</span>
                  <span class="text-[10px] font-black font-mono ${color}">${Math.round(bio.leanMass * mult)}g</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${whratio ? `
            <div class="flex-1 min-w-0 bg-zinc-900/40 border border-zinc-800/50 px-3 py-2 rounded-xl">
              <div class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">RCQ</div>
              <div class="text-sm font-black font-mono ${parseFloat(whratio) < 0.9 ? 'text-green-400' : 'text-orange-400'}">${whratio}</div>
              <div class="text-[8px] text-zinc-600">${parseFloat(whratio) < 0.9 ? 'baixo risco' : 'moderado'}</div>
            </div>
          ` : ''}
        </div>
        `}
      </div>

      <!-- Assimetrias -->
      ${asymmetries.length ? (() => {
        const hiddenAsym = hiddenSections.includes('section-asymmetries');
        return `
        <div class="glass-card p-4 rounded-2xl border border-orange-900/40">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-[10px] font-bold text-orange-400/80 uppercase tracking-widest flex items-center gap-1.5">
              <i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i>
              Assimetrias Detectadas
            </h3>
            ${sectionHideBtn('section-asymmetries', hiddenSections)}
          </div>
          ${hiddenAsym
            ? `<p class="text-[10px] text-orange-900/60 font-mono text-center py-1">${asymmetries.length} assimetria${asymmetries.length > 1 ? 's' : ''} detectada${asymmetries.length > 1 ? 's' : ''}</p>`
            : `<div class="space-y-1.5">
                ${asymmetries.map(a => `
                  <div class="flex justify-between items-center bg-orange-900/10 border border-orange-900/20 px-3 py-2 rounded-lg">
                    <span class="text-xs text-zinc-400">${a.label}</span>
                    <div class="text-right">
                      <span class="text-xs font-bold text-orange-400">+${a.diff}cm</span>
                      <span class="text-[9px] text-zinc-600 ml-1">(lado ${a.side})</span>
                    </div>
                  </div>
                `).join('')}
              </div>
              <p class="text-[9px] text-zinc-600 mt-2">Priorize exercícios unilaterais para equalizar.</p>`
          }
        </div>`;
      })() : ''}

      <!-- Circunferências comparativas -->
      ${hasMeasurements(bio) ? (() => {
        const hiddenMeas = hiddenSections.includes('section-bio-measurements');
        const rows = [
          circumferenceRow('Braço (cont.)', bio.bracoDirContraido, bio.bracoEsqContraido, prev),
          circumferenceRow('Braço (rel.)',  bio.bracoDirRelaxado,  bio.bracoEsqRelaxado,  prev, 'bracoDirRelaxado', 'bracoEsqRelaxado'),
          circumferenceRow('Antebraço',     bio.antebracoDireito,  bio.antebracoEsquerdo, prev, 'antebracoDireito', 'antebracoEsquerdo'),
          circumferenceRow('Coxa',          bio.coxaDireita,       bio.coxaEsquerda,      prev, 'coxaDireita', 'coxaEsquerda'),
          circumferenceRow('Panturrilha',   bio.panturrilhaDireita,bio.panturrilhaEsquerda,prev,'panturrilhaDireita','panturrilhaEsquerda'),
          singleRow('Tórax',   bio.torax,   prev?.torax),
          singleRow('Cintura', bio.cintura, prev?.cintura),
          singleRow('Abdome',  bio.abdome,  prev?.abdome),
          singleRow('Quadril', bio.quadril, prev?.quadril),
        ].filter(Boolean);
        return `
        <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
              <i data-lucide="ruler" class="w-3.5 h-3.5"></i>
              Circunferências
            </h3>
            ${sectionHideBtn('section-bio-measurements', hiddenSections)}
          </div>
          ${hiddenMeas
            ? `<p class="text-[10px] text-zinc-700 font-mono text-center py-1">${rows.length} medidas registradas</p>`
            : `<div class="space-y-2">${rows.join('')}</div>`
          }
        </div>`;
      })() : ''}

      <!-- Dobras Cutâneas -->
      ${hasSkinfolds(bio) ? (() => {
        const hiddenSkin = hiddenSections.includes('section-skinfolds');
        const folds = [
          ['Subescapular', bio.dobraSubescapular],
          ['Tricipital',   bio.dobraTricipital],
          ['Peitoral',     bio.dobraPeitoral],
          ['Axilar-Média', bio.dobraAxilarMedia],
          ['Supra-Ilíaca', bio.dobraSupraIliaca],
          ['Abdominal',    bio.dobraAbdominal],
          ['Coxa',         bio.dobraCoxa],
        ].filter(([, v]) => v);
        const soma   = folds.reduce((acc, [, v]) => acc + v, 0);
        const maxVal = Math.max(...folds.map(([, v]) => v));
        return `
        <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
              <i data-lucide="ruler" class="w-3.5 h-3.5"></i>
              Dobras Cutâneas — Pollock 7
            </h3>
            ${sectionHideBtn('section-skinfolds', hiddenSections)}
          </div>
          ${hiddenSkin
            ? `<p class="text-[10px] text-zinc-700 font-mono text-center py-1">Soma: ${soma}mm · ${folds.length} dobras</p>`
            : `<div class="space-y-1.5 mb-3">
                ${folds.map(([label, val]) => `
                  <div class="flex items-center gap-2">
                    <div class="w-24 shrink-0 text-[10px] text-zinc-400">${label}</div>
                    <div class="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div class="h-full bg-theme-primary/70 rounded-full transition-all duration-700"
                           style="width:${Math.round(val / maxVal * 100)}%"></div>
                    </div>
                    <div class="w-8 text-right text-[10px] font-mono font-bold text-zinc-300">${val}mm</div>
                  </div>
                `).join('')}
              </div>
              <div class="flex justify-between items-center pt-2 border-t border-zinc-800/60">
                <span class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Soma 7 dobras</span>
                <span class="text-sm font-black font-mono text-theme-primary">${soma}mm</span>
              </div>`
          }
        </div>`;
      })() : ''}

      <!-- Exportar PDF -->
      <button data-action="export-bio-pdf"
              class="ripple-target btn-akatsuki w-full active:scale-95 text-xs border-zinc-700 text-zinc-400 hover:text-theme-primary hover:border-theme-accent">
        <i data-lucide="file-down" class="w-4 h-4"></i>
        Exportar Relatório PDF
      </button>

      <!-- Histórico de Avaliações -->
      ${bioHistory.length > 0 ? (() => {
        const hiddenBioHist = hiddenSections.includes('section-bio-history');
        return `
        <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
              <i data-lucide="history" class="w-3.5 h-3.5"></i>
              Histórico de Avaliações (${bioHistory.length})
            </h3>
            ${sectionHideBtn('section-bio-history', hiddenSections)}
          </div>
          ${hiddenBioHist ? '' : (() => {
            const sorted = [...bioHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
            const d = (val, inv = false, dec = 1) => {
              if (val === null || val === undefined) return '';
              const v = +val.toFixed(dec);
              const good = inv ? v < 0 : v > 0;
              const color = Math.abs(v) < 0.05 ? 'text-zinc-600' : good ? 'text-green-400' : 'text-red-400';
              return `<span class="${color} text-[8px] ml-0.5">${v > 0 ? '+' : ''}${v}</span>`;
            };
            return `
            <div class="text-[8px] font-bold text-zinc-700 uppercase tracking-widest grid grid-cols-[3.5rem_1fr_1fr_1fr_1.5rem] gap-x-1 pb-1 border-b border-zinc-800">
              <span>Data</span><span>Peso</span><span>%G</span><span>Magra</span><span></span>
            </div>
            <div class="space-y-0">
              ${sorted.map((b, i) => {
                const prev = sorted[i - 1];
                const dW  = prev?.weight  && b.weight  ? b.weight  - prev.weight  : null;
                const dBF = prev?.bodyFat && b.bodyFat ? b.bodyFat - prev.bodyFat : null;
                const dLM = prev?.leanMass&& b.leanMass? b.leanMass- prev.leanMass: null;
                return `
                <div class="grid grid-cols-[3.5rem_1fr_1fr_1fr_1.5rem] gap-x-1 items-center py-1.5 border-b border-zinc-800/30 last:border-0">
                  <span class="text-[8px] font-mono text-zinc-600 truncate">${formatDate(b.date)}</span>
                  <span class="text-[9px] font-mono text-theme-primary font-bold">${b.weight ?? '—'}kg${d(dW, true)}</span>
                  <span class="text-[9px] font-mono text-orange-400">${b.bodyFat ? b.bodyFat + '%' : '—'}${d(dBF, true)}</span>
                  <span class="text-[9px] font-mono text-zinc-400">${b.leanMass ? b.leanMass + 'kg' : '—'}${d(dLM)}</span>
                  <button data-action="delete-bio-history" data-date="${b.date}"
                          class="p-1 rounded text-zinc-800 hover:text-rose-500 active:scale-90 transition-all">
                    <i data-lucide="trash-2" class="w-2.5 h-2.5"></i>
                  </button>
                </div>`;
              }).join('')}
            </div>`;
          })()}
        </div>`;
      })() : ''}

      <!-- Formulário de atualização -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">${form}</div>

    </div>
  `;
}

function bioField(name, label, value) {
  return `
    <div>
      <label class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider block mb-1">${label}</label>
      <input type="tel" inputmode="decimal" name="${name}"
             value="${value ?? ''}" placeholder="—"
             class="input-ninja w-full py-2.5 rounded-lg text-sm font-bold text-center" />
    </div>
  `;
}

function hasMeasurements(bio) {
  return bio && (bio.bracoDirContraido || bio.coxaDireita || bio.torax || bio.cintura);
}

function hasSkinfolds(bio) {
  return bio && (bio.dobraSubescapular || bio.dobraTricipital || bio.dobraPeitoral || bio.dobraAbdominal);
}

function calcSymmetryScore(bio) {
  if (!bio) return null;
  const checks = [
    { d: bio.bracoDirContraido,  e: bio.bracoEsqContraido,   th: 0.5 },
    { d: bio.bracoDirRelaxado,   e: bio.bracoEsqRelaxado,    th: 0.5 },
    { d: bio.antebracoDireito,   e: bio.antebracoEsquerdo,   th: 0.5 },
    { d: bio.coxaDireita,        e: bio.coxaEsquerda,        th: 1.0 },
    { d: bio.panturrilhaDireita, e: bio.panturrilhaEsquerda, th: 0.5 },
  ].filter(c => c.d && c.e);
  if (!checks.length) return null;
  const perfect = checks.filter(c => Math.abs(c.d - c.e) < c.th).length;
  return Math.round((perfect / checks.length) * 100);
}

function renderBioEvolutionChart(biometrics, bioHistory, hiddenSections = []) {
  const pts = [...(bioHistory || []), biometrics]
    .filter(b => b?.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-8);
  if (pts.length < 2) return '';

  const weights = pts.filter(p => p.weight);
  const fats    = pts.filter(p => p.bodyFat);
  if (!weights.length && !fats.length) return '';

  const hidden = hiddenSections.includes('section-bio-evolution');

  // Mini area sparkline para uma série de pontos
  const sparkline = (data, key, stroke, gradId) => {
    if (data.length < 2) return '';
    const W = 300, H = 62;
    const pL = 30, pR = 8, pT = 6, pB = 14;
    const cW = W - pL - pR, cH = H - pT - pB;
    const n = data.length;
    const values = data.map(p => p[key]);
    const pad = key === 'weight' ? 0.5 : 0.3;
    const vMin = Math.min(...values) - pad;
    const vMax = Math.max(...values) + pad;
    const X = i => pL + (n > 1 ? (i / (n - 1)) * cW : cW / 2);
    const Y = v => pT + cH - ((v - vMin) / (vMax - vMin || 1)) * cH;
    let path = '';
    data.forEach((p, i) => { path += `${path ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p[key]).toFixed(1)} `; });
    const fillPath = `${path.trim()} L${X(n-1).toFixed(1)},${(pT+cH).toFixed(1)} L${X(0).toFixed(1)},${(pT+cH).toFixed(1)} Z`;
    const lx = X(n-1).toFixed(1), ly = Y(data[n-1][key]).toFixed(1);
    const unit = key === 'weight' ? 'kg' : '%';
    const yLabels = [vMax, vMin].map((v, i) => {
      const yy = i === 0 ? pT : pT + cH;
      return `<text x="${pL-3}" y="${(yy+3).toFixed(1)}" text-anchor="end" fill="#3f3f46" font-size="6.5" font-family="monospace">${v.toFixed(1)}</text>`;
    }).join('');
    const firstD = new Date(data[0].date), lastD = new Date(data[n-1].date);
    const fmt = d => `${d.getDate()}/${d.getMonth()+1}`;
    const gridLines = [0, 0.5, 1].map(r =>
      `<line x1="${pL}" y1="${(pT+cH*r).toFixed(1)}" x2="${W-pR}" y2="${(pT+cH*r).toFixed(1)}" stroke="#27272a" stroke-width="0.5" ${r===0.5?'stroke-dasharray="3 3"':''}/>`
    ).join('');
    // Ponto inicial com valor
    const fx = X(0).toFixed(1), fy = Y(data[0][key]).toFixed(1);
    return `
      <svg viewBox="0 0 ${W} ${H}" class="w-full overflow-visible">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${stroke}" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${gridLines}
        ${yLabels}
        <path d="${fillPath}" fill="url(#${gradId})"/>
        <path d="${path.trim()}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${fx}" cy="${fy}" r="2" fill="${stroke}" stroke="#050505" stroke-width="1" opacity="0.5"/>
        <circle cx="${lx}" cy="${ly}" r="3.5" fill="${stroke}" stroke="#050505" stroke-width="1.5"/>
        <text x="${(parseFloat(lx)-5).toFixed(1)}" y="${(parseFloat(ly)-6).toFixed(1)}" text-anchor="end" fill="${stroke}" font-size="8" font-weight="700" font-family="monospace">${data[n-1][key]}${unit}</text>
        <text x="${pL}" y="${H-1}" text-anchor="start" fill="#52525b" font-size="6.5" font-family="monospace">${fmt(firstD)}</text>
        <text x="${W-pR}" y="${H-1}" text-anchor="end" fill="#52525b" font-size="6.5" font-family="monospace">${fmt(lastD)}</text>
      </svg>
    `;
  };

  // Linha de resumo: label + valor atual + delta total
  const summaryRow = (label, data, key, unit, goodDown) => {
    const first = data[0]?.[key], last = data[data.length-1]?.[key];
    const delta = first && last ? parseFloat((last - first).toFixed(1)) : null;
    const isGood = delta !== null ? (goodDown ? delta < 0 : delta > 0) : null;
    return `
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">${label}</span>
        <div class="flex items-center gap-2">
          <span class="text-xs font-black font-mono text-white">${last}${unit}</span>
          ${delta !== null ? `
            <span class="text-[9px] font-bold font-mono ${isGood ? 'text-green-400' : 'text-red-400'}">
              ${delta > 0 ? '+' : ''}${delta}${unit}
            </span>` : ''}
        </div>
      </div>
    `;
  };

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="trending-up" class="w-3.5 h-3.5"></i>
          Evolução — ${pts.length} avaliações
        </h3>
        ${sectionHideBtn('section-bio-evolution', hiddenSections)}
      </div>
      ${hidden
        ? `<p class="text-[10px] text-zinc-700 font-mono text-center py-1">${pts.length} avaliações registradas</p>`
        : `
          ${weights.length >= 2 ? `
            ${summaryRow('Peso', weights, 'weight', 'kg', true)}
            ${sparkline(weights, 'weight', 'var(--theme-primary)', 'lgew')}
          ` : ''}
          ${fats.length >= 2 ? `
            <div class="${weights.length >= 2 ? 'mt-3 pt-3 border-t border-zinc-800/40' : ''}">
              ${summaryRow('% Gordura', fats, 'bodyFat', '%', true)}
              ${sparkline(fats, 'bodyFat', '#f97316', 'lgef')}
            </div>
          ` : ''}
        `
      }
    </div>
  `;
}


const GOAL_META = {
  hipertrofia:     { label: 'Hipertrofia',    delta: +300, protMult: 2.2, color: 'text-green-400',  bg: 'bg-green-900/15',  border: 'border-green-700/40',  note: '+300 kcal' },
  emagrecimento:   { label: 'Emagrecimento',  delta: -400, protMult: 2.4, color: 'text-red-400',    bg: 'bg-red-900/15',    border: 'border-red-700/40',    note: '−400 kcal' },
  recomposicao:    { label: 'Recomposição',   delta:    0, protMult: 2.2, color: 'text-blue-400',   bg: 'bg-blue-900/15',   border: 'border-blue-700/40',   note: 'TDEE manutenção' },
  forca:           { label: 'Força',          delta: +150, protMult: 2.0, color: 'text-orange-400', bg: 'bg-orange-900/15', border: 'border-orange-700/40', note: '+150 kcal' },
  condicionamento: { label: 'Condicionamento',delta: -150, protMult: 1.8, color: 'text-cyan-400',   bg: 'bg-cyan-900/15',   border: 'border-cyan-700/40',   note: '−150 kcal' },
};

function renderTDEECard(bio, activityLevel = 1.55, hiddenSections = [], history = [], activeCommute = null, goal = null) {
  if (!bio?.leanMass) return '';
  const hidden = hiddenSections.includes('section-tdee');
  const bmr  = Math.round(370 + 21.6 * bio.leanMass);
  const tdee = Math.round(bmr * activityLevel);
  const goalMeta = goal ? GOAL_META[goal] : null;
  const goalKcal = goalMeta ? tdee + goalMeta.delta : null;

  // Média diária de calorias de deslocamento (últimos 7 dias com mission.commute registrado)
  const commuteKcalPerDay = (() => {
    if (!activeCommute?.enabled) return 0;
    const cutoff = Date.now() - 7 * 86400000;
    const recent = history.filter(h => new Date(h.date).getTime() >= cutoff && (h.mission?.commute?.calories ?? 0) > 0);
    if (!recent.length) return 0;
    return Math.round(recent.reduce((s, h) => s + h.mission.commute.calories, 0) / 7);
  })();
  const levels = [
    { v: 1.2,   label: 'Sedentário', sub: 'sem exercício' },
    { v: 1.375, label: 'Leve',       sub: '1-3x/semana'  },
    { v: 1.55,  label: 'Moderado',   sub: '3-5x/semana'  },
    { v: 1.725, label: 'Intenso',    sub: '6-7x/semana'  },
    { v: 1.9,   label: 'Atleta',     sub: '2x/dia'       },
  ];

  const goals = [
    { label: 'Deficit',     kcal: tdee - 500, color: 'text-red-400',   bg: 'bg-red-900/15',   note: '−500 kcal' },
    { label: 'Manter',      kcal: tdee,        color: 'text-zinc-300',  bg: 'bg-zinc-800/40',  note: 'manutenção' },
    { label: 'Hipertrofia', kcal: tdee + 300,  color: 'text-green-400', bg: 'bg-green-900/15', note: '+300 kcal' },
  ];

  const macroRow = (kcal, protMult = 2.0) => {
    const proteinG  = bio.leanMass ? Math.round(bio.leanMass * protMult) : 0;
    const fatG      = Math.round(kcal * 0.25 / 9);
    const carbG     = Math.round((kcal - proteinG * 4 - fatG * 9) / 4);
    return `
      <div class="grid grid-cols-3 gap-1 mt-1.5">
        ${[['P', proteinG, 'text-theme-primary'], ['C', carbG, 'text-blue-400'], ['G', fatG, 'text-orange-400']].map(([l, g, c]) => `
          <div class="text-center bg-black/20 rounded-lg py-1">
            <div class="text-[8px] text-zinc-600 font-bold">${l}</div>
            <div class="text-[10px] font-black font-mono ${c}">${g}g</div>
          </div>
        `).join('')}
      </div>
    `;
  };

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="zap" class="w-3.5 h-3.5"></i>
          TDEE — Gasto Calórico
        </h3>
        ${sectionHideBtn('section-tdee', hiddenSections)}
      </div>

      ${hidden ? `<p class="text-[10px] text-zinc-700 font-mono text-center py-1">${tdee.toLocaleString('pt-BR')} kcal/dia · BMR ${bmr} kcal</p>` : `
      <div class="mb-3">
        <label class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider block mb-1.5">Nível de Atividade</label>
        <select data-action="set-activity-level"
                class="input-ninja w-full py-2.5 rounded-lg text-xs font-bold px-3 text-left cursor-pointer">
          ${levels.map(l => `<option value="${l.v}"${activityLevel === l.v ? ' selected' : ''}>${l.label} — ${l.sub}</option>`).join('')}
        </select>
      </div>

      <div class="text-center py-4 mb-3 rounded-xl border border-theme-accent/30"
           style="background:rgba(var(--theme-rgb),0.06)">
        <div class="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Manutenção</div>
        <div class="text-4xl font-black font-mono text-theme-primary">${tdee.toLocaleString('pt-BR')}</div>
        <div class="text-[9px] text-zinc-600 font-mono mt-1">kcal / dia</div>
      </div>

      ${goalMeta ? `
      <div class="mb-3 rounded-xl ${goalMeta.bg} border ${goalMeta.border} p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Objetivo Atual</span>
          <span class="text-[9px] ${goalMeta.color} font-bold uppercase tracking-wider">${goalMeta.label} · ${goalMeta.note}</span>
        </div>
        <div class="flex items-baseline gap-1.5 mb-1">
          <span class="text-2xl font-black font-mono ${goalMeta.color}">${goalKcal.toLocaleString('pt-BR')}</span>
          <span class="text-xs text-zinc-500">kcal/dia</span>
        </div>
        ${macroRow(goalKcal, goalMeta.protMult)}
        <p class="text-[8px] text-zinc-700 font-mono mt-1.5">Proteína ajustada: ${bio.leanMass}kg × ${goalMeta.protMult}g/kg</p>
      </div>` : ''}

      <div class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider mb-1.5${goalMeta ? '' : ' mt-0'}">Referência</div>
      <div class="grid grid-cols-3 gap-2 mb-3">
        ${goals.map(s => `
          <div class="rounded-xl ${goalMeta ? 'bg-black/20' : s.bg} border border-zinc-800/50 p-2.5 ${goalMeta ? 'opacity-60' : ''}">
            <div class="text-[8px] text-zinc-500 uppercase font-bold tracking-wider mb-1">${s.label}</div>
            <div class="text-sm font-black font-mono ${goalMeta ? 'text-zinc-400' : s.color}">${s.kcal.toLocaleString('pt-BR')}</div>
            <div class="text-[8px] text-zinc-700 mb-1">${s.note}</div>
            ${macroRow(s.kcal)}
          </div>
        `).join('')}
      </div>

      <p class="text-[9px] text-zinc-700 font-mono text-center">
        BMR: ${bmr} kcal · Katch-McArdle · ${bio.leanMass}kg massa magra
      </p>
      ${commuteKcalPerDay > 0 ? `
      <div class="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-900/10 border border-cyan-900/30">
        <i data-lucide="move" class="w-3 h-3 text-cyan-500 shrink-0"></i>
        <p class="text-[9px] text-cyan-500 font-mono leading-tight">
          +${commuteKcalPerDay} kcal/dia deslocamento ativo (média 7 dias)
          → total estimado <span class="font-black text-cyan-400">${(tdee + commuteKcalPerDay).toLocaleString('pt-BR')} kcal</span>
        </p>
      </div>` : ''}
      `}
    </div>
  `;
}

function circumferenceRow(label, valD, valE, prev, keyD = 'bracoDirContraido', keyE = 'bracoEsqContraido') {
  if (!valD && !valE) return '';
  const diff   = valD && valE ? Math.abs(valD - valE).toFixed(1) : null;
  const hasAsym = diff && parseFloat(diff) >= 0.5;
  const prevD  = prev?.[keyD];
  const prevE  = prev?.[keyE];
  const deltaD = prevD && valD ? (valD - prevD).toFixed(1) : null;
  return `
    <div class="flex items-center gap-2 text-xs">
      <div class="w-24 shrink-0 text-zinc-400 font-medium">${label}</div>
      <div class="flex-1 flex items-center justify-between gap-1">
        <div class="flex items-center gap-1.5">
          <span class="font-mono text-zinc-300">${valD ?? '—'}cm</span>
          ${deltaD ? `<span class="text-[9px] font-bold ${parseFloat(deltaD) > 0 ? 'text-green-400' : 'text-red-400'}">${parseFloat(deltaD) > 0 ? '+' : ''}${deltaD}</span>` : ''}
          <span class="text-zinc-700">/</span>
          <span class="font-mono text-zinc-400">${valE ?? '—'}cm</span>
        </div>
        ${hasAsym ? `<span class="text-[9px] text-orange-400 font-bold">⚠ ${diff}cm</span>` : '<span class="text-[9px] text-green-500">✓</span>'}
      </div>
    </div>
  `;
}

function singleRow(label, val, prevVal) {
  if (!val) return '';
  const delta = prevVal && val ? (val - prevVal).toFixed(1) : null;
  return `
    <div class="flex items-center gap-2 text-xs">
      <div class="w-24 shrink-0 text-zinc-400 font-medium">${label}</div>
      <div class="flex items-center gap-1.5">
        <span class="font-mono text-zinc-300">${val}cm</span>
        ${delta ? `<span class="text-[9px] font-bold ${parseFloat(delta) > 0 ? 'text-green-400' : 'text-red-400'}">${parseFloat(delta) > 0 ? '+' : ''}${delta}</span>` : ''}
      </div>
    </div>
  `;
}

/* ─── Insights automáticos ─────────────────────────────────────────── */

function renderBioInsights(biometrics, bioHistory = [], bodyWeights = [], hiddenSections = []) {
  const cards = [];
  const prev  = bioHistory[0];

  // Peso — tendência 7d
  if (bodyWeights.length >= 2) {
    const now = Date.now(), d7 = 7 * 86_400_000;
    const recent = bodyWeights.filter(w => now - new Date(w.date).getTime() <= d7);
    const prior  = bodyWeights.filter(w => { const a = now - new Date(w.date).getTime(); return a > d7 && a <= d7 * 2; });
    if (recent.length && prior.length) {
      const avg = arr => arr.reduce((s, w) => s + w.value, 0) / arr.length;
      const d   = parseFloat((avg(recent) - avg(prior)).toFixed(1));
      const up  = d > 0;
      cards.push({ label: 'PESO 7D', value: `${up ? '+' : ''}${d}kg`, context: 'vs semana anterior', color: up ? 'text-red-400' : 'text-green-400', bg: up ? 'border-red-900/40 bg-red-900/10' : 'border-green-900/40 bg-green-900/10' });
    } else if (bodyWeights[0]?.value) {
      cards.push({ label: 'PESO ATUAL', value: `${bodyWeights[0].value}kg`, context: `${bodyWeights.length} registros`, color: 'text-theme-primary', bg: 'border-theme-accent/20 bg-theme-dim/20' });
    }
  }

  // % Gordura
  if (biometrics?.bodyFat && prev?.bodyFat) {
    const d = parseFloat((biometrics.bodyFat - prev.bodyFat).toFixed(1));
    const up = d > 0;
    cards.push({ label: '% GORDURA', value: `${up ? '+' : ''}${d}%`, context: 'vs avaliação anterior', color: up ? 'text-orange-400' : 'text-green-400', bg: up ? 'border-orange-900/40 bg-orange-900/10' : 'border-green-900/40 bg-green-900/10' });
  } else if (biometrics?.bodyFat) {
    cards.push({ label: '% GORDURA', value: `${biometrics.bodyFat}%`, context: 'atual', color: 'text-orange-400', bg: 'border-orange-900/40 bg-orange-900/10' });
  }

  // Massa Magra
  if (biometrics?.leanMass && prev?.leanMass) {
    const d = parseFloat((biometrics.leanMass - prev.leanMass).toFixed(1));
    const up = d >= 0;
    cards.push({ label: 'MASSA MAGRA', value: `${up && d !== 0 ? '+' : ''}${d}kg`, context: 'vs avaliação anterior', color: up ? 'text-green-400' : 'text-red-400', bg: up ? 'border-green-900/40 bg-green-900/10' : 'border-red-900/40 bg-red-900/10' });
  } else if (biometrics?.leanMass) {
    cards.push({ label: 'MASSA MAGRA', value: `${biometrics.leanMass}kg`, context: 'atual', color: 'text-cyan-400', bg: 'border-cyan-900/40 bg-cyan-900/10' });
  }

  // Proteína meta
  if (biometrics?.leanMass) {
    cards.push({ label: 'PROTEÍNA', value: `${Math.round(biometrics.leanMass * 2)}g`, context: 'meta diária', color: 'text-theme-primary', bg: 'border-theme-accent/20 bg-theme-dim/20' });
  }

  // Simetria
  if (biometrics) {
    const pairs = [
      [biometrics.bracoDirContraido, biometrics.bracoEsqContraido, 0.5],
      [biometrics.coxaDireita,       biometrics.coxaEsquerda,       1.0],
      [biometrics.panturrilhaDireita,biometrics.panturrilhaEsquerda, 0.5],
    ];
    const tested = pairs.filter(([d, e]) => d && e).length;
    const asym   = pairs.filter(([d, e, th]) => d && e && Math.abs(d - e) >= th).length;
    if (tested > 0) {
      cards.push({ label: 'SIMETRIA', value: asym === 0 ? '✓ OK' : `${asym} dif.`, context: `${tested} pares avaliados`, color: asym === 0 ? 'text-green-400' : 'text-orange-400', bg: asym === 0 ? 'border-green-900/40 bg-green-900/10' : 'border-orange-900/40 bg-orange-900/10' });
    }
  }

  // IMC
  if (biometrics?.weight && biometrics?.height) {
    const bmi = (biometrics.weight / (biometrics.height / 100) ** 2).toFixed(1);
    const bmiColor = parseFloat(bmi) < 18.5 ? 'text-blue-400' : parseFloat(bmi) < 25 ? 'text-green-400' : parseFloat(bmi) < 30 ? 'text-yellow-400' : 'text-red-400';
    const bmiLabel = parseFloat(bmi) < 18.5 ? 'Abaixo do normal' : parseFloat(bmi) < 25 ? 'Normal' : parseFloat(bmi) < 30 ? 'Sobrepeso' : 'Obeso';
    cards.push({ label: 'IMC', value: bmi, context: bmiLabel, color: bmiColor, bg: 'border-zinc-800/60 bg-zinc-900/20' });
  }

  if (cards.length === 0) return '';

  const hiddenInsights = (hiddenSections ?? []).includes('section-insights');
  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="zap" class="w-3.5 h-3.5"></i>
          Insights
        </h3>
        ${sectionHideBtn('section-insights', hiddenSections ?? [])}
      </div>
      ${hiddenInsights
        ? `<p class="text-[10px] text-zinc-700 font-mono text-center py-1">${cards.length} métricas calculadas</p>`
        : `<div class="grid grid-cols-2 gap-2">
            ${cards.slice(0, 6).map(c => `
              <div class="border ${c.bg} rounded-xl px-3 py-2.5">
                <div class="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mb-1">${c.label}</div>
                <div class="text-[17px] font-black font-mono ${c.color} leading-none">${c.value}</div>
                <div class="text-[8px] text-zinc-600 font-mono mt-1 leading-tight">${c.context}</div>
              </div>
            `).join('')}
          </div>`
      }
    </div>
  `;
}

/* ─── Gráfico de Composição Corporal ───────────────────────────────── */

function renderBodyCompositionChart(biometrics, bioHistory = [], hiddenSections = []) {
  const all = [
    ...bioHistory.filter(b => b.date && b.weight && b.leanMass),
    (biometrics?.date && biometrics?.weight && biometrics?.leanMass) ? biometrics : null,
  ].filter(Boolean).sort((a, b) => new Date(a.date) - new Date(b.date));

  if (all.length < 1) return '';

  const W = 300, H = 120, pL = 28, pR = 12, pT = 14, pB = 20;
  const cW = W - pL - pR, cH = H - pT - pB;
  const n  = all.length;

  const vMin = Math.min(...all.map(p => p.leanMass)) - 1;
  const vMax = Math.max(...all.map(p => p.weight))   + 1;
  const X = i => pL + (n > 1 ? (i / (n - 1)) * cW : cW / 2);
  const Y = v => pT + cH - ((v - vMin) / (vMax - vMin || 1)) * cH;

  let wPath = '', lPath = '';
  all.forEach((p, i) => {
    wPath += `${wPath ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.weight).toFixed(1)} `;
    lPath += `${lPath ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.leanMass).toFixed(1)} `;
  });

  const last = all[n - 1];
  const fmt  = d => { const dt = new Date(d); return `${dt.getDate()}/${dt.getMonth() + 1}`; };
  const fatPct = last.weight > 0 ? ((last.weight - last.leanMass) / last.weight * 100).toFixed(1) : null;

  // Gradient fill area under lean mass line (closed to bottom)
  const leanFillPath = n > 1
    ? `${lPath.trim()} L${X(n-1).toFixed(1)},${(pT + cH).toFixed(1)} L${X(0).toFixed(1)},${(pT + cH).toFixed(1)} Z`
    : `M${X(0).toFixed(1)},${Y(last.leanMass).toFixed(1)} L${X(0).toFixed(1)},${(pT + cH).toFixed(1)} Z`;

  // 4 grid lines (0, 0.33, 0.66, 1)
  const gridLines = [0, 1/3, 2/3, 1].map(r =>
    `<line x1="${pL}" y1="${(pT + cH * r).toFixed(1)}" x2="${W - pR}" y2="${(pT + cH * r).toFixed(1)}" stroke="#27272a" stroke-width="0.5" ${r === 1/3 || r === 2/3 ? 'stroke-dasharray="3 3"' : ''}/>`
  ).join('');

  // Y-axis labels (4 ticks)
  const yLabels = [vMax, vMin + (vMax - vMin) * 2/3, vMin + (vMax - vMin) / 3, vMin].map((v, i) => {
    const yy = i === 0 ? pT : i === 1 ? pT + cH/3 : i === 2 ? pT + cH*2/3 : pT + cH;
    return `<text x="${pL - 3}" y="${(yy + 3).toFixed(1)}" text-anchor="end" fill="#3f3f46" font-size="7" font-family="monospace">${v.toFixed(0)}</text>`;
  }).join('');

  // Target weight dashed line
  const targetLine = biometrics?.targetWeight && biometrics.targetWeight >= vMin && biometrics.targetWeight <= vMax
    ? `<line x1="${pL}" y1="${Y(biometrics.targetWeight).toFixed(1)}" x2="${W - pR}" y2="${Y(biometrics.targetWeight).toFixed(1)}" stroke="#fbbf24" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>
       <text x="${(pL + 2).toFixed(1)}" y="${(Y(biometrics.targetWeight) - 2).toFixed(1)}" fill="#fbbf24" font-size="6.5" font-family="monospace" opacity="0.8">meta</text>`
    : '';

  // Value labels at last point — weight above, lean below (avoid overlap)
  const lastX = X(n - 1).toFixed(1);
  const wY    = Y(last.weight).toFixed(1);
  const lY    = Y(last.leanMass).toFixed(1);
  const weightLabel = `<text x="${lastX}" y="${(parseFloat(wY) - 5).toFixed(1)}" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="8" font-weight="700" font-family="monospace">${last.weight.toFixed(1)}kg</text>`;
  const leanLabel   = `<text x="${lastX}" y="${(parseFloat(lY) + 13).toFixed(1)}" text-anchor="middle" fill="#22d3ee" font-size="8" font-weight="700" font-family="monospace">${last.leanMass.toFixed(1)}kg</text>`;

  // Single-point fallback (dot only, no line)
  const chartPaths = n === 1
    ? `<circle cx="${X(0).toFixed(1)}" cy="${Y(last.weight).toFixed(1)}" r="3" fill="rgba(255,255,255,0.6)" stroke="#050505" stroke-width="1"/>
       <circle cx="${X(0).toFixed(1)}" cy="${Y(last.leanMass).toFixed(1)}" r="3" fill="#22d3ee" stroke="#050505" stroke-width="1"/>`
    : `<path d="${leanFillPath}" fill="url(#lgbc)" opacity="0.9"/>
       <path d="${wPath.trim()}" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
       <path d="${lPath.trim()}" fill="none" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 2"/>
       <circle cx="${lastX}" cy="${wY}" r="3" fill="white" stroke="#050505" stroke-width="1"/>
       <circle cx="${lastX}" cy="${lY}" r="3" fill="#22d3ee" stroke="#050505" stroke-width="1"/>`;

  // Date labels
  const dateLabels = n === 1
    ? `<text x="${X(0).toFixed(1)}" y="${H - 4}" text-anchor="middle" fill="#52525b" font-size="7" font-family="monospace">${fmt(all[0].date)}</text>`
    : `<text x="${pL}" y="${H - 4}" text-anchor="start" fill="#52525b" font-size="7" font-family="monospace">${fmt(all[0].date)}</text>
       <text x="${W - pR}" y="${H - 4}" text-anchor="end" fill="#52525b" font-size="7" font-family="monospace">${fmt(last.date)}</text>`;

  // % body fat right-side axis label (vertical)
  const fatLabel = (last.bodyFat || fatPct)
    ? `<text x="${W - 3}" y="${(pT + cH / 2).toFixed(1)}" text-anchor="middle" fill="#71717a" font-size="7" font-family="monospace" transform="rotate(90 ${W - 3} ${(pT + cH / 2).toFixed(1)})">Gord ${last.bodyFat ? last.bodyFat + '%' : fatPct + '%'}</text>`
    : '';

  const hiddenChart = hiddenSections.includes('section-bio-chart');

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="bar-chart-2" class="w-3.5 h-3.5"></i>
          Composição Corporal
        </h3>
        <div class="flex items-center gap-2">
          ${!hiddenChart ? `<span class="flex items-center gap-2 text-[8px] font-mono">
            <span class="text-white/50">— peso</span>
            <span class="text-cyan-400/70">-- magra</span>
            ${biometrics?.targetWeight ? '<span class="text-amber-400/70">-- meta</span>' : ''}
          </span>` : ''}
          ${sectionHideBtn('section-bio-chart', hiddenSections)}
        </div>
      </div>
      ${hiddenChart ? `<p class="text-[10px] text-zinc-700 font-mono text-center py-1">${all.length} avaliações · ${last.weight?.toFixed(1)}kg atual</p>` : `
      <svg viewBox="0 0 ${W} ${H}" class="w-full overflow-visible mb-1">
        <defs>
          <linearGradient id="lgbc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${gridLines}
        ${yLabels}
        ${targetLine}
        ${chartPaths}
        ${n > 1 ? weightLabel : ''}
        ${n > 1 ? leanLabel : ''}
        ${dateLabels}
        ${fatLabel}
      </svg>
      <div class="flex justify-between text-[9px] font-mono mt-1">
        <div>
          <span class="text-zinc-500">Peso: </span><span class="text-white font-bold">${last.weight.toFixed(1)}kg</span>
          <span class="text-zinc-600 mx-2">·</span>
          <span class="text-zinc-500">Magra: </span><span class="text-cyan-400 font-bold">${last.leanMass.toFixed(1)}kg</span>
        </div>
        ${fatPct ? `<span class="text-zinc-600">Gord: ${fatPct}%</span>` : ''}
      </div>
      `}
    </div>
  `;
}

/* ─── Seção Peso Corporal ──────────────────────────────────────────── */

function renderBodyWeightChart(bodyWeights) {
  const pts = [...bodyWeights].reverse().slice(0, 30);
  if (pts.length < 2) return '';

  const W = 300, H = 96;
  const pL = 28, pR = 8, pT = 10, pB = 18;
  const cW = W - pL - pR, cH = H - pT - pB;

  const values = pts.map(p => p.value);
  const vMin = Math.min(...values) - 0.5;
  const vMax = Math.max(...values) + 0.5;
  const n = pts.length;

  const X = i => pL + (n > 1 ? (i / (n - 1)) * cW : cW / 2);
  const Y = v => pT + cH - ((v - vMin) / (vMax - vMin || 1)) * cH;

  let path = '';
  pts.forEach((p, i) => { path += `${path ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.value).toFixed(1)} `; });

  const last  = pts[n - 1];
  const first = pts[0];
  const trend = last.value - first.value;
  const stroke = trend > 0.3 ? '#f87171' : trend < -0.3 ? '#4ade80' : 'var(--theme-primary)';

  const fillPath = `${path.trim()} L${X(n-1).toFixed(1)},${(pT + cH).toFixed(1)} L${X(0).toFixed(1)},${(pT + cH).toFixed(1)} Z`;

  const lx = X(n - 1).toFixed(1), ly = Y(last.value).toFixed(1);

  const gridLines = [0, 0.5, 1].map(r =>
    `<line x1="${pL}" y1="${(pT + cH * r).toFixed(1)}" x2="${W - pR}" y2="${(pT + cH * r).toFixed(1)}" stroke="#27272a" stroke-width="0.5" ${r === 0.5 ? 'stroke-dasharray="3 3"' : ''}/>`
  ).join('');

  const yLabels = [vMax, (vMin + vMax) / 2, vMin].map((v, i) => {
    const yy = i === 0 ? pT : i === 1 ? pT + cH / 2 : pT + cH;
    return `<text x="${pL - 3}" y="${(yy + 3).toFixed(1)}" text-anchor="end" fill="#3f3f46" font-size="7" font-family="monospace">${v.toFixed(1)}</text>`;
  }).join('');

  const firstD = new Date(first.date);
  const lastD  = new Date(last.date);
  const fmt = d => `${d.getDate()}/${d.getMonth() + 1}`;

  const maPath = (() => {
    const WINDOW = 5;
    let mp = '';
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - Math.floor(WINDOW / 2));
      const end   = Math.min(n, start + WINDOW);
      const avg   = pts.slice(start, end).reduce((s, p) => s + p.value, 0) / (end - start);
      mp += `${mp ? 'L' : 'M'}${X(i).toFixed(1)},${Y(avg).toFixed(1)} `;
    }
    return mp.trim();
  })();

  return `
    <svg viewBox="0 0 ${W} ${H}" class="w-full overflow-visible mb-2">
      <defs>
        <linearGradient id="lgbw" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${stroke}" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      ${yLabels}
      <path d="${fillPath}" fill="url(#lgbw)"/>
      <path d="${path.trim()}" fill="none" stroke="${stroke}" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
      <path d="${maPath}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lx}" cy="${ly}" r="3" fill="${stroke}" stroke="#050505" stroke-width="1.5"/>
      <text x="${(parseFloat(lx) - 4).toFixed(1)}" y="${(parseFloat(ly) - 6).toFixed(1)}" text-anchor="end" fill="${stroke}" font-size="8" font-weight="700" font-family="monospace">${last.value}kg</text>
      <text x="${pL}" y="${H - 2}" text-anchor="start" fill="#52525b" font-size="7" font-family="monospace">${fmt(firstD)}</text>
      <text x="${W - pR}" y="${H - 2}" text-anchor="end" fill="#52525b" font-size="7" font-family="monospace">${fmt(lastD)}</text>
    </svg>
  `;
}

function renderBodyWeightSection(bodyWeights = [], hiddenSections = []) {
  const recent  = bodyWeights.slice(0, 5);
  const delta   = recent.length >= 2 ? (recent[0].value - recent[recent.length - 1].value).toFixed(1) : null;
  const hidden  = hiddenSections.includes('section-weight');

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="activity" class="w-3.5 h-3.5"></i>
          Peso Corporal
          ${delta !== null ? `<span class="ml-2 font-bold text-[10px] ${parseFloat(delta) < 0 ? 'text-green-400' : parseFloat(delta) > 0 ? 'text-red-400' : 'text-zinc-500'}">${parseFloat(delta) > 0 ? '+' : ''}${delta}kg</span>` : ''}
        </h3>
        ${sectionHideBtn('section-weight', hiddenSections)}
      </div>
      ${hidden ? '' : `
      <div class="flex gap-2 mb-3">
        <input type="tel" inputmode="decimal" id="weight-input"
               placeholder="81.5"
               class="input-ninja flex-1 py-3 rounded-lg text-sm font-bold text-center" />
        <button data-action="save-weight"
                class="ripple-target px-4 py-3 bg-theme-dim border border-theme-accent text-theme-primary
                       text-xs font-black rounded-lg active:scale-95 uppercase tracking-wider transition-all">
          LOG
        </button>
      </div>
      ${bodyWeights.length >= 2 ? renderBodyWeightChart(bodyWeights) : ''}
      ${bodyWeights.length > 300 ? `
        <p class="text-[9px] text-orange-400/80 font-mono text-center py-1">
          ${bodyWeights.length}/365 registros — entradas antigas são removidas automaticamente
        </p>` : ''}
      ${recent.length === 0
        ? `<p class="text-[10px] text-zinc-700 text-center font-mono py-1">Nenhum registro ainda</p>`
        : `<div class="space-y-1">
            ${recent.map((w, i) => `
              <div class="flex items-center gap-2 ${i === 0 ? '' : 'opacity-60'}">
                <span class="text-[10px] font-mono text-zinc-500 flex-1">${formatDate(w.date)}</span>
                <span class="text-sm font-black font-mono ${i === 0 ? 'text-theme-primary' : 'text-zinc-400'}">${w.value}kg</span>
                <button data-action="delete-weight" data-date="${w.date}"
                        class="w-6 h-6 flex items-center justify-center rounded text-zinc-700
                               hover:text-red-400 hover:bg-red-900/20 transition-all active:scale-90 shrink-0">
                  <i data-lucide="x" class="w-3 h-3 pointer-events-none"></i>
                </button>
              </div>
            `).join('')}
           </div>`}
      `}
    </div>
  `;
}

/* ─── Circunferências Rápidas ──────────────────────────────────────── */

function renderCircumSparklines(circumHistory) {
  const pts = [...circumHistory].reverse().slice(0, 12);
  if (pts.length < 3) return '';

  const TRACKS = [
    { key: 'bracoD',      label: 'Braço D',   color: 'var(--theme-primary)' },
    { key: 'cintura',     label: 'Cintura',    color: '#f97316' },
    { key: 'coxaD',       label: 'Coxa D',     color: '#a78bfa' },
  ];

  const W = 80, H = 32;
  const spark = (key, stroke) => {
    const vals = pts.map(p => parseFloat(p[key])).filter(v => !isNaN(v));
    if (vals.length < 2) return `<span class="text-[9px] text-zinc-700 font-mono">—</span>`;
    const n = vals.length;
    const vMin = Math.min(...vals), vMax = Math.max(...vals);
    const range = vMax - vMin || 1;
    const X = i => ((i / (n - 1)) * W).toFixed(1);
    const Y = v => (H - 2 - ((v - vMin) / range) * (H - 4)).toFixed(1);
    let path = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(i)},${Y(v)}`).join(' ');
    const lastVal = vals[n - 1];
    const trend = lastVal - vals[0];
    const col = trend < -0.3 ? '#4ade80' : trend > 0.3 ? '#f87171' : stroke;
    return `<svg viewBox="0 0 ${W} ${H}" class="w-20 h-8 shrink-0">
      <path d="${path}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
      <circle cx="${X(n-1)}" cy="${Y(lastVal)}" r="2.5" fill="${col}" stroke="#050505" stroke-width="1"/>
    </svg>`;
  };

  return `
    <div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-800/60">
      ${TRACKS.map(({ key, label, color }) => {
        const vals = pts.map(p => parseFloat(p[key])).filter(v => !isNaN(v));
        const last = vals[0];
        const prev = vals[1];
        const delta = (last != null && prev != null) ? (last - prev).toFixed(1) : null;
        const deltaColor = delta === null ? '' : parseFloat(delta) < 0 ? 'text-green-400' : parseFloat(delta) > 0 ? 'text-red-400' : 'text-zinc-500';
        return `
          <div class="flex flex-col items-center gap-1 bg-black/20 rounded-xl px-2 py-2">
            <span class="text-[8px] font-bold text-zinc-600 uppercase tracking-wide">${label}</span>
            ${spark(key, color)}
            <div class="flex items-baseline gap-1">
              <span class="text-[10px] font-black font-mono text-white">${last != null ? last.toFixed(1) : '—'}</span>
              <span class="text-[8px] text-zinc-600">cm</span>
              ${delta !== null ? `<span class="text-[8px] font-bold ${deltaColor}">${parseFloat(delta) > 0 ? '+' : ''}${delta}</span>` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>
  `;
}

function renderCircumSection(circumHistory = [], hiddenSections = []) {
  const recent = circumHistory.slice(0, 5);
  const LABELS = { bracoD: 'Braço D', bracoE: 'Braço E', torax: 'Tórax', cintura: 'Cintura', coxaD: 'Coxa D', coxaE: 'Coxa E', panturrilhaD: 'Panturrilha D', panturrilhaE: 'Panturrilha E' };
  const KEYS   = Object.keys(LABELS);
  const hidden = hiddenSections.includes('section-circum');

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="ruler" class="w-3.5 h-3.5"></i>
          Circunferências Rápidas
        </h3>
        ${sectionHideBtn('section-circum', hiddenSections)}
      </div>
      ${hidden ? '' : `
      <details class="group" ${!recent.length ? 'open' : ''}>
        <summary class="cursor-pointer list-none flex items-center gap-2 py-1 select-none">
          <i data-lucide="plus-circle" class="w-3.5 h-3.5 text-zinc-600 group-open:hidden"></i>
          <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-zinc-600 hidden group-open:block transition-transform"></i>
          <span class="text-[10px] text-zinc-500 font-bold">Registrar medidas</span>
        </summary>
        <form data-action="circum-form" class="mt-3 space-y-2">
          <div class="grid grid-cols-2 gap-2">
            ${KEYS.map(key => `
              <div>
                <label class="text-[9px] text-zinc-600 font-bold block mb-0.5">${LABELS[key]} (cm)</label>
                <input type="tel" inputmode="decimal" name="${key}" placeholder="—"
                       class="input-ninja w-full py-2 rounded-lg text-xs font-bold text-center" />
              </div>`).join('')}
          </div>
          <button type="button" data-action="save-circum"
                  class="ripple-target w-full py-2.5 bg-theme-dim border border-theme-accent rounded-xl
                         text-theme-primary text-xs font-black uppercase tracking-wider active:scale-95 transition-all mt-1">
            <i data-lucide="check" class="w-3.5 h-3.5 inline mr-1"></i>Registrar
          </button>
        </form>
      </details>
      ${circumHistory.length >= 3 ? renderCircumSparklines(circumHistory) : ''}
      ${recent.length > 0 ? `
        <div class="mt-3 ${circumHistory.length < 3 ? 'border-t border-zinc-800/60 pt-3' : 'pt-1'}">
          <div class="overflow-x-auto no-scrollbar">
            <table class="w-full text-[9px] font-mono">
              <thead><tr class="text-zinc-600 uppercase">
                <th class="text-left pb-1.5 font-bold pr-2">Data</th>
                <th class="text-center pb-1.5 font-bold">B.D</th>
                <th class="text-center pb-1.5 font-bold">Tórax</th>
                <th class="text-center pb-1.5 font-bold">Cin.</th>
                <th class="text-center pb-1.5 font-bold">Coxa</th>
              </tr></thead>
              <tbody>
                ${recent.map((e, i) => {
                  const prev = recent[i + 1];
                  const delta = (f) => {
                    if (!prev || !e[f] || !prev[f]) return '';
                    const d = (e[f] - prev[f]);
                    const s = d.toFixed(1);
                    return d > 0 ? `<span class="text-green-500/70">+${s}</span>` : d < 0 ? `<span class="text-red-400/70">${s}</span>` : '';
                  };
                  return `<tr class="${i === 0 ? 'text-white' : 'text-zinc-500 opacity-60'}">
                    <td class="py-0.5 pr-2">${formatDate(e.date)}</td>
                    <td class="text-center">${e.bracoD ?? '—'}${delta('bracoD')}</td>
                    <td class="text-center">${e.torax ?? '—'}</td>
                    <td class="text-center">${e.cintura ?? '—'}</td>
                    <td class="text-center">${e.coxaD ?? '—'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
      `}
    </div>
  `;
}

/* ─── Metas Pessoais ──────────────────────────────────────────────── */

function renderPersonalGoals(goals = [], hiddenSections = []) {
  const hidden = hiddenSections.includes('section-goals');
  const active = goals.filter(g => !g.doneAt);
  const done   = goals.filter(g => g.doneAt);

  return `
    <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="target" class="w-3.5 h-3.5"></i>
          Metas Pessoais
        </h3>
        <div class="flex items-center gap-2">
          ${done.length > 0 ? `<span class="text-[10px] font-mono text-green-600">${done.length} concluída${done.length !== 1 ? 's' : ''}</span>` : ''}
          ${sectionHideBtn('section-goals', hiddenSections)}
        </div>
      </div>

      ${hidden ? `<p class="text-[10px] text-zinc-700 font-mono text-center py-1">${active.length} meta${active.length !== 1 ? 's' : ''} ativa${active.length !== 1 ? 's' : ''}</p>` : `

      <!-- Lista de metas ativas -->
      ${active.length > 0 ? `
        <div class="space-y-2 mb-3">
          ${active.map(g => `
            <div class="flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2 border border-zinc-800/60">
              <button data-action="achieve-goal" data-id="${g.id}"
                      class="ripple-target w-5 h-5 rounded border border-zinc-600 flex items-center justify-center
                             shrink-0 hover:border-green-500 hover:bg-green-900/20 transition-all active:scale-90">
              </button>
              <span class="flex-1 text-sm text-zinc-200 font-medium min-w-0 truncate">${g.label}</span>
              <button data-action="delete-goal" data-id="${g.id}"
                      class="ripple-target w-6 h-6 flex items-center justify-center text-zinc-700
                             hover:text-red-500 transition-colors active:scale-90 shrink-0">
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          `).join('')}
        </div>
      ` : `
        <p class="text-[10px] text-zinc-700 font-mono text-center py-2 mb-3">Nenhuma meta definida — adicione uma abaixo</p>
      `}

      <!-- Adicionar nova meta -->
      <div class="flex gap-2">
        <input type="text" id="new-goal-input" maxlength="80" placeholder="Ex: Agachamento 100kg…"
               class="input-ninja flex-1 py-2 px-3 rounded-xl text-xs font-medium" />
        <button data-action="add-goal"
                class="ripple-target px-3 py-2 bg-theme-dim border border-theme-accent rounded-xl
                       text-theme-primary text-[10px] font-black uppercase tracking-wider
                       active:scale-95 transition-all hover:bg-theme-dim/80 shrink-0">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
        </button>
      </div>

      <!-- Metas concluídas (colapsável) -->
      ${done.length > 0 ? `
        <details class="mt-3 group">
          <summary class="cursor-pointer list-none flex items-center gap-2 py-1 select-none">
            <i data-lucide="check-circle" class="w-3 h-3 text-green-600"></i>
            <span class="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
              ${done.length} concluída${done.length !== 1 ? 's' : ''}
            </span>
            <i data-lucide="chevron-down" class="w-3 h-3 text-zinc-700 ml-auto transition-transform group-open:rotate-180"></i>
          </summary>
          <div class="mt-2 space-y-1.5">
            ${done.map(g => `
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-900/5 border border-green-900/20">
                <i data-lucide="check" class="w-3 h-3 text-green-600 shrink-0"></i>
                <span class="flex-1 text-xs text-zinc-500 line-through truncate">${g.label}</span>
                <span class="text-[8px] text-zinc-700 font-mono shrink-0">${formatDate(g.doneAt)}</span>
                <button data-action="delete-goal" data-id="${g.id}"
                        class="ripple-target w-5 h-5 flex items-center justify-center text-zinc-800
                               hover:text-red-500 transition-colors active:scale-90 shrink-0">
                  <i data-lucide="x" class="w-3 h-3"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </details>
      ` : ''}
      `}
    </div>
  `;
}

/* ─── Render principal ─────────────────────────────────────────────── */

export function renderProfile(state) {
  const { history, theme, bodyWeights = [], biometrics = null, bioHistory = [], circumHistory = [], appMode = 'ninja', userName = 'ATLETA', activityLevel = 1.55, hiddenSections = [], achievements = [], cardioHistory = [], cardioCountsStreak = false, completedCycles = 0, cycleGoal = 6 } = state;
  const L    = getLabels(appMode);
  const rank = getRank(history.length);

  const totalVol   = history.reduce((a, h) => a + (h.vol ?? 0), 0);
  const totalMins  = history.reduce((a, h) => a + (h.duration ?? 0), 0);
  const avgVol     = history.length ? totalVol / history.length : 0;
  const totalKm    = cardioHistory.reduce((s, c) => s + (c.distance ?? 0), 0);
  const streak     = getBestStreak(history);
  const weekStreak = getWeeklyStreak(history, cardioHistory, cardioCountsStreak);

  // Scores do CyberBody — usa circunferências reais se disponíveis, senão frequência de treino
  let cyberScores = {};
  if (!biometrics?.bracoDirContraido) {
    const counts = {};
    let max = 0;
    history.forEach(h => {
      (h.muscles ?? []).forEach(m => {
        counts[m] = (counts[m] ?? 0) + 1;
        if (counts[m] > max) max = counts[m];
      });
    });
    for (const m in counts) cyberScores[m] = counts[m] / (max || 1);
  }

  return `
    <div class="stagger-enter space-y-5 pb-4">

      <!-- Avatar + Nome -->
      <div class="flex items-center gap-4 pt-2">
        <div class="relative shrink-0">
          <div class="w-16 h-16 rounded-full border-2 border-theme-accent flex items-center justify-center
                      bg-zinc-900 shadow-[0_0_30px_var(--theme-dim)]">
            ${renderSharingan('w-10 h-10', true, theme)}
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-xl font-black uppercase glitch-text truncate"
              data-text="${userName.toUpperCase()}">${userName.toUpperCase()}</h2>
          <div class="inline-flex items-center gap-2 mt-1 px-3 py-1 bg-theme-dim border border-theme-dim rounded-full">
            <span class="text-[10px] font-mono ${rank.color} tracking-[0.25em] uppercase font-bold">${rank.label}</span>
            <span class="text-[10px] text-zinc-600">·</span>
            <span class="text-[10px] text-zinc-500 font-mono">${history.length} ${L.workoutPlural}</span>
          </div>
        </div>
        <button data-action="goto-settings"
                class="ripple-target w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800
                       flex items-center justify-center text-zinc-500 hover:text-theme-primary
                       hover:border-theme-accent transition-all active:scale-90 shrink-0">
          <i data-lucide="settings" class="w-4 h-4"></i>
        </button>
      </div>

      <!-- Stats strip -->
      <div class="grid grid-cols-2 gap-2">
        ${[
          { icon: 'activity',      label: L.historyLabel,    value: history.length,        sub: 'total',                                          action: 'goto-tab', payload: 'evoluir' },
          { icon: 'dumbbell',      label: 'Tonelagem',       value: formatVolume(totalVol), sub: 'movida', accent: true,                           action: 'goto-tab', payload: 'evoluir' },
          { icon: 'zap',           label: 'Melhor Streak',   value: streak,                 sub: `dia${streak !== 1 ? 's' : ''}`,                  action: 'open-calendar' },
          { icon: 'calendar-check',label: 'Semanas Ativas',  value: weekStreak,             sub: `sem. consecutiva${weekStreak !== 1 ? 's' : ''}`, action: 'open-calendar' },
        ].map(s => `
          <button data-action="${s.action}" ${s.payload ? `data-payload="${s.payload}"` : ''}
                  class="ripple-target glass-card p-3 rounded-xl border border-zinc-800/60 flex items-center gap-3 w-full text-left active:scale-95 transition-all">
            <div class="w-8 h-8 rounded-lg bg-theme-dim border border-theme-dim/60 flex items-center justify-center shrink-0">
              <i data-lucide="${s.icon}" class="w-4 h-4 text-theme-primary pointer-events-none"></i>
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">${s.label}</div>
              <div class="text-sm font-black font-mono ${s.accent ? 'text-theme-primary' : 'text-white'} leading-tight">
                ${s.value} <span class="text-[9px] text-zinc-600 font-normal">${s.sub}</span>
              </div>
            </div>
            <i data-lucide="chevron-right" class="w-3 h-3 text-zinc-700 shrink-0 pointer-events-none"></i>
          </button>
        `).join('')}

        <!-- Ciclos Completados (col-span-2) -->
        ${(() => {
          const nextMilestone = completedCycles >= 5 ? null : completedCycles >= 1 ? 5 : 1;
          const pct = nextMilestone ? Math.round(completedCycles / nextMilestone * 100) : 100;
          return `
          <div class="col-span-2 glass-card p-3 rounded-xl border border-zinc-800/60">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-theme-dim border border-theme-dim/60 flex items-center justify-center shrink-0">
                  <i data-lucide="repeat" class="w-4 h-4 text-theme-primary"></i>
                </div>
                <div>
                  <div class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Ciclos Completos</div>
                  <div class="text-sm font-black font-mono text-white leading-tight">
                    ${completedCycles} <span class="text-[9px] text-zinc-600 font-normal">ciclo${completedCycles !== 1 ? 's' : ''}</span>
                    ${nextMilestone ? `<span class="text-[9px] text-zinc-700 ml-1">→ meta: ${nextMilestone}</span>` : `<span class="text-[9px] text-theme-primary ml-1">✓ tudo</span>`}
                  </div>
                </div>
              </div>
              <span class="text-[10px] font-mono text-zinc-600">${pct}%</span>
            </div>
            <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div class="h-full bg-theme-primary rounded-full transition-all duration-500" style="width:${pct}%"></div>
            </div>
          </div>`;
        })()}
      </div>

      ${totalMins > 0 ? `
        <div class="glass-card px-4 py-3 rounded-xl border border-zinc-800/60 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i data-lucide="clock" class="w-4 h-4 text-zinc-500"></i>
            <span class="text-xs text-zinc-500 uppercase font-bold tracking-wider">Tempo Total</span>
          </div>
          <span class="text-sm font-black font-mono text-white">${formatDuration(totalMins)}</span>
        </div>
      ` : ''}

      <!-- Calendário de Treinos -->
      <button data-action="open-calendar"
              class="ripple-target w-full glass-card px-4 py-3 rounded-xl border border-zinc-800/60
                     flex items-center justify-between active:scale-95 transition-all text-left">
        <div class="flex items-center gap-2">
          <i data-lucide="calendar-days" class="w-4 h-4 text-theme-primary"></i>
          <span class="text-xs text-zinc-400 font-bold uppercase tracking-wider">Calendário de Treinos</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-zinc-600 font-mono">${history.length + cardioHistory.length} registros</span>
          <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-600"></i>
        </div>
      </button>

      <!-- Próxima Conquista -->
      ${(() => {
        const milestones = [
          { id: 'session_1',     val: history.length,                                  target: 1 },
          { id: 'session_10',    val: history.length,                                  target: 10 },
          { id: 'session_25',    val: history.length,                                  target: 25 },
          { id: 'session_50',    val: history.length,                                  target: 50 },
          { id: 'session_100',   val: history.length,                                  target: 100 },
          { id: 'session_200',   val: history.length,                                  target: 200 },
          { id: 'week_perfect',  val: (() => { const wm = {}; for (const h of history) { const d = new Date(h.date); const day = d.getDay(); const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); mon.setHours(0,0,0,0); const k = mon.toISOString().slice(0,10); wm[k] = (wm[k] ?? 0) + 1; } return Math.max(0, ...Object.values(wm)); })(), target: cycleGoal },
          { id: 'vol_1t',        val: parseFloat((totalVol/1000).toFixed(2)),           target: 1 },
          { id: 'vol_10t',       val: parseFloat((totalVol/1000).toFixed(2)),           target: 10 },
          { id: 'vol_100t',      val: parseFloat((totalVol/1000).toFixed(2)),           target: 100 },
          { id: 'vol_500t',      val: parseFloat((totalVol/1000).toFixed(2)),           target: 500 },
          { id: 'cycle_1',       val: completedCycles,                                  target: 1 },
          { id: 'cycle_5',       val: completedCycles,                                  target: 5 },
          { id: 'cardio_first',  val: cardioHistory.length,                             target: 1 },
          { id: 'cardio_5',      val: cardioHistory.length,                             target: 5 },
          { id: 'cardio_10',     val: cardioHistory.length,                             target: 10 },
          { id: 'cardio_25',     val: cardioHistory.length,                             target: 25 },
          { id: 'cardio_10km',   val: parseFloat(totalKm.toFixed(1)),                   target: 10 },
          { id: 'cardio_50km',   val: parseFloat(totalKm.toFixed(1)),                   target: 50 },
          { id: 'cardio_100km',  val: parseFloat(totalKm.toFixed(1)),                   target: 100 },
        ];
        const earned = new Set(achievements);
        const unearned = milestones.filter(m => !earned.has(m.id) && ACHIEVEMENT_MAP[m.id]);
        if (!unearned.length) return '';
        const closest = unearned
          .map(m => ({ ...m, pct: Math.min(99, Math.round(m.val / m.target * 100)) }))
          .sort((a, b) => b.pct - a.pct)[0];
        const def = ACHIEVEMENT_MAP[closest.id];
        return `
        <button data-action="goto-tab" data-payload="evoluir"
                class="ripple-target glass-card w-full px-4 py-3 rounded-xl border border-zinc-800/60 text-left active:scale-95 transition-all">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                <i data-lucide="${def.icon}" class="w-4 h-4 ${def.color} opacity-70 pointer-events-none"></i>
              </div>
              <div>
                <div class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Próxima Conquista</div>
                <div class="text-xs font-bold text-white">${def.name}</div>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-mono text-zinc-400">${closest.pct}%</span>
              <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-zinc-700 pointer-events-none"></i>
            </div>
          </div>
          <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div class="h-full rounded-full bg-theme-primary transition-all duration-500 shadow-[0_0_4px_var(--theme-primary)]" style="width:${closest.pct}%"></div>
          </div>
          <div class="mt-1 text-[9px] text-zinc-600 font-mono">${closest.val} / ${closest.target}</div>
        </button>`;
      })()}

      <!-- Análise Biométrica (CyberBody) -->
      <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <i data-lucide="cpu" class="w-3.5 h-3.5"></i>
            Análise Biométrica
          </h3>
          <div class="flex items-center gap-2">
            <span class="text-[9px] text-zinc-700 font-mono">
              ${biometrics?.bracoDirContraido
                ? `circunferências reais${biometrics.bodyFat ? ` · ${biometrics.bodyFat}%G` : ''}`
                : 'frequência de treino'}
            </span>
            ${sectionHideBtn('section-cyberbody', hiddenSections)}
          </div>
        </div>
        ${hiddenSections.includes('section-cyberbody') ? '' : `
          <!-- Corpo centralizado -->
          <div class="flex justify-center mb-1">
            ${renderCyberBody(cyberScores, 256, theme, biometrics?.bracoDirContraido ? biometrics : null)}
          </div>

          <!-- Legenda gordura corporal -->
          ${biometrics?.bodyFat && biometrics.bodyFat > 8 ? `
            <p class="text-[8px] font-mono text-amber-700/70 text-center mb-3">
              ● gordura corporal ${biometrics.bodyFat}% — camada âmbar proporcional
            </p>
          ` : '<div class="mb-3"></div>'}

          <!-- Grid de medidas (bilateral D/E + unilaterais) -->
          ${biometrics?.bracoDirContraido ? (() => {
            const bilaterais = [
              { label: 'Braço',       valD: biometrics.bracoDirContraido,   valE: biometrics.bracoEsqContraido,    ref: 37,  th: 0.5 },
              { label: 'Coxa',        valD: biometrics.coxaDireita,          valE: biometrics.coxaEsquerda,         ref: 56,  th: 1.0 },
              { label: 'Panturrilha', valD: biometrics.panturrilhaDireita,   valE: biometrics.panturrilhaEsquerda,  ref: 37,  th: 0.5 },
            ].filter(s => s.valD || s.valE);

            const rcq = biometrics.escapular && biometrics.cintura
              ? (biometrics.cintura / biometrics.escapular).toFixed(2)
              : null;

            const avulsas = [
              { label: 'Ombro',   val: biometrics.escapular, ref: 112 },
              { label: 'Tórax',   val: biometrics.torax,     ref: 100 },
              { label: 'Cintura', val: biometrics.cintura,   ref: 82,  invert: true, ctx: rcq ? `RCQ ${rcq}` : null },
            ].filter(s => s.val);

            if (!bilaterais.length && !avulsas.length) return '';

            const pctColor = p => p >= 80 ? 'text-theme-primary' : p >= 55 ? 'text-amber-400' : 'text-zinc-400';
            const barCls   = p => p >= 80 ? 'bg-theme-primary shadow-[0_0_4px_var(--theme-primary)]' : p >= 55 ? 'bg-amber-400' : 'bg-zinc-600';
            const invColor = p => p <= 75 ? 'text-theme-primary' : p <= 95 ? 'text-amber-400' : 'text-red-400';
            const invBar   = p => p <= 75 ? 'bg-theme-primary shadow-[0_0_4px_var(--theme-primary)]' : p <= 95 ? 'bg-amber-400' : 'bg-red-500';

            return `
              <div class="space-y-1.5">

                ${bilaterais.length ? `
                <div class="grid grid-cols-3 text-[8px] font-bold text-zinc-600 uppercase tracking-wider px-2 mb-1">
                  <span></span>
                  <span class="text-center">Direito</span>
                  <span class="text-center">Esquerdo</span>
                </div>
                ${bilaterais.map(item => {
                  const vD = item.valD || 0, vE = item.valE || 0;
                  const diff = vD && vE ? Math.abs(vD - vE) : 0;
                  const asym = diff >= item.th;
                  const pD = Math.min(100, Math.round(vD / item.ref * 100));
                  const pE = Math.min(100, Math.round(vE / item.ref * 100));
                  return `
                    <div class="grid grid-cols-3 items-center gap-1 px-2 py-2.5 rounded-xl
                                ${asym ? 'bg-orange-900/10 border border-orange-900/30' : 'bg-zinc-900/40 border border-zinc-800/50'}">
                      <div class="text-[10px] text-zinc-400 font-bold">${item.label}</div>
                      <div class="text-center">
                        <div class="text-[13px] font-black font-mono ${pctColor(pD)} leading-none">${vD || '—'}<span class="text-[8px] text-zinc-600 font-normal">cm</span></div>
                        <div class="h-0.5 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                          <div class="${barCls(pD)} h-full rounded-full" style="width:${pD}%"></div>
                        </div>
                        <div class="text-[7px] text-zinc-700 font-mono mt-0.5">${pD}%</div>
                      </div>
                      <div class="text-center">
                        <div class="flex items-center justify-center gap-0.5">
                          <span class="text-[13px] font-black font-mono ${pctColor(pE)} leading-none">${vE || '—'}<span class="text-[8px] text-zinc-600 font-normal">cm</span></span>
                          ${asym ? `<span class="text-[9px] text-orange-400 font-bold">⚠</span>` : ''}
                        </div>
                        <div class="h-0.5 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                          <div class="${barCls(pE)} h-full rounded-full" style="width:${pE}%"></div>
                        </div>
                        <div class="text-[7px] font-mono mt-0.5 ${asym ? 'text-orange-600' : 'text-zinc-700'}">
                          ${asym ? `Δ${diff.toFixed(1)}cm` : `${pE}%`}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
                ` : ''}

                ${avulsas.length ? `
                ${bilaterais.length ? '<div class="border-t border-zinc-800/40 pt-1"></div>' : ''}
                ${avulsas.map(s => {
                  const pct = Math.min(100, Math.round(s.val / s.ref * 100));
                  const col = s.invert ? invColor(pct) : pctColor(pct);
                  const bar = s.invert ? invBar(pct) : barCls(pct);
                  return `
                    <div class="flex items-center gap-2 px-2 py-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/50">
                      <span class="w-14 shrink-0 text-[10px] font-bold text-zinc-400">${s.label}</span>
                      <span class="text-[13px] font-black font-mono ${col} leading-none shrink-0">
                        ${s.val}<span class="text-[8px] text-zinc-600 font-normal">cm</span>
                      </span>
                      <div class="flex-1 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div class="${bar} h-full rounded-full transition-all duration-700" style="width:${pct}%"></div>
                      </div>
                      <div class="text-right shrink-0">
                        <div class="text-[9px] font-bold font-mono ${col}">${pct}%</div>
                        ${s.ctx ? `<div class="text-[7px] text-zinc-600 font-mono">${s.ctx}</div>` : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
                ` : ''}

              </div>
            `;
          })() : (() => {
            const entries = Object.entries(cyberScores).sort((a, b) => b[1] - a[1]);
            if (!entries.length) return '';
            const pctColor = p => p >= 80 ? 'text-theme-primary' : p >= 50 ? 'text-amber-400' : 'text-zinc-400';
            const barCls   = p => p >= 80 ? 'bg-theme-primary shadow-[0_0_6px_var(--theme-primary)]' : p >= 50 ? 'bg-amber-400' : 'bg-zinc-600';
            return `
              <div class="grid grid-cols-3 gap-2">
                ${entries.map(([muscle, score]) => {
                  const pct = Math.round(score * 100);
                  return `
                    <div class="bg-zinc-900/50 border border-zinc-800/60 rounded-xl px-3 py-2.5">
                      <div class="text-[8px] text-zinc-500 font-bold uppercase tracking-wider mb-1">${muscle}</div>
                      <div class="text-sm font-black font-mono ${pctColor(pct)} leading-none">${pct}<span class="text-[9px] font-normal text-zinc-600 ml-0.5">%</span></div>
                      <div class="h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                        <div class="${barCls(pct)} h-full rounded-full transition-all duration-700" style="width:${pct}%"></div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          })()}
        `}
      </div>

      <!-- Composição Corporal -->
      ${renderBodyCompositionChart(biometrics, bioHistory, hiddenSections)}

      <!-- Insights automáticos -->
      ${renderBioInsights(biometrics, bioHistory, bodyWeights, hiddenSections)}

      <!-- Peso Corporal -->
      ${renderBodyWeightSection(bodyWeights, hiddenSections)}

      <!-- Circunferências Rápidas -->
      ${renderCircumSection(circumHistory, hiddenSections)}

      <!-- Evolução Biométrica (linha do tempo) -->
      ${bioHistory.length > 0 ? renderBioEvolutionChart(biometrics, bioHistory, hiddenSections) : ''}

      <!-- TDEE — Gasto Calórico -->
      ${renderTDEECard(biometrics, activityLevel, hiddenSections, history, state.activeCommute, state.goal)}

      <!-- Avaliação Física Completa -->
      ${renderBiometricsSection(biometrics, bioHistory, hiddenSections)}

      <!-- Conquistas -->
      ${(() => {
        const hiddenAch = hiddenSections.includes('section-achievements');
        const earnedCount = achievements.filter(x => { const id = typeof x === 'string' ? x : x?.id; return ACHIEVEMENTS.some(a => a.id === id); }).length;
        return `
        <div class="glass-card p-4 rounded-2xl border border-zinc-800/60">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
              <i data-lucide="trophy" class="w-3.5 h-3.5"></i>
              Conquistas
            </h3>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-mono text-zinc-700">${earnedCount}/${ACHIEVEMENTS.length}</span>
              ${sectionHideBtn('section-achievements', hiddenSections)}
            </div>
          </div>
          ${hiddenAch
            ? `<p class="text-[10px] text-zinc-700 font-mono text-center py-1">${earnedCount} de ${ACHIEVEMENTS.length} conquistas desbloqueadas</p>`
            : `<div class="grid grid-cols-3 gap-2">
                ${ACHIEVEMENTS.map(a => {
                  const earned = achievements.some(x => (typeof x === 'string' ? x : x?.id) === a.id);
                  return `
                    <div class="flex flex-col items-center gap-1 p-2 rounded-xl border transition-all
                                ${earned
                                  ? 'border-yellow-800/40 bg-yellow-900/10'
                                  : 'border-zinc-800/50 bg-zinc-900/20 opacity-40 grayscale'}">
                      <div class="w-8 h-8 rounded-full ${earned ? 'bg-yellow-900/30 border border-yellow-800/40' : 'bg-zinc-800 border border-zinc-700'} flex items-center justify-center">
                        <i data-lucide="${a.icon}" class="w-4 h-4 ${earned ? a.color : 'text-zinc-600'}"></i>
                      </div>
                      <span class="text-[8px] font-bold text-center leading-tight ${earned ? 'text-white' : 'text-zinc-600'}">${a.name}</span>
                      <span class="text-[7px] font-mono text-center leading-tight ${earned ? 'text-zinc-500' : 'text-zinc-700'}">${a.desc}</span>
                    </div>
                  `;
                }).join('')}
              </div>`
          }
        </div>`;
      })()}

      <!-- Metas Pessoais -->
      ${renderPersonalGoals(state.personalGoals ?? [], hiddenSections)}

      <button data-action="goto-settings"
              class="ripple-target btn-akatsuki w-full active:scale-95 text-zinc-400 border-zinc-800 hover:text-theme-primary hover:border-theme-accent">
        <i data-lucide="settings" class="w-4 h-4"></i> Configurações
      </button>

    </div>
  `;
}

/* ─── Event mounting ───────────────────────────────────────────────── */

export function mountProfile(container, handler) {
  delegate(container, '[data-action="goto-settings"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('goto-settings');
  });

  delegate(container, '[data-action="open-calendar"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('open-calendar');
  });

  delegate(container, '[data-action="goto-tab"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('goto-tab', el.dataset.payload);
  });

  // Salvar avaliação completa
  delegate(container, '[data-action="save-biometrics"]', 'click', (e, el) => {
    e.preventDefault();
    createRipple(e, el);
    const form = container.querySelector('[data-action="bio-form"]');
    if (!form) return;
    const data = {};
    form.querySelectorAll('input[name]').forEach(inp => {
      const v = parseFloat(inp.value.replace(',', '.'));
      if (!isNaN(v) && v > 0) data[inp.name] = v;
    });
    if (Object.keys(data).length) handler('save-biometrics', data);
  });

  delegate(container, '[data-action="save-weight"]', 'click', (e, el) => {
    createRipple(e, el);
    const input = container.querySelector('#weight-input');
    const val   = parseFloat(input?.value?.replace(',', '.'));
    if (!val || val <= 0 || val > 500) return;
    handler('save-weight', val);
    if (input) input.value = '';
  });

  delegate(container, '[data-action="delete-weight"]', 'click', (e, el) => {
    handler('delete-weight', el.dataset.date);
  });

  delegate(container, '[data-action="set-activity-level"]', 'change', (e, el) => {
    handler('set-activity-level', parseFloat(el.value));
  });

  delegate(container, '[data-action="export-bio-pdf"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('export-bio-pdf');
  });

  delegate(container, '[data-action="toggle-section"]', 'click', (e, el) => {
    handler('toggle-section', el.dataset.section);
  });

  delegate(container, '[data-action="save-circum"]', 'click', (e, el) => {
    createRipple(e, el);
    const form = container.querySelector('[data-action="circum-form"]');
    if (!form) return;
    const data = { date: new Date().toISOString() };
    form.querySelectorAll('input[name]').forEach(inp => {
      const v = parseFloat(inp.value.replace(',', '.'));
      if (!isNaN(v) && v > 0) data[inp.name] = v;
    });
    if (Object.keys(data).length > 1) {
      handler('save-circum', data);
      form.querySelectorAll('input[name]').forEach(inp => { inp.value = ''; });
    }
  });

  delegate(container, '[data-action="delete-bio-history"]', 'click', (e, el) => {
    handler('delete-bio-history', el.dataset.date);
  });

  delegate(container, '[data-action="add-goal"]', 'click', (e, el) => {
    createRipple(e, el);
    const input = container.querySelector('#new-goal-input');
    const label = input?.value?.trim();
    if (!label) return;
    handler('add-goal', label);
    input.value = '';
  });

  delegate(container, '[data-action="achieve-goal"]', 'click', (e, el) => {
    createRipple(e, el);
    handler('achieve-goal', el.dataset.id);
  });

  delegate(container, '[data-action="delete-goal"]', 'click', (e, el) => {
    handler('delete-goal', el.dataset.id);
  });

}
