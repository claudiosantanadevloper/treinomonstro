# Auditoria de modais — 06/11/2026

## Resultado

27 tipos de modal e a celebração de conquista revisados. Preparação/finalização de cardio agora oferecem X e cancelar/voltar. Fechar janelas não executa confirmação, inicia treino, finaliza sessão, apaga séries nem remove histórico. Os formulários mantêm rascunhos em memória durante a abertura atual do app.

## Achados e correções

| Achado | Correção |
|---|---|
| Preparação e finalização de cardio sem saída visível | X de 40×40 px; Cancelar / Voltar à sessão; Escape e toque no fundo |
| Várias janelas abertas diretamente, fora de `activeModal` | Aberturas encaminhadas ao estado e a `#renderModal()` |
| Mesmo tipo de modal com novos dados não atualizava | Subscriber compara também `modalData`; chave evita reconstrução quando nada mudou |
| Fechar formulários perdia preenchimento | Guarda o próprio fragmento DOM, com valores, seleções e handlers; restaura ao reabrir |
| Escolher treino, ver ciclo e ajustar descanso sem resposta | Cinco ações movidas de `#executeConfirmedAction()` para `#handleAction()` |
| Concluir treino podia impedir a exibição do relatório | Render do modal também ocorre se o conteúdo sair cedo por `workoutId` vazio; fechar relatório retorna à seleção |
| X pequenos e sem nome acessível | Reaproveita X existentes, nome acessível, foco visível, área de 40×40 px; demais botões com mínimo de 32 px |
| Teclado alcançava conteúdo atrás do modal | `role="dialog"`, `aria-modal`, nome, foco inicial, ciclo Tab/Shift+Tab, fundo inerte e retorno de foco |
| Formulário alto podia cortar ações | Rolagem dentro do diálogo limitada à altura visível; esforço 1–10 em duas linhas e recuperação em uma coluna |
| X de remoção de exercício PDF se parece com fechar | Exclusão explícita desse controle da normalização; continua removendo somente a linha |
| PDF podia reabrir após o usuário fechar a leitura | Resultado assíncrono só atualiza a janela de importação ainda aberta |
| Rastreio GPS legado descartava ao fechar | Após iniciar, descarte pede confirmação; cancelar preserva a tela, confirmar limpa relógio/GPS/wake lock; salvar também limpa recursos |
| Celebração sobreposta sem X/controle de teclado | X acessível, Escape, foco próprio e retorno ao diálogo anterior |

Sugestões automáticas de retrospectiva, deload e sessão antiga não substituem um modal já aberto. A finalização automática de cardio também respeita uma janela aberta. O resumo da revisão de cardio é atualizado ao reabrir um rascunho.

## Inventário

| Grupo | Tipos |
|---|---|
| Confirmações / conclusão | `confirm`, `notes`, `battle-report`, `stale-session` |
| Cardio / deslocamento | `cardio-protocol`, `cardio-presession`, `cardio-finish`, `cardio-report`, `cardio-log`, `commute-run-log`, `run-tracker` |
| Navegação / programa | `calendar`, `hub`, `cycle-overview`, `workout-picker`, `workout-history` |
| Exercícios | `exercise-detail`, `exercise-demo`, `exercise-focus`, `rest-picker`, `ex-note`, `warmup`, `plate-calc` |
| Informação / importação | `hint`, `weekly-retro`, `deload`, `pdf-import` |
| Sobreposição adicional | Celebração de conquista: X e Escape fecham primeiro a celebração, preservando o modal abaixo |

O onboarding é um fluxo de configuração de sete telas, com avançar/voltar, e não foi convertido em modal. Confirmações e alertas nativos de importação de backup, descarte de relatório e permissões continuam usando os controles do navegador.

## Arquivos alterados

- `src/controllers/AppController.js`: ciclo de abertura/fechamento, acessibilidade, rascunhos, fluxo de cardio, ações de seleção/ciclo/descanso, relatório, PDF e celebração.
- `src/utils/dom.js`: parâmetro opcional de eventos para a delegação em captura, compatível com chamadas existentes.
- `src/styles/main.css`: dimensões de toque, X, foco e rolagem dos diálogos.
- `sw.js`: cache atualizado inicialmente para `monstro-v48` e depois para `monstro-v49` no complemento de ícones abaixo. Nada foi publicado.
- `tests/modal-audit.cjs`: regressões em navegador, sem adicionar dependência de produção, npm ou build ao app.

## Validação

Teste em Chrome headless, perfil e localStorage isolados, servidor temporário local com os arquivos reais. O ponto de inspeção de estado é injetado apenas na resposta do servidor de teste; não existe no app entregue.

- 24 tipos auxiliares: X, nome acessível, dimensão, fundo inerte e comparação do estado antes/depois.
- Outros três tipos exercitados por conclusão real: revisão de cardio e relatórios de cardio/treino.
- Confirmação: cancelar, X, fundo e Escape preservam posição do ciclo; cancelar abandono preserva cardio ativo.
- Cardio: cancelar preparação não inicia; confirmar inicia; voltar da revisão preserva sessão; reabrir restaura notas, segmentos e fadiga; salvar gera um registro e fechar relatório mantém esse registro.
- Treino: início pelo seletor, série com 50 kg × 10, cancelar revisão mantém estado e o mesmo elemento das séries; reabrir restaura notas; finalizar registra 500 kg de volume; fechar relatório mantém histórico.
- Ações reais de ciclo e descanso; remoção de linha PDF sem fechar janela e restauração da edição; celebração sobre calendário.
- Rastreio legado: cancelar confirmação preserva a tela; confirmar descarte fecha.
- Larguras 320, 390 e 1366 px: formulário cardio sem overflow horizontal e botão salvar alcançável por rolagem. Capturas visuais inspecionadas em 320 e 390 px.
- Captura de erros de JavaScript e de subscribers, além de verificação de sintaxe e espaços do diff.

Para repetir, use uma instalação existente de Playwright com Chrome/Chromium, sem instalar pacotes no projeto:

```powershell
$env:PLAYWRIGHT_MODULE = 'caminho/para/playwright'
$env:QA_BROWSER_CHANNEL = 'chrome'
node tests/modal-audit.cjs
```

## Limites

- Rascunhos sobrevivem a fechar/reabrir a janela nesta execução do app; recarregar/fechar o app os remove. Salvar explicitamente continua necessário.
- GPS físico, wake lock em celular, leitores de tela reais, teclado virtual móvel e instalação/atualização da PWA em aparelho não foram ensaiados nesta rodada.
- O teste de PDF cobre a revisão/importação de dados fictícios e a proteção no código contra reabertura tardia; não valida todos os formatos de PDF.
- Produção não foi alterada. Alterações locais preexistentes e dados pessoais foram preservados.

## Complemento: favicon e aviso do Tailwind

O HTML não declarava favicon e não havia `favicon.ico`. Os PNGs de 192/512 px já referenciados no manifesto e em `apple-touch-icon` também estavam ausentes.

- `index.html` e `instalar.html`: referências relativas ao SVG existente e ao fallback ICO, compatíveis com implantação na raiz e em `/treino-monstro/`.
- `favicon.ico`: tamanhos 16/32/48, derivados de `icons/icon.svg`, preservando a arte com M vermelho.
- `icons/icon-192.png` e `icons/icon-512.png`: rasterizações do mesmo SVG, preenchendo as referências existentes da PWA, sem mudar o manifesto.
- `sw.js`: cache `monstro-v49`; ICO e PNGs incluídos no pré-cache junto do SVG.

Validação em Chrome isolado: arquivos reais servidos na raiz e sob `/treino-monstro/`, referências nas duas páginas, respostas sem 404 de ícones, decodificação dos formatos, dimensões PNG e disponibilidade de todos os ícones offline pelo Service Worker. PNG de 192 px também inspecionado visualmente. Nenhuma publicação realizada.

O aviso `cdn.tailwindcss.com should not be used in production` continua visível. A [documentação oficial do Play CDN](https://v3.tailwindcss.com/docs/installation/play-cdn) o apresenta para desenvolvimento e não como a opção recomendada para produção. Ele decorre da escolha explícita de usar Tailwind CDN sem build; não indica falha de carregamento do favicon. A integração existente foi preservada, sem migração e sem interceptar ou esconder mensagens do console.
