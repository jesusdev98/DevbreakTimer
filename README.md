<div align="center">

# FocusFlow

**A wellness-aware Angular PWA for focused work, task planning, and sustainable recovery.**

FocusFlow combines a focus timer, Pomodoro workflows, Kanban planning, and lightweight wellness prompts in an offline-first productivity workspace.

![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=flat-square&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![RxJS](https://img.shields.io/badge/RxJS-7.8-B7178C?style=flat-square&logo=reactivex&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=flat-square)
![Cypress](https://img.shields.io/badge/Cypress-E2E-17202C?style=flat-square&logo=cypress&logoColor=white)
![i18n](https://img.shields.io/badge/i18n-EN%20%7C%20ES%20%7C%20FR-2563EB?style=flat-square)
![Offline first](https://img.shields.io/badge/Offline--first-localStorage-0F766E?style=flat-square)
![Accessibility](https://img.shields.io/badge/Accessibility-keyboard%20ready-4B5563?style=flat-square)

</div>

---

## Overview

FocusFlow is a frontend-only productivity app designed for people who want structure without extra noise. It helps users plan tasks, run focused sessions, follow Pomodoro rhythms, and take short recovery breaks without leaving the workspace.

The product philosophy is simple: focus and recovery belong in the same workflow. FocusFlow keeps productivity metrics practical, wellness prompts lightweight, and user data local to the browser.

## Why FocusFlow

- **Focused by default:** start sessions quickly, track meaningful progress, and keep the active task visible when needed.
- **Wellness-aware:** use Wellness or Hybrid mode for movement-friendly breaks and concise exercise suggestions.
- **Local-first:** tasks, sessions, settings, language, theme, and custom exercises persist offline.
- **Installable:** runs as a desktop or mobile PWA from a static production deployment.
- **Portfolio-ready:** built as a polished Angular application with realistic product constraints.

## Features

### Productivity

- Focus timer with completion, skipped-session, streak, and focus-minute tracking
- Pomodoro mode with configurable focus, short break, and long break durations
- Kanban workspace with create, edit, complete, archive, restore, filter, sort, and drag/drop-ready task flows
- Daily productivity stats derived from canonical task and session history
- Sound presets, volume control, and optional repeating completion alerts

### Wellness

- Wellness mode for recovery-oriented sessions
- Hybrid mode for focus sessions with active break suggestions
- Custom wellness exercises grouped by stretching, mobility, cardio, strength, and Pilates
- Recovery Rhythm insights for completed and omitted recovery interactions
- Mode-aware session notifications with concise recovery suggestions

### PWA & Offline

- Angular service worker integration
- Installable standalone app behavior
- Offline asset caching after first visit
- LocalStorage persistence with defensive restore logic
- Desktop, tablet, mobile, and installed PWA responsive polish
- Static-host deployment support for Vercel, GitHub Pages, Netlify, and similar platforms

### Accessibility & i18n

- Keyboard-friendly primary flows
- Visible focus states and focus restoration
- ARIA labels and live announcements for meaningful state changes
- Runtime language switching for English, Spanish, and French
- Responsive controls designed to remain usable on small screens

## Tech Stack

| Area | Tools |
| --- | --- |
| Framework | Angular |
| Language | TypeScript |
| State & async | RxJS |
| Styling | SCSS |
| UI behavior | Angular CDK |
| PWA | Angular service worker, web app manifest |
| i18n | ngx-translate |
| Testing | Angular test runner, Vitest, Cypress |

## Architecture

FocusFlow uses a modular Angular structure with service-owned state and focused UI components.

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

Architecture highlights:

- Frontend-only application deployable as static assets
- Offline-first behavior with no backend dependency
- LocalStorage persistence with validation and normalization on restore
- Canonical session and task history for productivity metrics
- RxJS streams for timer, session, task, shortcut, language, wellness, and workspace-mode state
- No backend, native wrapper, external store, or sync requirement

## Installation

Install dependencies:

```bash
npm install
```

Run the local development server:

```bash
npm start
```

Open:

```text
http://localhost:4200/
```

Create a production build:

```bash
npm run build
```

Run unit tests:

```bash
npm test -- --watch=false
```

Run Cypress:

```bash
npm run e2e
```

## PWA Support

FocusFlow is configured as an Angular PWA for production builds.

Supported behavior:

- Desktop install in Chrome and Edge
- Android install in supported mobile browsers
- Standalone app display mode
- Offline reload after the first successful visit
- Cached application shell and static assets
- Local persistence for tasks, sessions, settings, language, theme, sounds, and wellness exercises

The app intentionally remains local-first. There is no account system, backend sync, or server dependency.

## Accessibility

FocusFlow includes accessibility support across the main interaction paths:

- Keyboard navigation for settings, task controls, timer actions, and modal-like flows
- Focus restoration after settings interactions
- Escape handling where appropriate
- Screen-reader labels for controls and form fields
- ARIA live regions for timer, task, and wellness announcements
- Reduced interruption design for wellness prompts and completion states

## Screenshots

Screenshots should be captured from the deployed production build so they reflect the final PWA behavior.

| View | Placeholder |
| --- | --- |
| Desktop workspace | Add desktop screenshot |
| Mobile layout | Add mobile screenshot |
| Wellness mode | Add wellness mode screenshot |
| Kanban workspace | Add Kanban screenshot |
| Installed PWA | Add installed PWA screenshot |

## Deployment Notes

FocusFlow builds to static assets and can be hosted on platforms such as Vercel, GitHub Pages, Netlify, or any static hosting provider.

Deployment profile:

- Frontend-only Angular application
- Offline-first installable PWA
- Static-host deployable output
- Local browser persistence through `localStorage`
- Responsive layouts tested across desktop, mobile browser, and installed PWA contexts

Recommended release checks:

```bash
npm ci
npm run build
npm test -- --watch=false
```

For PWA behavior, validate installability and offline reload from a production build over HTTPS or localhost.

## Future Improvements

The current app is complete as a local-first PWA. Realistic future additions could include:

- Optional cloud sync for multi-device continuity
- Import/export for local data portability
- Richer productivity and recovery analytics
- More built-in wellness exercise presets
- Additional language packs

## Project Notes

FocusFlow demonstrates production-minded frontend work:

- Modular Angular architecture
- Offline-first PWA integration
- Responsive application layout
- Defensive local persistence
- Runtime i18n
- Accessibility-aware interaction design
- Behavior-focused testing around sessions, tasks, wellness logic, and productivity stats
