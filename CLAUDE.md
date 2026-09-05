# ForjaFit — v6.6 (27/07/2026)

PWA workout tracker gamificado · Vanilla JS ES Modules · Tailwind CDN · localStorage · sem build
`http://localhost/treino-monstro/` | ngrok: `https://survey-sedation-stellar.ngrok-free.dev/treino-monstro/`
**Usuário:** Cláudio Santana · **Projeto:** NINJINHA BOM DE BRIGA

**Docs:** `docs/00-visao-geral.md` · `docs/01-arquitetura.md` · `docs/HISTORY.md`
**Atleta:** `docs/objetos/Claudio.md` — perfil completo, metas, programa, algoritmo de bulk
**IA:** `.claude/README.md` · `.claude/skills/` · `.claude/agents/`

---

## Regras de Ouro — NUNCA violar

1. **Views puras**: `renderXxx(state, data) → string HTML`. Zero efeitos colaterais.
2. **Events via delegation**: nunca `addEventListener` individual — handler na raiz via `delegate()`.
3. **Controllers não tocam DOM**: só `store.setState()`.
4. **Patches cirúrgicos** no treino ativo: `patchSetRow / patchExerciseCardState / patchSetsContainer / patchProgressionBadge / patchExerciseSkip`. Re-render total só na entrada/saída.
5. **Subscriber único** no AppController decide tudo que re-renderiza.
6. **Novo campo persistido**: `app.js defaults` + `src/store/persistedKeys.js` — ambos obrigatórios.
7. **Novo modal**: `store.setState({ activeModal: 'id', modalData })` → `case` em `#renderModal()`.
8. **Nova action**: `data-action="x"` → `delegate()` em `mountXxx()` → `case 'x'` em `#handleAction()`.

---

## Stack

| Camada | Tecnologia |
|---|---|
| UI | Tailwind CDN (JIT) + Lucide `0.460.0` (fixado — não atualizar) |
| JS | Vanilla ES Modules (sem framework, sem Node.js, sem build) |
| Estado | Store imutável (`Object.freeze`) + subscriber único |
| Persistência | localStorage prefixo `monstro_v2_` via `StorageService` |
| Offline | Service Worker `monstro-v21` — cache-first prod, network-first localhost |

---

## Ciclo PPL

```
cycleOrder = ['1','2','3',null,'4','5','6',null]
              Push A · Legs A · Pull A · OFF · Push B · Legs B · Pull B · OFF
```

- Avanço: `(cyclePosition + 1) % cycleOrder.length` — sequencial, nunca `indexOf` (ver ADR-003)
- `cycleDone[]` é a fonte de verdade do que foi feito; `cyclePosition` é só sugestão
- Wrap (pos → 0): resetar `cycleDone = []` e `cycleStart = null`
- Slot `null` = OFF intencional — avançado por `#advanceOffDay()`, não por finishWorkout

---

## Convenções

| Entidade | Padrão |
|---|---|
| Treino built-in | `'1'`–`'6'`, `'cardio'` |
| Treino custom | `custom_${Date.now()}` |
| Exercício built-in | `t{wId}_{n}` ex: `t1_1` |
| Exercício custom | `cex_${Date.now()}_${random}` |
| chave localStorage | `monstro_v2_{key}` |
| Action no DOM | kebab-case: `toggle-set`, `mod-sets` |
| Campo especial em exLogs | underscore prefix: `_c`, `_skip` |

---

## Design System (quick-ref)

**CSS vars:** `--theme-primary` · `--theme-accent` · `--theme-dim` · `--theme-dark` · `--theme-rgb`
**Classes:** `text-theme-primary` · `bg-theme-dim` · `border-theme-accent` · `bg-theme-dark`

| Cor | Semântica |
|---|---|
| `text-green-400` | PR / sucesso |
| `text-red-400` | perigo / skip |
| `text-yellow-400` | achievement / aviso |
| `text-orange-400` | streak |
| `text-blue-400` | volume |
| `text-cyan-400` | cardio |
| `text-purple-400` | raro |

**Componentes:** card = `glass-card p-4 rounded-2xl border border-zinc-800/70`
**Btn primário:** `btn-akatsuki` · **Btn ativo:** `bg-theme-dim border-theme-accent text-theme-primary`
**Input:** `input-ninja` · **Touch target:** `min-w-[32px] min-h-[32px]` + `ripple-target`

**Lucide seguros:** `home dumbbell activity zap trophy calendar clock trending-up circle-user check check-circle x chevron-* history pencil settings database download upload file-text trash-2 plus plus-circle rotate-ccw refresh-cw info alert-triangle timer target flame heart eye ruler cpu palette moon sun wind minus equal bar-chart-2 award star shield`
**Lucide EVITAR:** `scan-line weight swords user-circle`

---

## Sprint Atual — v6.6

**v6.6 — concluído (27/07/2026):**
- [x] Modal cycle-overview: 8 slots PPL com estado visual + botões Treinar
- [x] Modal workout-picker: lista todos os treinos com badges PRÓXIMO/✓FEITO
- [x] Timer dual: elapsed de treino separado visualmente do countdown de descanso
- [x] Battle Report: duração em pill badge no hero (`⏱ X min · de treino`)
- [x] Battle Report: stats Repetições + Séries (duração saiu dos cards para o hero)
- [x] Docs: 01-arquitetura, 04-ciclo-ppl, 05-gamificacao, features/, objetos/exercise, ADR-003
- [x] Skills/agents: load fingerprint, corrigido erro indexOf→sequencial, compactados

**QA v6.6 — concluído:**
- [x] Ciclo golden path (14 fluxos verificados em código)
- [x] cycleDone dedup OK · wrap reset OK · OFF não entra em cycleDone OK
- [x] Skip exercise: vol/breakdown/MVP/progressionChips excluídos OK
- [x] Timer: workoutStartTime persistido OK · elapsed imediato OK · separação rest/treino OK
- [x] Ordem de exercícios todos os 6 treinos: nenhuma correção obrigatória

**v6.7 — Set/2026:**

- [x] Undo botão série: removido timeout 3s → botão rosa permanente durante sessão
- [x] BattleReportView.js extraído do God Class AppController (~260 linhas)
- [x] instalar.html: página PWA com QR Code, detecção iOS/Android, beforeinstallprompt
- [x] seed_julio.html: seed completo com dados Pollock 7 dobras do Júlio (PDF)
- [x] Settings: card "Instalar no Celular" + botão compartilhar link
- [x] workouts.js: PPL redesenhado para Cláudio — 208 séries/ciclo com volumes corretos
  - Push A 32s · Legs A 34s · Pull A 36s · Push B 36s · Legs B 38s · Pull B 32s
  - Ordem por ativação/hipertrofia · nota assimetria coxa E no Afundo Smith
- [x] Claudio.md: volumes corrigidos + hierarquia suplementação + algoritmo calórico

**Próximas melhorias sugeridas:**
- [ ] Carga anterior visível durante treino (última sessão por série — alto impacto)
- [ ] Rest timer automático após marcar série como feita (alto impacto)
- [ ] RPE médio no battle report (médio impacto)
