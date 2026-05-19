# CLAUDE.md — USP Debate (Sistema de Treinos)

Guia para agentes de codificação. **Confie nestas instruções**; só pesquise o código se
algo aqui estiver incompleto ou se revelar incorreto.

## O que é

Web app de gestão de treinos de debate (formato British Parliamentary) da USP Debate.
Funcionalidades: registro de presença, geração do "draw" (sorteio de salas e posições
OG/OO/CG/CO), registro de speaker points com dashboard de desempenho calibrado, e
acompanhamento de trainees. Interface em **português**.

Repositório pequeno (~30 arquivos de código em `src/`). App de página única (6 abas),
sem backend próprio — usa Supabase.

## Stack e runtime

- **Next.js 14.2.15**, App Router, **export estático** (`output: 'export'` → pasta `out/`).
  Sem SSR, sem rotas de API, sem servidor.
- **React 18.3.1**, **JavaScript puro** — arquivos `.jsx`, **sem TypeScript**.
- **Tailwind CSS 3.4.14** — tema escuro via CSS variables em `src/app/globals.css`.
- **@supabase/supabase-js 2.45.4** — único backend (Postgres + RLS).
- **Node 20** no CI (local ≥18 funciona). Gerenciador: **npm**.
- **Não há testes** nem configuração de lint customizada (usa o ESLint padrão do Next).

## Build e validação — SEMPRE nesta ordem

1. `npm install` — **SEMPRE** execute antes de qualquer build. (~30 s)
2. `npm run build` — compila, roda o ESLint e gera `out/`. (~30–60 s) **Esta é a
   validação principal: sempre rode `npm run build` antes de concluir uma mudança.**
   Build verde termina com `✓ Compiled successfully` e `✓ Generating static pages (N/N)`.
3. `npm run dev` — servidor local em `http://localhost:3000` (teste manual).

Fatos validados:
- `next build` roda o ESLint. **Erros** de lint quebram o build; **avisos** (ex.:
  `react-hooks/exhaustive-deps`) **não** quebram.
- **NUNCA** rode `npm audit fix --force` — existem vulnerabilidades transitivas, mas o
  `--force` aplica breaking changes e quebra o build. Ignore o aviso do `npm audit`.
- Não existe `npm test` nem `npm run lint` separado. Scripts disponíveis: `dev`, `build`, `start`.
- `.gitignore` ignora `node_modules/`, `.next/`, `out/`.

## Arquitetura — onde mexer

### `src/app/`
- `page.jsx` — shell do app: as 6 abas (`presenca`, `draw`, `speaks`, `desempenho`,
  `historico`, `admin`), header e navegação. Renderiza condicionalmente os componentes de aba.
- `layout.jsx` — fontes (`next/font/google`), metadata. `globals.css` — Tailwind + design
  tokens (CSS variables do tema escuro). Mudanças de cor/fonte do tema vão aqui + `tailwind.config.js`.

### `src/components/`
- `*Tab.jsx` — um componente por aba. `AdminTab.jsx` é o maior: menu com sub-áreas
  (draw, registros, análise de juízes, listas de presença, trainees).
- Componentes de domínio: `DrawView`, `AdminDrawEditor`, `SpeaksDoDraw`, `SpeaksManual`,
  `TraineesArea`, `IntroSplash`.
- `src/components/ui/` — primitivos reutilizáveis: `Card`, `Button`, `Alert`,
  `Autocomplete`, `ConfirmModal`, `Toaster`, `Icons` (ícones SVG), `LineChart`, `Decor`.

### `src/lib/` — toda a lógica fora da UI
- **`supabase.js`** — **a camada de dados inteira.** Todo acesso ao banco passa por
  funções nomeadas exportadas aqui. Contém o cliente Supabase e a **URL + anon key
  hardcoded** (a anon key é pública por design, protegida por RLS).
  Para qualquer operação de banco nova: adicione/edite uma função aqui — **não** chame
  o cliente Supabase direto nos componentes.
- `drawgen.js` — algoritmo de sorteio do draw (funções puras).
- `draw.js` — helpers do draw: `POS_STYLE`, `ordenarPosicoes`, `panelSala`, `semPar`.
- `speaks-stats.js` — modelo de calibragem de speaker points (debatedor + juiz, com shrinkage).
- `toast.js` — sistema de toasts. `data.js` — `NOMES_PS` (lista do PS) e `norm()`.

### Convenções obrigatórias
- Alias **`@/` → `src/`** (definido em `jsconfig.json`). Use-o em todos os imports.
- Componentes que usam hooks/estado **devem** começar com `'use client'`.
- UI em português. **Não use emojis** na interface — ícones são SVG em `ui/Icons.jsx`.
- Não introduza TypeScript. Não adicione dependências sem necessidade real.

## Backend (Supabase / Postgres)

- Arquivos SQL em `supabase/`. São aplicados **manualmente** no SQL Editor do Supabase —
  **não há migração automática**. Ordem de execução:
  `schema.sql` → `functions.sql` → `speaks.sql` → `extras.sql` → `sala-manual.sql` → `trainees.sql`.
- Quase tudo é `create or replace` / `create ... if not exists` (reexecutável). Exceção:
  o bloco SEED de pessoas no fim do `schema.sql` **duplica** se rodar 2×.
- Ações de admin = funções RPC **protegidas por senha** (em `functions.sql`/`extras.sql`,
  validam `_checar_admin`). Leitura e escrita de presença, speaks e trainees são públicas via RLS.
- Se uma mudança de código exigir mudança de schema, adicione a SQL no arquivo apropriado
  de `supabase/` e **avise o usuário que precisa rodá-la no Supabase** — o agente não consegue aplicá-la.

## Deploy / CI

- `.github/workflows/deploy.yml` — em `push` na branch `main`: `npm install` →
  `npm run build` → publica `out/` no GitHub Pages (Node 20).
- `next.config.mjs` tem a constante **`REPO`**, que define o `basePath` (`/<REPO>`). Deve
  bater com o nome do repositório no GitHub. **Não altere** sem necessidade — renomear o
  repositório obriga a atualizar essa constante, senão o site quebra (JS/CSS dão 404).
- `public/logo.png` é usado pela tela de abertura (`IntroSplash`).

## Arquivos legados — NÃO edite

`index.html`, `webapp.txt`, `Código.txt`, `MIGRACAO-NEXT.md` na raiz são da versão antiga
(Google Apps Script + Sheets), mantidos só como referência. **Não fazem parte do build** —
apenas o `src/` é compilado. Não os edite para mudanças novas.

## Checklist antes de concluir uma mudança

1. `npm install` (se ainda não rodou) e **`npm run build` passa** — obrigatório.
2. Se mexeu em UI, rode `npm run dev` e verifique a aba afetada em `localhost:3000`.
3. Não tocou em arquivos legados, não introduziu TypeScript, não rodou `npm audit fix --force`.

## Raiz do repositório

`src/`, `supabase/`, `public/`, `.github/`, `package.json`, `package-lock.json`,
`next.config.mjs`, `tailwind.config.js`, `postcss.config.js`, `jsconfig.json`,
`.gitignore`, `CLAUDE.md`, e os arquivos legados citados acima.
