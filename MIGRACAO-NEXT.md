# Migração para Next.js 14 + Tailwind — Etapa 1

## Status
- [x] Scaffold Next.js + Tailwind + dark theme
- [x] Aba **Presença** migrada (React, dark, sem emojis)
- [ ] Aba Draw — pendente
- [ ] Aba Histórico — pendente
- [ ] Aba Admin — pendente

O `index.html` antigo continua intacto e funcional como fallback até a migração terminar.

## Estrutura
```
src/
  app/        layout.jsx, page.jsx (shell + abas), globals.css
  components/ PresencaTab.jsx + ui/ (Card, Button, Alert, Autocomplete)
  lib/        api.js (JSONP), data.js (NOMES_PS)
```

## Rodar localmente
Precisa do Node.js 20+ instalado.
```
npm install
npm run dev
```
Abre em http://localhost:3000

## Antes do primeiro deploy
1. Em `next.config.mjs`, ajuste a constante `REPO` para o nome EXATO do repositório no GitHub.
2. No GitHub: **Settings → Pages → Source → "GitHub Actions"** (não mais "Deploy from a branch").
3. `git push` na branch `main` → o workflow `.github/workflows/deploy.yml` builda e publica sozinho.

## Fluxo de trabalho daqui pra frente
- Editar arquivos em `src/` → `git push` → o GitHub Actions builda e publica.
- Não dá mais para "arrastar 1 arquivo": agora há etapa de build (rodada automaticamente pela Action).
