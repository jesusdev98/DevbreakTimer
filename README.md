# DevBreak Timer

![Angular](https://img.shields.io/badge/Angular-21-red)
![TypeScript](https://img.shields.io/badge/TypeScript-blue)
![Status](https://img.shields.io/badge/status-live-success)

## 🚀 Live Demo
👉 https://jesusdev98.github.io/DevbreakTimer/

---

## 🧠 Overview
DevBreak Timer is a focused productivity timer built for developers and knowledge workers who want a lightweight way to structure work sessions.
It handles countdown flow, pause and resume states, and completion feedback in a clean UI that fits short focus blocks and break-based routines.

---

## ✨ Features

- Smart countdown (`start` / `pause` / `resume` / `restart`)
- Dynamic time formatting (`mm:ss` → `hh:mm:ss`)
- Progress bar synced with remaining time
- Browser notifications + sound on completion
- Random break exercise suggestion
- Reactive state management with RxJS
- Safe `localStorage` persistence with validation
- Responsive and polished UI

---

## 🖼️ Preview

![App Preview](public/assets/screenshot.png)

---

## 🛠 Tech Stack

- Angular
- TypeScript
- RxJS
- SCSS

---

## ⚙️ Run locally

```bash
npm install
ng serve
```

---

## 🧩 Technical Highlights

- State isolated in a dedicated service for cleaner architecture
- `BehaviorSubject` keeps the UI reactive and immediately in sync
- Defensive `localStorage` parsing before restoring persisted state
- UI concerns separated from timer logic and persistence rules

---

## 📈 Future Improvements

- Presets such as Pomodoro cycles
- Settings panel
- Sound customization
