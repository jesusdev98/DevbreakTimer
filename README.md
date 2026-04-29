# DevBreak Timer

DevBreak Timer is a small Angular productivity app built around a focused countdown flow: set a duration, start the timer, pause or resume when needed, and get a break prompt when the session ends.

## Screenshot

![DevBreak Timer screenshot placeholder](./docs/devbreak-timer-screenshot.png)

_Replace this image with an updated app screenshot._

## Features

- Start, pause, resume, and reset timer flow
- Reactive state management with RxJS `BehaviorSubject`
- Local persistence with `localStorage`
- Clean startup that validates persisted state before using it
- Dynamic time formatting: `mm:ss` for shorter sessions and `hh:mm:ss` for longer ones
- Progress bar synced with the remaining time
- Browser notification on completion
- Random break exercise suggestion when the timer ends
- Responsive UI styled with SCSS

## Tech Stack

- Angular 21
- TypeScript
- RxJS
- SCSS
- Vitest

## Run Locally

```bash
npm install
npm start
```

The app runs by default at `http://localhost:4200/`.

Useful commands:

```bash
npm run build
npm test
```

## Technical Decisions

- The timer logic lives in a dedicated service instead of the component. This keeps countdown behavior, status transitions, and persistence isolated from the UI layer.
- RxJS `BehaviorSubject` is used for the timer state because the view needs the latest value immediately on subscription and must react to updates over time.
- Persistence is intentionally conservative. The service reads from `localStorage`, validates the stored shape and values, and falls back to a clean initial state if the data is invalid or stale.
- The component focuses on presentation concerns such as formatting the time, mapping state to button behavior, and updating the progress bar.
- Time formatting is handled explicitly to support both short sessions and longer runs without changing the underlying timer model.
- Completion feedback is split into two UI-facing concerns: a browser notification and a random exercise prompt, which keeps the timer service independent from browser-specific side effects.

## Future Improvements

- Add configurable presets such as `25 / 5` or custom work-break cycles
- Bundle and validate the completion sound asset as part of the app
- Add a small test suite for timer transitions and persistence edge cases
