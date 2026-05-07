<div align="center">

# DevBreak Timer

**A polished Angular productivity timer for focused work, intentional breaks, and reliable Pomodoro sessions.**

![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![RxJS](https://img.shields.io/badge/RxJS-7.8-B7178C?style=for-the-badge&logo=reactivex&logoColor=white)
![SCSS](https://img.shields.io/badge/SCSS-Design%20Tokens-CC6699?style=for-the-badge&logo=sass&logoColor=white)
![Cypress](https://img.shields.io/badge/Cypress-E2E-17202C?style=for-the-badge&logo=cypress&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-Vitest%20%2B%20Angular-10B981?style=for-the-badge)

</div>

---

## Project Overview

DevBreak Timer is a focused Angular productivity app built around reliable countdowns, Pomodoro workflows, and a refined responsive interface. It supports classic timer usage, automatic focus/break cycles, custom Pomodoro profiles, persistent settings, sound alerts, browser notifications, and dark/light themes.

The project is intentionally compact, but built with production-minded frontend patterns: typed state models, RxJS streams, a timestamp-based timer engine, validated local persistence, theme tokens, and automated test coverage.

It is also PWA-ready in philosophy: responsive, installable-app friendly, locally persistent, and designed around a focused single-purpose workflow.

## Features

- **Pomodoro mode** with focus, short break, and long break sessions
- **Built-in profiles**: Classic, Deep Work, and Study
- **Custom Pomodoro settings** for focus, break, long break, and cycle count
- **Automatic session progression** with clear current/next session feedback
- **Real-time timestamp timer engine** that avoids interval drift
- **Dark and light themes** powered by scalable CSS variables
- **Browser notifications** for completed sessions
- **Sound alerts** with safe autoplay error handling
- **Local persistence** for timer state, settings, profile, theme, and workflow recovery
- **Responsive design** tuned for mobile and desktop
- **Installable-ready architecture** with a self-contained productivity experience
- **Unit, component, and E2E testing strategy**

## Tech Stack

- **Angular** for application structure and templates
- **TypeScript** for strongly typed timer, settings, and workflow models
- **RxJS** for reactive timer and UI state streams
- **SCSS** for responsive styling, theme tokens, and visual polish
- **Angular CLI** for development, builds, and test orchestration
- **Vitest / Angular testing utilities** for unit and component coverage
- **Cypress** for browser-level E2E scenarios

## Architecture

### Timestamp-Based Timer Engine

The timer is driven by an absolute target timestamp instead of trusting `setInterval` as the source of truth. The interval only refreshes the UI; remaining time is recalculated from wall-clock time.

```ts
targetEndTimestamp = Date.now() + durationInSeconds * 1000;
remainingTime = targetEndTimestamp - Date.now();
```

This keeps the timer accurate when the tab is backgrounded, the browser throttles timers, or the app is restored after a reload.

### Centralized Settings State

Timer duration, Pomodoro profiles, custom cycles, theme mode, and sound preferences live in one typed settings model. The UI edits a draft settings state and applies changes through the timer service, keeping workflow logic centralized.

### Theme Token System

Dark and light themes are implemented with CSS variables at the global layer. Components consume semantic tokens for surfaces, action buttons, text, borders, shadows, progress, and disabled states, which keeps the design scalable without duplicated styles.

### Persistence Strategy

The app stores a validated snapshot in `localStorage`, including:

- timer target timestamp and remaining time
- active timer status
- selected settings and custom Pomodoro profile
- current Pomodoro workflow state
- theme and sound preferences
- last unhandled completion event

Invalid or legacy state is normalized before restore, so persistence remains resilient as the app evolves.

## Testing

The project includes coverage at multiple levels:

- **Unit tests** for the timer service, timestamp synchronization, persistence restore, Pomodoro transitions, and completion events
- **Component tests** for user controls, disabled states, settings-driven rendering, Pomodoro visibility, and UI interactions
- **E2E tests** with Cypress for browser-level flows such as starting timers, reload persistence, responsive usage, and notification behavior

The service tests use controlled fake timers and mocked `Date.now()` so timing behavior is deterministic instead of flaky.

## Responsive UI + Themes

DevBreak Timer uses a mobile-first layout with stable controls, clear session hierarchy, and compact settings access. The visual system preserves the same product feel across both themes:

- dark theme: immersive, focused, premium
- light theme: clean, calm, readable
- shared design tokens for consistent surfaces and action states
- responsive controls that avoid layout shifts

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm start
```

Open:

```text
http://localhost:4200/
```

Run unit and component tests:

```bash
npm test
```

Build for production:

```bash
npm run build
```

Run Cypress E2E tests:

```bash
npm run e2e
```

## Project Structure

```text
devbreak-timer/
  cypress/
    e2e/
    support/
  public/
    assets/
  src/
    app/
      features/
        timer/
          components/
            timer-container/
          services/
      app.html
      app.module.ts
      app.scss
      app.ts
    styles.scss
  angular.json
  package.json
```

## Roadmap

- PWA manifest and service worker setup
- Installable desktop/mobile experience
- Session history and streak tracking
- Lightweight productivity analytics
- Exportable focus summaries

## Why This Project Matters

DevBreak Timer demonstrates the kind of frontend work that makes a small product feel complete: reliable state, thoughtful interaction design, polished themes, responsive UI, accessible controls, and tests around the behavior that matters.
