import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PomodoroState,
  SessionDurations,
  TimerCompletionEvent,
  TimerService,
  TimerSettings,
  TimerStatus,
} from './timer.service';

type StoredTimerState = {
  targetEndTimestamp: number | null;
  remainingTime: number;
  initialDuration: number;
  status: TimerStatus;
  settings: TimerSettings;
  pomodoro: PomodoroState;
  lastCompletionEvent: TimerCompletionEvent | null;
};

describe('TimerService', () => {
  const storageKey = 'devbreak-timer-state';
  let now = 1_700_000_000_000;
  let service: TimerService;

  const defaultDurations: SessionDurations = {
    focus: 25 * 60,
    'short-break': 5 * 60,
    'long-break': 15 * 60,
  };

  const defaultSettings: TimerSettings = {
    selectedDuration: defaultDurations.focus,
    durations: defaultDurations,
    cyclesBeforeLongBreak: 4,
    soundEnabled: true,
    theme: 'dark',
    pomodoroProfileId: 'classic',
    customPomodoroProfile: {
      id: 'custom',
      name: 'Custom',
      description: 'Your durations',
      durations: defaultDurations,
      cyclesBeforeLongBreak: 4,
    },
  };

  const defaultPomodoro: PomodoroState = {
    enabled: false,
    currentSession: 'focus',
    completedFocusSessions: 0,
    cycle: 1,
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    now = 1_700_000_000_000;
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    service?.ngOnDestroy();
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('starts a timestamp-based timer and persists the target end timestamp', () => {
    service = TestBed.inject(TimerService);

    service.start(60);

    expect(readLatest(service.status$)).toBe('running');
    expect(readLatest(service.remainingTime$)).toBe(60);
    expect(readStoredState().targetEndTimestamp).toBe(now + 60_000);
  });

  it('pauses using the current timestamp snapshot', () => {
    service = TestBed.inject(TimerService);
    service.start(60);

    now += 10_000;
    vi.advanceTimersByTime(1_000);
    service.pause();

    expect(readLatest(service.status$)).toBe('paused');
    expect(readLatest(service.remainingTime$)).toBe(50);
    expect(readStoredState().targetEndTimestamp).toBeNull();
  });

  it('resumes from the paused remaining snapshot', () => {
    service = TestBed.inject(TimerService);
    service.start(60);

    now += 10_000;
    service.pause();
    now += 5_000;
    service.start();

    expect(readStoredState().targetEndTimestamp).toBe(now + 50_000);

    now += 20_000;
    vi.advanceTimersByTime(1_000);

    expect(readLatest(service.remainingTime$)).toBe(30);
  });

  it('resets to the current timer duration and returns to idle', () => {
    service = TestBed.inject(TimerService);
    service.start(45);

    now += 12_000;
    service.reset();

    expect(readLatest(service.status$)).toBe('idle');
    expect(readLatest(service.remainingTime$)).toBe(45);
    expect(readStoredState().targetEndTimestamp).toBeNull();
  });

  it('resynchronizes from Date.now on visibility changes without waiting for missed ticks', () => {
    service = TestBed.inject(TimerService);
    service.start(60);

    now += 15_000;
    document.dispatchEvent(new Event('visibilitychange'));

    expect(readLatest(service.remainingTime$)).toBe(45);
  });

  it('resynchronizes from Date.now on window focus', () => {
    service = TestBed.inject(TimerService);
    service.start(60);

    now += 22_000;
    window.dispatchEvent(new Event('focus'));

    expect(readLatest(service.remainingTime$)).toBe(38);
  });

  it('completes immediately when the target timestamp has already expired', () => {
    service = TestBed.inject(TimerService);
    const events: TimerCompletionEvent[] = [];
    service.completionEvent$.subscribe((event) => {
      if (event !== null) {
        events.push(event);
      }
    });

    service.start(10);
    now += 10_001;
    window.dispatchEvent(new Event('focus'));

    expect(readLatest(service.status$)).toBe('completed');
    expect(readLatest(service.remainingTime$)).toBe(0);
    expect(events.length).toBe(1);
    expect(events[0].sessionType).toBe('focus');
    expect(events[0].nextSessionType).toBeNull();
  });

  it('restores persisted running state and recalculates remaining time on load', () => {
    writeStoredState({
      targetEndTimestamp: now + 30_000,
      remainingTime: 60,
      initialDuration: 60,
      status: 'running',
      settings: defaultSettings,
      pomodoro: defaultPomodoro,
      lastCompletionEvent: null,
    });

    service = TestBed.inject(TimerService);

    expect(readLatest(service.status$)).toBe('running');
    expect(readLatest(service.remainingTime$)).toBe(30);
  });

  it('emits a restored completion event only until it is acknowledged', () => {
    const completionEvent: TimerCompletionEvent = {
      id: now,
      completedAt: now,
      sessionType: 'focus',
      nextSessionType: null,
      pomodoroEnabled: false,
    };
    writeStoredState({
      targetEndTimestamp: null,
      remainingTime: 0,
      initialDuration: 60,
      status: 'completed',
      settings: defaultSettings,
      pomodoro: defaultPomodoro,
      lastCompletionEvent: completionEvent,
    });

    service = TestBed.inject(TimerService);

    expect(readLatest(service.completionEvent$)?.id).toBe(completionEvent.id);

    service.acknowledgeCompletionEvent(completionEvent.id);

    expect(readLatest(service.completionEvent$)).toBeNull();
    expect(readStoredState().lastCompletionEvent).toBeNull();
  });

  it('transitions from focus to short break and auto-starts the next Pomodoro session', () => {
    service = TestBed.inject(TimerService);
    const events: TimerCompletionEvent[] = collectCompletionEvents(service);
    configureOneSecondPomodoro();

    service.start(1);
    now += 1_001;
    window.dispatchEvent(new Event('focus'));

    expect(events.length).toBe(1);
    expect(events[0].sessionType).toBe('focus');
    expect(events[0].nextSessionType).toBe('short-break');
    expect(readLatest(service.pomodoroState$).currentSession).toBe('short-break');
    expect(readLatest(service.status$)).toBe('running');
    expect(readStoredState().targetEndTimestamp).toBe(now + 1_000);
  });

  it('uses a long break after four completed focus sessions and counts the cycle correctly', () => {
    service = TestBed.inject(TimerService);
    const events: TimerCompletionEvent[] = collectCompletionEvents(service);
    configureOneSecondPomodoro();

    service.start(1);
    completePomodoroSession();
    completePomodoroSession();
    completePomodoroSession();
    completePomodoroSession();
    completePomodoroSession();
    completePomodoroSession();

    expect(readLatest(service.pomodoroState$).currentSession).toBe('focus');
    expect(readLatest(service.pomodoroState$).cycle).toBe(4);

    completePomodoroSession();

    const lastEvent = events[events.length - 1];
    expect(lastEvent.sessionType).toBe('focus');
    expect(lastEvent.nextSessionType).toBe('long-break');
    expect(readLatest(service.pomodoroState$).currentSession).toBe('long-break');
    expect(readLatest(service.pomodoroState$).completedFocusSessions).toBe(4);
    expect(readLatest(service.pomodoroState$).cycle).toBe(4);
    expect(readLatest(service.status$)).toBe('running');
  });

  it('does not emit duplicate completion events for the same expired timer', () => {
    service = TestBed.inject(TimerService);
    const events: TimerCompletionEvent[] = collectCompletionEvents(service);

    service.start(1);
    now += 1_001;
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(events.length).toBe(1);
  });

  function configureOneSecondPomodoro(): void {
    service.setSessionDuration('focus', 1);
    service.setSessionDuration('short-break', 1);
    service.setSessionDuration('long-break', 1);
    service.setPomodoroEnabled(true);
  }

  function completePomodoroSession(): void {
    now += 1_001;
    window.dispatchEvent(new Event('focus'));
  }

  function collectCompletionEvents(timerService: TimerService): TimerCompletionEvent[] {
    const events: TimerCompletionEvent[] = [];
    timerService.completionEvent$.subscribe((event) => {
      if (event !== null) {
        events.push(event);
      }
    });

    return events;
  }

  function readLatest<T>(source$: { subscribe: (next: (value: T) => void) => { unsubscribe: () => void } }): T {
    let latest!: T;
    const subscription = source$.subscribe((value: T) => {
      latest = value;
    });
    subscription.unsubscribe();

    return latest;
  }

  function writeStoredState(state: StoredTimerState): void {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function readStoredState(): StoredTimerState {
    return JSON.parse(localStorage.getItem(storageKey) ?? '{}') as StoredTimerState;
  }
});
