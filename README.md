<div align="center">

# DevBreak

**A calm Angular productivity workspace for focused work, operational task flow, and sustainable recovery habits.**

![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![RxJS](https://img.shields.io/badge/RxJS-7.8-B7178C?style=for-the-badge&logo=reactivex&logoColor=white)
![SCSS](https://img.shields.io/badge/SCSS-Responsive%20UX-CC6699?style=for-the-badge&logo=sass&logoColor=white)
![Cypress](https://img.shields.io/badge/Cypress-E2E-17202C?style=for-the-badge&logo=cypress&logoColor=white)

</div>

---

## Overview

DevBreak is a portfolio-grade productivity workspace built with Angular. It combines an operational Kanban board, focus sessions, keyboard-first workflows, wellness-aware reminders, local persistence, accessibility support, and responsive dashboard ergonomics.

The product is intentionally calm: it helps users move work forward without turning productivity into a noisy scoring system.

---

## Highlights

- Operational Kanban board with create, edit, archive, restore, drag/drop-ready workflows
- Quick-add per column for low-friction task capture
- Advanced filters, sorting, density modes, and search
- Focus ownership mode with active-task workflow
- Timer and Pomodoro sessions with resilient timestamp-based persistence
- Adaptive wellness reminders for hydration, posture, and movement recovery
- Contextual recovery suggestions and lightweight wellness consistency tracking
- Keyboard shortcut personalization with conflict prevention
- Workspace and daily productivity reset actions
- Dark/light themes, reduced-motion support, and responsive layouts
- Cypress E2E coverage for core workflows, persistence, keyboard, and accessibility behavior

---

## Product Philosophy

DevBreak is not a Pomodoro clone and not a fitness tracker. It is a focused workspace that treats productivity and recovery as part of the same workflow.

Wellness guidance is intentionally subtle:

- no blocking modals
- no gamification pressure
- no productivity guilt
- no invasive notifications
- supportive summaries only after meaningful activity exists

---

## Architecture

The app uses a modular feature structure with service-owned state and presentational component boundaries.

```text
src/app/
  features/
    kanban/
      components/
      models/
      services/
    timer/
      components/
      models/
      services/
  models/
  services/
```

Key architectural choices:

- RxJS streams for timer, workspace mode, focus, wellness, and derived UI state
- LocalStorage persistence with validation and safe fallbacks
- Angular CDK DragDrop for board interactions
- Focused presentational component boundaries for settings, timer actions, wellness cards, and insights
- CSS variables for density, theme, and responsive ergonomics
- Minimal global state, no backend assumptions, no heavyweight store layer

---

## Accessibility

DevBreak includes an accessibility pass across semantics, keyboard behavior, screen-reader feedback, and motion preferences.

- Landmark and heading structure
- Accessible form labels and icon/control labels
- Visible focus states
- ESC handling and focus restoration
- Keyboard activation parity for primary workflows
- ARIA live regions for meaningful state changes
- `prefers-reduced-motion` support
- Cypress coverage for keyboard and accessibility-critical flows

---

## Testing & Reliability

```bash
npm test
npm run build
npm run e2e
```

Current validation status:

- 56 automated tests passing
- Production build passing
- Cypress workflow coverage stable

Coverage includes:

- Unit tests for timer persistence, wellness heuristics, shortcuts, filters, density, and component behavior
- Cypress E2E tests for Kanban, focus sessions, persistence restore, keyboard workflows, and reduced-motion smoke coverage
- Production build validation through Angular budgets

Note for local Windows shells: if Cypress inherits `ELECTRON_RUN_AS_NODE`, clear it before running E2E.

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$env:CYPRESS_SKIP_VERIFY='true'
npm run e2e
```

---

## Tech Stack

- Angular
- TypeScript
- RxJS
- SCSS
- Angular CDK
- Vitest / Angular unit testing
- Cypress
- GitHub Actions

---

## Getting Started

Use the Node version in `.nvmrc`.

```bash
npm install
npm start
```

Open:

```text
http://localhost:4200/
```

Production build:

```bash
npm run build
```

---

## Deployment

The app is static-build ready.

### GitHub Pages

The included workflow builds the Angular app with a repository-based `base-href`, uploads `dist/devbreak-timer/browser`, and adds a `404.html` fallback for SPA-compatible refresh behavior.

Required repository setting:

```text
Settings -> Pages -> Source -> GitHub Actions
```

### Vercel

Recommended settings:

```text
Framework Preset: Angular
Build Command: npm run build
Output Directory: dist/devbreak-timer/browser
Install Command: npm ci
```

For SPA fallback routing, add a Vercel rewrite if routes are introduced later.

---

## GitHub Actions

Workflows are intentionally lightweight:

- CI: install, unit tests, production build
- Pages deploy: install, unit tests, production build, upload static artifact

Cypress remains available for local and future CI expansion without making the default pipeline heavy.

---

## Portfolio Notes

DevBreak demonstrates production-minded frontend work:

- product-oriented UX decisions
- accessible keyboard-first interaction design
- resilient local persistence
- maintainable Angular boundaries
- responsive operational UI
- calm wellness-aware behavior
- meaningful automated reliability coverage