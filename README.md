# FocusFlow

FocusFlow is an installable Angular productivity workspace for focused work, lightweight task planning, and healthier recovery habits.

It combines a focus timer, Pomodoro workflows, a Kanban board, and wellness-aware break suggestions in a frontend-only PWA that works well on desktop, tablet, and mobile.

## Overview

FocusFlow is built around a simple idea: productivity tools should support attention without ignoring recovery. The app helps users plan tasks, run focused sessions, track meaningful daily progress, and take small movement or wellness breaks without adding noise to the workflow.

The application is fully client-side and offline-first. User preferences, sessions, tasks, wellness exercises, language settings, and productivity state are persisted locally with safe restoration and fallback behavior.

## Features

- Focus timer with completion tracking and daily productivity stats
- Pomodoro mode with configurable focus, short break, and long break durations
- Wellness mode for movement-friendly work sessions
- Hybrid mode that blends focus sessions with active recovery prompts
- Kanban workspace with task creation, editing, completion, archiving, restore, filtering, sorting, and drag/drop-ready workflows
- Custom wellness exercises by category, including stretching, mobility, cardio, strength, and Pilates
- Sound personalization with volume, preset, and repeat alert settings
- Runtime internationalization for English, Spanish, and French
- Installable PWA support with manifest, service worker, offline asset caching, and app-like standalone behavior
- LocalStorage-backed offline persistence with defensive normalization for legacy or malformed data
- Responsive layouts for desktop, installed PWA windows, tablets, and mobile screens
- Accessibility-minded interaction design with keyboard navigation, focus handling, labels, and live announcements

## Tech Stack

- Angular
- TypeScript
- RxJS
- SCSS
- Angular CDK
- Angular service worker / PWA support
- ngx-translate
- Vitest / Angular test runner
- Cypress

## Architecture

FocusFlow uses a frontend-only Angular architecture with feature modules for the timer and Kanban workspace. State is owned by focused Angular services and exposed through RxJS streams so UI components can stay mostly presentational.

The app does not require a backend. Persistence is handled through localStorage with validation and normalization on restore. Productivity metrics are derived from canonical session and task history instead of separate drifting counters.

Core architectural choices:

- Client-side only, deployable as static assets
- Offline-first PWA behavior after the first visit
- Service-owned state for timer, session history, tasks, wellness preferences, shortcuts, language, and workspace mode
- Derived productivity stats for completed sessions, skipped sessions, focus minutes, streaks, completed tasks, and recovery rhythm
- Lightweight persistence with safe fallbacks instead of sync infrastructure

## Installation

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm start
```

Open the app:

```text
http://localhost:4200/
```

Create a production build:

```bash
npm run build
```

Run the unit test suite:

```bash
npm test -- --watch=false
```

Run Cypress E2E tests:

```bash
npm run e2e
```

## PWA Support

FocusFlow includes Angular service worker support and a configured web app manifest.

The production build supports:

- Desktop installation in Chromium-based browsers such as Chrome and Edge
- Android installation through supported mobile browsers
- Standalone app display mode
- Offline reload after the first successful visit
- Cached application shell and static assets
- Local persistence for tasks, settings, wellness exercises, language, theme, and productivity history

Because the app is frontend-only, offline support is intentionally local-first. There is no account system or cloud sync layer.

## Accessibility

Accessibility is treated as part of the product surface, not as a separate mode.

The app includes:

- Keyboard-accessible primary flows
- Visible focus states
- Focus restoration for settings and dialog-like interactions
- Escape handling where appropriate
- Form labels and accessible control names
- ARIA live announcements for important timer and task state changes
- Responsive layouts that preserve readable controls on small screens
- Reduced-motion considerations in the UI layer

## Screenshots

Screenshots are intentionally left as placeholders so they can reflect the final deployed build.

### Desktop

Add a desktop screenshot here.

### Mobile

Add a mobile screenshot here.

### Wellness Mode

Add a wellness mode screenshot here.

### Kanban Workspace

Add a Kanban workspace screenshot here.

## Future Improvements

FocusFlow is intentionally complete as a local-first PWA, but a few realistic extensions would fit the product:

- Optional cloud sync for users who want multi-device continuity
- Richer productivity and recovery analytics
- More built-in wellness exercise presets
- Optional import/export for local data portability
- Additional language packs

## Release Notes

FocusFlow is designed as a polished portfolio project that demonstrates production-minded Angular development:

- Modular frontend architecture
- Offline-first PWA integration
- Responsive operational UI
- Local persistence and defensive state restoration
- Runtime i18n
- Accessibility-aware interaction design
- Behavior-focused tests around session tracking, tasks, wellness logic, and productivity stats
