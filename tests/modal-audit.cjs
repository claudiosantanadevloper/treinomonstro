// Executar com Node e PLAYWRIGHT_MODULE apontando para uma instalação existente.
// Navegador e armazenamento isolados; nenhum dado do perfil pessoal é usado.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

(async () => {
  const server = createServer(async (req, res) => {
    try {
      const filename = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (!filename.startsWith(root + path.sep)) throw new Error('Path inválido');
      const file = filename.endsWith(path.sep) ? filename + 'index.html' : filename;
      let content = await fs.readFile(file);
      if (file === path.join(root, 'src', 'app.js')) {
        content = Buffer.concat([content, Buffer.from('\nwindow.__qa = { store, app, WORKOUTS, CARDIO_PROTOCOLS };')]);
      }
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
      res.end(content);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.QA_BROWSER_CHANNEL ? { channel: process.env.QA_BROWSER_CHANNEL } : {}) });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });
    await page.addInitScript(() => {
      localStorage.setItem('monstro_v2_onboardingCompleted', 'true');
      localStorage.setItem('monstro_v2_retroLastShown', JSON.stringify(new Date().toISOString().slice(0, 10)));
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__qa && document.querySelector('#main-content button'));
    const set = patch => page.evaluate(patch => window.__qa.store.setState(patch), patch);
    const open = (id, data = null) => set({ activeModal: id, modalData: data });
    const snapshot = () => page.evaluate(() => {
      const s = window.__qa.store.getState();
      return JSON.stringify([s.workoutId, s.workoutStartTime, s.logs, s.history, s.cycleDone, s.cyclePosition, s.activeCardioSession, s.cardioHistory]);
    });
    const dismissed = async () => {
      assert.equal(await page.locator('[role="dialog"]').count(), 0);
      assert.equal(await page.locator('#main-content').evaluate(el => el.inert), false);
    };
    const dismiss = async () => { await page.keyboard.press('Escape'); await dismissed(); };

    // Inventário completo dos renderers, com dados mínimos válidos.
    const inventory = await page.evaluate(() => {
      const w = window.__qa.WORKOUTS.find(w => !w.isCardio), ex = w.exercises[0];
      return [
        ['confirm', { message: 'Teste', confirmAction: 'reset-data' }],
        ['notes'], ['cardio-log'], ['calendar'], ['hub'], ['cycle-overview'], ['workout-picker'], ['commute-run-log'],
        ['exercise-detail', { exId: ex.id, exName: ex.name }], ['exercise-demo', { exId: ex.id, exName: ex.name }],
        ['exercise-focus', { wId: w.id, ex }], ['rest-picker', { wId: w.id, exId: ex.id }],
        ['cardio-protocol'], ['cardio-presession', { protocolId: window.__qa.CARDIO_PROTOCOLS[0].id }],
        ['stale-session', { hours: 8 }], ['weekly-retro'], ['deload', { cycleCount: 4 }], ['plate-calc'],
        ['hint', { key: 'streak' }], ['ex-note', { exId: ex.id, wId: w.id }],
        ['warmup', { exId: ex.id, wId: w.id, weight: 50, reps: 10 }], ['run-tracker'],
        ['workout-history', { workout: w }], ['pdf-import', { loading: true, fileName: 'teste.pdf' }],
      ];
    });
    await set({ history: [{ id: 1, workoutId: '1', title: 'Treino de teste', date: new Date(Date.now() - 86400000).toISOString(), vol: 1000, reps: 20, duration: 10 }] });
    for (const [id, data] of inventory) {
      const before = await snapshot();
      await open(id, data);
      const dialog = page.locator('[role="dialog"]');
      assert.equal(await dialog.count(), 1, `${id}: dialog`);
      const close = dialog.locator('.modal-close-control').first();
      assert.equal(await close.getAttribute('aria-label'), 'Fechar janela', id);
      const bounds = await close.boundingBox();
      assert(bounds.width >= 32 && bounds.height >= 32, `${id}: touch target`);
      assert.equal(await page.locator('#main-content').evaluate(el => el.inert), true, id);
      await close.click();
      await dismissed();
      assert.equal(await snapshot(), before, `${id}: dispensa sem efeitos`);
    }
    console.log(`PASS: ${inventory.length} modais — X, ARIA, toque, fundo inerte, sem mutação de sessão/dados`);
    await set({ history: [] });

    // Confirmações: cancelar por botão, X, fundo e Escape nunca executa a ação.
    await set({ cyclePosition: 4 });
    for (const method of ['cancel', 'x', 'backdrop', 'escape']) {
      const before = await snapshot();
      await open('confirm', { message: 'Reiniciar ciclo?', confirmAction: 'reset-cycle' });
      if (method === 'cancel') await page.locator('#confirm-no').click();
      else if (method === 'x') await page.locator('.modal-close-control').click();
      else if (method === 'backdrop') await page.locator('[data-modal-backdrop]').click({ position: { x: 1, y: 1 } });
      else await page.keyboard.press('Escape');
      await dismissed();
      assert.equal(await snapshot(), before, method);
    }

    // Início real de cardio: escolha/cancelamento não inicia; confirmar inicia uma vez.
    await set({ tab: 'cardio' });
    await open('cardio-protocol');
    await page.locator('#modal-layer [data-action="start-cardio-protocol"]').first().click();
    await page.locator('[data-presession-mode="bike"]').click();
    await page.locator('[data-action="dismiss-modal"]').last().click();
    assert.equal(await page.evaluate(() => window.__qa.store.getState().activeCardioSession), null);
    const protocolId = await page.evaluate(() => window.__qa.CARDIO_PROTOCOLS[0].id);
    await open('cardio-presession', { protocolId });
    await page.locator('#presession-confirm').click();
    assert.equal(await page.evaluate(() => window.__qa.store.getState().activeCardioSession.type), 'bike');
    // Congela relógio de teste para comparações exatas.
    await set({ activeCardioSession: { ...(await page.evaluate(() => window.__qa.store.getState().activeCardioSession)), paused: true, pausedAt: Date.now(), totalElapsed: 120 } });
    await page.locator('[data-action="cardio-abandon"]').click();
    const beforeAbandon = await snapshot();
    await page.locator('#confirm-no').click();
    assert.equal(await snapshot(), beforeAbandon);
    const beforeFinish = await snapshot();
    await page.locator('[data-action="cardio-finish"]').click();
    await page.locator('#cardio-finish-notes').fill('Rascunho cardio');
    await page.locator('[data-fatigue="3"]').click();
    await page.locator('#add-segment-btn').click();
    await page.locator('.seg-speed').fill('6');
    await page.locator('.seg-dur').fill('2');
    await page.getByText('Voltar à sessão', { exact: true }).click();
    assert.equal(await snapshot(), beforeFinish);
    await page.locator('[data-action="cardio-finish"]').click();
    assert.equal(await page.locator('#cardio-finish-notes').inputValue(), 'Rascunho cardio');
    assert.equal(await page.locator('.seg-speed').inputValue(), '6');
    for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1366, height: 900 }]) {
      await page.setViewportSize(viewport);
      const sizes = await page.locator('#modal-layer [role="dialog"]').evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
      assert(sizes.content <= sizes.width + 1, `Cardio sem overflow horizontal em ${viewport.width}: ${JSON.stringify(sizes)}`);
      await page.locator('#save-cardio-finish').scrollIntoViewIfNeeded();
      assert(await page.locator('#save-cardio-finish').isVisible());
      if (process.env.QA_SCREENSHOT_DIR) {
        await fs.mkdir(process.env.QA_SCREENSHOT_DIR, { recursive: true });
        await page.locator('[role="dialog"]').evaluate(el => { el.scrollTop = 0; });
        await page.screenshot({ path: path.join(process.env.QA_SCREENSHOT_DIR, `modal-cardio-${viewport.width}.png`) });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    // Tab e Shift+Tab ficam no diálogo.
    await page.locator('#save-cardio-finish').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.modal-close-control').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('#save-cardio-finish').evaluate(el => el === document.activeElement), true);
    await page.locator('#save-cardio-finish').click();
    assert.equal(await page.locator('#cardio-finish-notes').count(), 0);
    assert.equal(await page.evaluate(() => window.__qa.store.getState().cardioHistory.length), 1);
    assert.equal(await page.evaluate(() => window.__qa.store.getState().cardioHistory[0].recovery.fatigueScore), 3);
    await dismiss();
    assert.equal(await page.evaluate(() => window.__qa.store.getState().cardioHistory.length), 1);
    console.log('PASS: cardio — cancelar início, confirmar início, voltar sem finalizar, rascunho/segmentos/esforço, salvar uma vez, fechar relatório');

    // Treino real e fechamento da revisão sem finalizar nem reconstruir séries.
    await set({ tab: 'treinar' });
    await page.locator('[data-action="open-workout-picker"]').first().click();
    await page.locator('#modal-layer [data-hub-payload="1"]').click();
    await page.waitForFunction(() => window.__qa.store.getState().tab === 'workout');
    await set({ logs: { '1': { t1_1: { 0: { w: 50, r: 10, done: true } } } } });
    await page.locator('#main-content [data-field]').first().evaluate(el => { el.dataset.qaPreserved = 'true'; });
    const workoutBefore = await snapshot();
    await page.locator('[data-action="finish-workout"]').first().click();
    await page.locator('#workout-notes-input').fill('Rascunho treino');
    await page.locator('#cancel-finish-btn').click();
    assert.equal(await snapshot(), workoutBefore);
    assert.equal(await page.locator('[data-qa-preserved="true"]').count(), 1, 'Fechar mantém as séries no DOM');
    await page.locator('[data-action="finish-workout"]').first().click();
    assert.equal(await page.locator('#workout-notes-input').inputValue(), 'Rascunho treino');
    await dismiss();
    await page.locator('[data-action="finish-workout"]').first().click();
    await page.locator('#confirm-finish').click();
    assert.equal(await page.locator('#report-layer [role="dialog"]').count(), 1, JSON.stringify(errors));
    const afterWorkout = await snapshot();
    await page.locator('#close-report').click();
    await dismissed();
    assert.equal(await snapshot(), afterWorkout);
    assert.equal(await page.evaluate(() => window.__qa.store.getState().history.length), 1);
    assert.equal(await page.evaluate(() => window.__qa.store.getState().history[0].vol), 500);
    console.log('PASS: treino — iniciar, cancelar finalização, reabrir com notas, sem alterações de logs/histórico/ciclo');

    // As ações de ciclo/descanso precisam funcionar pela interface, não apenas pelo estado.
    await page.locator('[data-action="open-cycle-modal"]').first().click();
    assert.equal(await page.locator('#cycle-backdrop').count(), 1);
    await dismiss();
    await open('rest-picker', { wId: '1', exId: 't1_1', current: 60 });
    await page.locator('[data-rest-val="90"]').click();
    assert.equal(await page.evaluate(() => window.__qa.store.getState().restOverrides['1'].t1_1), 90);
    await dismissed();

    const pdf = { ok: true, fileName: 'ficticio.pdf', exercises: [{ name: 'Supino', sets: 3, reps: '10' }, { name: 'Remada', sets: 3, reps: '12' }] };
    await open('pdf-import', pdf);
    await page.locator('.pdf-ex-remove').first().click();
    assert.equal(await page.locator('.pdf-ex-remove').count(), 1);
    assert.equal(await page.locator('[role="dialog"]').count(), 1);
    await page.locator('#pdf-workout-name').fill('Revisão em rascunho');
    await dismiss();
    await open('pdf-import', pdf);
    assert.equal(await page.locator('#pdf-workout-name').inputValue(), 'Revisão em rascunho');
    assert.equal(await page.locator('.pdf-ex-remove').count(), 1);
    await dismiss();

    // A celebração sobreposta fecha primeiro e devolve foco ao diálogo anterior.
    await open('calendar');
    await set({ achievements: ['session_50'] });
    await page.locator('#celebration-overlay').waitFor();
    assert.equal(await page.locator('#celebration-overlay').getAttribute('role'), 'dialog');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#celebration-overlay').count(), 0);
    assert.equal(await page.locator('#cal-backdrop').count(), 1);
    await dismiss();
    console.log('PASS: ciclo, descanso, PDF (remoção e rascunho), celebração sobreposta e telas 320/390/1366px');

    // O rastreio legado exige confirmação explícita para descartar depois de iniciar.
    await open('run-tracker');
    await page.locator('#run-start-btn').click();
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#close-run-modal').click();
    assert.equal(await page.locator('#run-timer').count(), 1);
    page.once('dialog', dialog => dialog.accept());
    await page.keyboard.press('Escape');
    await dismissed();
    console.log('PASS: GPS legado — cancelar descarte preserva rastreio; descarte explícito fecha e limpa recursos');

    assert.deepEqual(errors, [], 'Erros de JavaScript');
    await context.close();
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
