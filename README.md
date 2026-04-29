# DevBreak Timer

A focused Angular timer built for clean state flow, clear feedback, and better break habits.

![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=flat-square\&logo=angular\&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square\&logo=typescript\&logoColor=white)
![RxJS](https://img.shields.io/badge/RxJS-7.8-B7178C?style=flat-square\&logo=reactivex\&logoColor=white)
![Status](https://img.shields.io/badge/status-live-success?style=flat-square)

---

## 🚀 Live Demo

👉 [https://jesusdev98.github.io/DevbreakTimer/](https://jesusdev98.github.io/DevbreakTimer/)

---

## 🧠 Overview

DevBreak Timer is a lightweight productivity app for structured work sessions.
It combines countdown control, reactive state, progress feedback, and break prompts in a compact dark UI.

---

## 💡 Problem & Approach

Most simple timers stop at counting down.
This project focuses on the layer around the timer: state consistency, resilient persistence, and completion feedback that makes the session feel complete.

The goal was to build a small app with production-minded frontend decisions, not just a working counter.

---

## 🎯 Why this project stands out

* Timer logic is isolated in a dedicated service instead of being mixed into the component
* RxJS `BehaviorSubject` drives the UI with immediate access to the latest state
* Persisted state is validated before restore to avoid broken or stale sessions
* UI rendering stays separate from countdown behavior and storage rules
* Completion feedback includes visual state changes, browser notifications, sound, and a break exercise prompt

A small product, built with the same separation-of-concerns mindset used in larger applications.

---

## 🖼️ Preview

### 🟢 Running session

Live countdown state with progress tracking and focused visual feedback.

![Running](public/assets/running.png)

### 🔵 Session completed

End-of-session feedback with completion state and break prompt.

![Completed](public/assets/completed.png)

---

## ✨ Features

* Smart countdown with `start`, `pause`, `resume`, and `reset`
* Dynamic time formatting from `mm:ss` to `hh:mm:ss`
* Progress bar synced with remaining time
* Reactive timer state powered by RxJS `BehaviorSubject`
* Browser notifications and completion sound
* Random break exercise suggestion after each session
* Safe `localStorage` persistence with validation
* Responsive dark UI built with SCSS

---

## 🛠️ Tech Stack

* Angular
* TypeScript
* RxJS
* SCSS

---

## ⚙️ Run locally

```bash
npm install
ng serve
```

The app runs at: [http://localhost:4200/](http://localhost:4200/)

---

## 🧩 Technical Highlights

* Service-first state management for cleaner architecture
* Immediate reactive updates through observable streams
* Defensive persistence strategy with state-shape validation
* Time formatting handled separately from timer mechanics
* UI-side completion effects kept outside core timer logic

---

## 🧪 Quality & Reliability

* State validation prevents restoring invalid sessions
* Consistent state transitions (idle → running → paused → completed)
* Safe handling of persisted data
* Guarded execution of side effects

---

## ⚙️ Design Decisions

* RxJS used for predictable and reactive UI synchronization
* Timer logic separated from components to avoid duplication
* Minimal UI chosen to prioritize clarity over feature overload

---

## 📈 Future Improvements

* Presets for common focus cycles such as Pomodoro
* Settings panel for duration and notification preferences
* Custom sound selection
* Optional session history

---

## 👨‍💻 Author

Jesús Martínez
Full Stack Developer

---

## ⭐ Final Note

This project focuses on clarity, state management, and user experience rather than feature complexity.

Built to demonstrate real-world frontend thinking in a small scope.
