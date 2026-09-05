/**
 * Serviço de importação de fichas de treino via PDF.
 * PDF.js é carregado dinamicamente (só quando o usuário aciona a feature).
 * O parsing é heurístico — sempre requer revisão do usuário antes de salvar.
 */

import { EXERCISE_LIBRARY } from '../data/exerciseLibrary.js';

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_CDN;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN;
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error('Falha ao carregar PDF.js. Verifique a conexão.'));
    document.head.appendChild(script);
  });
}

async function extractText(file) {
  const pdfjs  = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf    = await pdfjs.getDocument({ data: buffer }).promise;
  let text = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

function normalize(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const normalizedLib = EXERCISE_LIBRARY.map(name => ({
  name,
  words: normalize(name).split(' ').filter(w => w.length > 3),
}));

function matchLibrary(line) {
  const norm = normalize(line);
  let best = null, bestScore = 0;
  for (const ex of normalizedLib) {
    if (!ex.words.length) continue;
    const hits = ex.words.filter(w => norm.includes(w)).length;
    const score = hits / ex.words.length;
    if (score > bestScore && score >= 0.6) { best = ex.name; bestScore = score; }
  }
  return best;
}

const SET_REPS_RE = /(\d+)\s*[xX×]\s*(\d+(?:[-–]\d+)?)/;
const SET_LABEL_RE = /(\d+)\s+s[eé]r[ie]+s?\s+(?:de\s+)?(\d+(?:[-–]\d+)?)/i;

function parseSetsReps(line) {
  const m1 = line.match(SET_REPS_RE);
  if (m1) return { sets: Math.min(10, parseInt(m1[1])), reps: m1[2] };
  const m2 = line.match(SET_LABEL_RE);
  if (m2) return { sets: Math.min(10, parseInt(m2[1])), reps: m2[2] };
  return null;
}

export async function parsePDFWorkout(file) {
  try {
    const rawText = await extractText(file);
    const lines   = rawText.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 2);

    const exercises = [];
    for (const line of lines) {
      const libMatch = matchLibrary(line);
      const srMatch  = parseSetsReps(line);

      if (libMatch) {
        const last = exercises[exercises.length - 1];
        if (last?.name === libMatch) {
          if (srMatch) { last.sets = srMatch.sets; last.reps = srMatch.reps; }
          continue;
        }
        exercises.push({
          name:       libMatch,
          sets:       srMatch?.sets ?? 3,
          reps:       srMatch?.reps ?? '8-12',
          rest:       60,
          confidence: 'high',
        });
      } else if (srMatch) {
        const cleaned = line
          .replace(SET_REPS_RE, '').replace(SET_LABEL_RE, '')
          .replace(/[-–:·|]/g, ' ').trim();
        if (cleaned.length >= 4 && cleaned.length <= 60 && /[a-zA-ZÀ-ú]/.test(cleaned)) {
          exercises.push({
            name:       cleaned,
            sets:       srMatch.sets,
            reps:       srMatch.reps,
            rest:       60,
            confidence: 'low',
          });
        }
      }
    }

    return {
      ok:       true,
      exercises: exercises.slice(0, 30),
      pageCount: Math.min(10, (await (await loadPdfJs()).getDocument({ data: await file.arrayBuffer() }).promise).numPages),
      rawText:  rawText.slice(0, 3000),
    };
  } catch (err) {
    return { ok: false, error: err.message, exercises: [], rawText: '' };
  }
}
