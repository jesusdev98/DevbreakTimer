import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, fromEvent, interval, merge } from 'rxjs';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';
export type SessionType = 'focus' | 'short-break' | 'long-break';
export type ThemeMode = 'dark' | 'light';
export type PomodoroProfileId = 'classic' | 'deep-work' | 'study' | 'custom';

export type SessionDurations = Record<SessionType, number>;

export interface PomodoroProfile {
  id: PomodoroProfileId;
  name: string;
  description: string;
  durations: SessionDurations;
  cyclesBeforeLongBreak: number;
}

export interface PomodoroState {
  enabled: boolean;
  currentSession: SessionType;
  completedFocusSessions: number;
  cycle: number;
}

export interface AppSettings {
  selectedDuration: number;
  durations: SessionDurations;
  cyclesBeforeLongBreak: number;
  soundEnabled: boolean;
  theme: ThemeMode;
  pomodoroProfileId: PomodoroProfileId;
  customPomodoroProfile: PomodoroProfile;
}

export type TimerSettings = AppSettings;

export interface TimerCompletionEvent {
  id: number;
  completedAt: number;
  sessionType: SessionType;
  nextSessionType: SessionType | null;
  pomodoroEnabled: boolean;
}

type StoredTimerState = {
  targetEndTimestamp: number | null;
  remainingTime: number;
  initialDuration: number;
  status: TimerStatus;
  settings: TimerSettings;
  pomodoro: PomodoroState;
  lastCompletionEvent: TimerCompletionEvent | null;
};

@Injectable({
  providedIn: 'root',
})
export class TimerService implements OnDestroy {
  private static readonly STORAGE_KEY = 'devbreak-timer-state';
  private static readonly TICK_INTERVAL_MS = 1000;

  public static readonly BUILT_IN_POMODORO_PROFILES: readonly PomodoroProfile[] = [
    {
      id: 'classic',
      name: 'Classic',
      description: '25 / 5 / 15',
      durations: {
        focus: 25 * 60,
        'short-break': 5 * 60,
        'long-break': 15 * 60,
      },
      cyclesBeforeLongBreak: 4,
    },
    {
      id: 'deep-work',
      name: 'Deep Work',
      description: '50 / 10 / 30',
      durations: {
        focus: 50 * 60,
        'short-break': 10 * 60,
        'long-break': 30 * 60,
      },
      cyclesBeforeLongBreak: 4,
    },
    {
      id: 'study',
      name: 'Study',
      description: '45 / 15 / 20',
      durations: {
        focus: 45 * 60,
        'short-break': 15 * 60,
        'long-break': 20 * 60,
      },
      cyclesBeforeLongBreak: 3,
    },
  ];

  private static readonly CUSTOM_PROFILE_ID: PomodoroProfileId = 'custom';

  private readonly remainingTimeSubject = new BehaviorSubject<number>(0);
  private readonly durationSubject = new BehaviorSubject<number>(0);
  private readonly statusSubject = new BehaviorSubject<TimerStatus>('idle');
  private readonly completedSubject = new BehaviorSubject<boolean>(false);
  private readonly settingsSubject = new BehaviorSubject<TimerSettings>(this.createDefaultSettings());
  private readonly pomodoroStateSubject = new BehaviorSubject<PomodoroState>(this.createDefaultPomodoroState());
  private readonly completionEventSubject = new BehaviorSubject<TimerCompletionEvent | null>(null);

  private timerSubscription: Subscription | null = null;
  private resyncSubscription: Subscription | null = null;
  private targetEndTimestamp: number | null = null;
  private remainingTime = 0;
  private initialDuration = 0;
  private status: TimerStatus = 'idle';
  private settings = this.createDefaultSettings();
  private pomodoro = this.createDefaultPomodoroState();
  private lastCompletionEvent: TimerCompletionEvent | null = null;

  public readonly remainingTime$: Observable<number> = this.remainingTimeSubject.asObservable();
  public readonly duration$: Observable<number> = this.durationSubject.asObservable();
  public readonly status$: Observable<TimerStatus> = this.statusSubject.asObservable();
  public readonly completed$: Observable<boolean> = this.completedSubject.asObservable();
  public readonly settings$: Observable<TimerSettings> = this.settingsSubject.asObservable();
  public readonly pomodoroState$: Observable<PomodoroState> = this.pomodoroStateSubject.asObservable();
  public readonly completionEvent$: Observable<TimerCompletionEvent | null> =
    this.completionEventSubject.asObservable();

  public constructor() {
    this.loadState();
    this.applyTheme(this.settings.theme);
    this.bindResyncEvents();
  }

  public start(duration?: number): void {
    if (duration !== undefined) {
      this.startNewTimer(duration);
      return;
    }

    if (this.status !== 'paused' || this.remainingTime <= 0) {
      return;
    }

    this.targetEndTimestamp = Date.now() + (this.remainingTime * 1000);
    this.startTimerSubscription();
  }

  public pause(): void {
    if (this.remainingTime <= 0 || this.status === 'paused') {
      return;
    }

    this.clearTimerSubscription();
    this.syncRemainingTime();
    this.targetEndTimestamp = null;
    this.setStatus('paused');
    this.saveState();
  }

  public reset(): void {
    this.clearTimerSubscription();
    this.targetEndTimestamp = null;
    this.remainingTime = this.initialDuration;
    this.publishRemainingTime();
    this.setStatus('idle');
    this.saveState();
  }

  public setSelectedDuration(duration: number): void {
    this.assertValidDuration(duration);
    this.settings = {
      ...this.settings,
      selectedDuration: duration,
    };
    this.publishSettings();

    if (!this.pomodoro.enabled && this.status !== 'running') {
      this.initialDuration = duration;
      this.remainingTime = duration;
      this.publishDuration();
      this.publishRemainingTime();
    }

    this.saveState();
  }

  public setPomodoroEnabled(enabled: boolean): void {
    if (this.pomodoro.enabled === enabled) {
      return;
    }

    this.pomodoro = {
      ...this.pomodoro,
      enabled,
    };
    this.publishPomodoroState();

    if (enabled && this.status !== 'running') {
      const duration = this.settings.durations[this.pomodoro.currentSession];
      this.initialDuration = duration;
      this.remainingTime = duration;
      this.publishDuration();
      this.publishRemainingTime();
    }

    if (!enabled && this.status !== 'running') {
      this.initialDuration = this.settings.selectedDuration;
      this.remainingTime = this.settings.selectedDuration;
      this.publishDuration();
      this.publishRemainingTime();
    }

    this.saveState();
  }

  public setSoundEnabled(enabled: boolean): void {
    this.settings = {
      ...this.settings,
      soundEnabled: enabled,
    };
    this.publishSettings();
    this.saveState();
  }

  public setTheme(theme: ThemeMode): void {
    this.settings = {
      ...this.settings,
      theme,
    };
    this.applyTheme(theme);
    this.publishSettings();
    this.saveState();
  }

  public setPomodoroProfile(profileId: PomodoroProfileId): void {
    const profile = this.getProfileById(profileId);

    if (profile === null) {
      return;
    }

    this.settings = {
      ...this.settings,
      pomodoroProfileId: profileId,
      durations: { ...profile.durations },
      cyclesBeforeLongBreak: profile.cyclesBeforeLongBreak,
    };

    this.publishSettings();
    this.syncActiveSessionDuration();
    this.saveState();
  }

  public setCustomPomodoroProfile(profile: Pick<PomodoroProfile, 'durations' | 'cyclesBeforeLongBreak'>): void {
    this.assertValidDuration(profile.durations.focus);
    this.assertValidDuration(profile.durations['short-break']);
    this.assertValidDuration(profile.durations['long-break']);
    this.assertValidCycleCount(profile.cyclesBeforeLongBreak);

    const customPomodoroProfile: PomodoroProfile = {
      ...this.settings.customPomodoroProfile,
      durations: { ...profile.durations },
      cyclesBeforeLongBreak: profile.cyclesBeforeLongBreak,
    };

    this.settings = {
      ...this.settings,
      pomodoroProfileId: TimerService.CUSTOM_PROFILE_ID,
      customPomodoroProfile,
      durations: { ...customPomodoroProfile.durations },
      cyclesBeforeLongBreak: customPomodoroProfile.cyclesBeforeLongBreak,
    };

    this.publishSettings();
    this.syncActiveSessionDuration();
    this.saveState();
  }

  public acknowledgeCompletionEvent(eventId: number): void {
    if (this.lastCompletionEvent?.id !== eventId) {
      return;
    }

    this.lastCompletionEvent = null;
    this.completionEventSubject.next(null);
    this.saveState();
  }

  public setSessionDuration(sessionType: SessionType, duration: number): void {
    this.assertValidDuration(duration);
    const customPomodoroProfile: PomodoroProfile = {
      ...this.settings.customPomodoroProfile,
      durations: {
        ...this.settings.customPomodoroProfile.durations,
        [sessionType]: duration,
      },
    };

    this.settings = {
      ...this.settings,
      pomodoroProfileId: TimerService.CUSTOM_PROFILE_ID,
      customPomodoroProfile,
      durations: { ...customPomodoroProfile.durations },
      cyclesBeforeLongBreak: customPomodoroProfile.cyclesBeforeLongBreak,
    };
    this.publishSettings();

    if (this.pomodoro.enabled && this.pomodoro.currentSession === sessionType && this.status !== 'running') {
      this.initialDuration = duration;
      this.remainingTime = duration;
      this.publishDuration();
      this.publishRemainingTime();
    }

    this.saveState();
  }

  public ngOnDestroy(): void {
    this.clearTimerSubscription();
    this.clearResyncSubscription();
    this.remainingTimeSubject.complete();
    this.durationSubject.complete();
    this.statusSubject.complete();
    this.completedSubject.complete();
    this.settingsSubject.complete();
    this.pomodoroStateSubject.complete();
    this.completionEventSubject.complete();
  }

  private startNewTimer(duration: number): void {
    this.assertValidDuration(duration);
    this.clearTimerSubscription();

    this.initialDuration = duration;
    this.remainingTime = duration;
    this.targetEndTimestamp = Date.now() + (duration * 1000);
    this.publishDuration();
    this.publishRemainingTime();
    this.startTimerSubscription();
  }

  private startTimerSubscription(): void {
    if (this.remainingTime <= 0 || this.timerSubscription !== null) {
      return;
    }

    this.setStatus('running');
    this.saveState();
    this.syncRemainingTime();

    this.timerSubscription = interval(TimerService.TICK_INTERVAL_MS).subscribe((): void => {
      this.syncRemainingTime();
    });
  }

  private clearTimerSubscription(): void {
    if (this.timerSubscription === null) {
      return;
    }

    this.timerSubscription.unsubscribe();
    this.timerSubscription = null;
  }

  private clearResyncSubscription(): void {
    if (this.resyncSubscription === null) {
      return;
    }

    this.resyncSubscription.unsubscribe();
    this.resyncSubscription = null;
  }

  private bindResyncEvents(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    this.resyncSubscription = merge(
      fromEvent(document, 'visibilitychange'),
      fromEvent(window, 'focus'),
    ).subscribe((): void => {
      if (this.status === 'running') {
        this.syncRemainingTime();
      }
    });
  }

  private assertValidDuration(duration: number): void {
    if (!Number.isInteger(duration) || duration <= 0) {
      throw new Error('Timer duration must be a positive integer.');
    }
  }

  private assertValidCycleCount(cyclesBeforeLongBreak: number): void {
    if (!Number.isInteger(cyclesBeforeLongBreak) || cyclesBeforeLongBreak < 1 || cyclesBeforeLongBreak > 12) {
      throw new Error('Pomodoro cycles must be an integer between 1 and 12.');
    }
  }

  private syncRemainingTime(): void {
    if (this.status !== 'running' || this.targetEndTimestamp === null) {
      return;
    }

    const remainingMilliseconds = this.targetEndTimestamp - Date.now();
    const nextRemainingTime = Math.max(0, Math.ceil(remainingMilliseconds / 1000));

    if (nextRemainingTime !== this.remainingTime) {
      this.remainingTime = nextRemainingTime;
      this.publishRemainingTime();
    }

    if (remainingMilliseconds > 0) {
      this.saveState();
      return;
    }

    this.completeCurrentTimer();
  }

  private completeCurrentTimer(): void {
    const completedSessionType = this.pomodoro.currentSession;

    this.clearTimerSubscription();
    this.targetEndTimestamp = null;
    this.remainingTime = 0;
    this.publishRemainingTime();

    if (!this.pomodoro.enabled) {
      this.setStatus('completed');
      this.emitCompletionEvent(completedSessionType, null);
      this.saveState();
      return;
    }

    const nextSessionType = this.getNextSessionType();
    this.emitCompletionEvent(completedSessionType, nextSessionType);
    this.advancePomodoroState(completedSessionType, nextSessionType);
    this.startNewTimer(this.settings.durations[nextSessionType]);
  }

  private getNextSessionType(): SessionType {
    if (this.pomodoro.currentSession !== 'focus') {
      return 'focus';
    }

    const nextCompletedFocusSessions = this.pomodoro.completedFocusSessions + 1;
    return nextCompletedFocusSessions % this.settings.cyclesBeforeLongBreak === 0
      ? 'long-break'
      : 'short-break';
  }

  private advancePomodoroState(completedSessionType: SessionType, nextSessionType: SessionType): void {
    const completedFocusSessions = completedSessionType === 'focus'
      ? this.pomodoro.completedFocusSessions + 1
      : this.pomodoro.completedFocusSessions;

    this.pomodoro = {
      ...this.pomodoro,
      currentSession: nextSessionType,
      completedFocusSessions,
      cycle: this.getCycle(completedFocusSessions, nextSessionType),
    };
    this.publishPomodoroState();
  }

  private getCycle(completedFocusSessions: number, nextSessionType: SessionType): number {
    if (nextSessionType === 'long-break') {
      return this.settings.cyclesBeforeLongBreak;
    }

    return (completedFocusSessions % this.settings.cyclesBeforeLongBreak) + 1;
  }

  private emitCompletionEvent(sessionType: SessionType, nextSessionType: SessionType | null): void {
    const event: TimerCompletionEvent = {
      id: Date.now(),
      completedAt: Date.now(),
      sessionType,
      nextSessionType,
      pomodoroEnabled: this.pomodoro.enabled,
    };

    this.lastCompletionEvent = event;
    this.completionEventSubject.next(event);
  }

  private saveState(): void {
    const state: StoredTimerState = {
      targetEndTimestamp: this.targetEndTimestamp,
      remainingTime: this.remainingTime,
      initialDuration: this.initialDuration,
      status: this.status,
      settings: this.settings,
      pomodoro: this.pomodoro,
      lastCompletionEvent: this.lastCompletionEvent,
    };

    try {
      localStorage.setItem(TimerService.STORAGE_KEY, JSON.stringify(state));
    } catch {
      return;
    }
  }

  private loadState(): void {
    let rawState: string | null = null;

    try {
      rawState = localStorage.getItem(TimerService.STORAGE_KEY);
    } catch {
      this.applyInitialState();
      return;
    }

    if (rawState === null) {
      this.applyInitialState();
      return;
    }

    try {
      const parsedState: unknown = JSON.parse(rawState);

      if (this.isValidStoredState(parsedState)) {
        this.applyState(parsedState);
        return;
      }

      if (this.isLegacyTimerState(parsedState)) {
        this.applyLegacyState(parsedState);
        return;
      }

      this.applyInitialState();
    } catch {
      this.applyInitialState();
    }
  }

  private applyInitialState(): void {
    this.clearTimerSubscription();
    this.targetEndTimestamp = null;
    this.initialDuration = this.settings.selectedDuration;
    this.remainingTime = this.settings.selectedDuration;
    this.publishDuration();
    this.publishRemainingTime();
    this.setStatus('idle');
    this.saveState();
  }

  private applyLegacyState(state: {
    targetEndTimestamp: number | null;
    remainingTime: number;
    initialDuration: number;
    status: TimerStatus;
  }): void {
    this.targetEndTimestamp = state.targetEndTimestamp;
    this.initialDuration = state.initialDuration || this.settings.selectedDuration;
    this.remainingTime = state.remainingTime || this.initialDuration;
    this.setStatus(state.status);
    this.publishDuration();
    this.publishRemainingTime();
    this.saveState();

    if (state.status === 'running') {
      this.syncRemainingTime();

      if (this.status === 'running') {
        this.startTimerSubscription();
      }
    }
  }

  private applyState(state: StoredTimerState): void {
    this.clearTimerSubscription();
    this.targetEndTimestamp = state.targetEndTimestamp;
    this.initialDuration = state.initialDuration;
    this.remainingTime = state.remainingTime;
    this.settings = this.normalizeSettings(state.settings);
    this.pomodoro = this.normalizePomodoroState(state.pomodoro);
    this.lastCompletionEvent = state.lastCompletionEvent;

    this.applyTheme(this.settings.theme);
    this.publishSettings();
    this.publishPomodoroState();
    this.publishDuration();
    this.publishRemainingTime();
    this.setStatus(state.status);

    if (this.lastCompletionEvent !== null) {
      this.completionEventSubject.next(this.lastCompletionEvent);
    }

    if (state.status !== 'running') {
      this.saveState();
      return;
    }

    this.syncRemainingTime();

    if (this.status === 'running') {
      this.startTimerSubscription();
    }
  }

  private publishRemainingTime(): void {
    this.remainingTimeSubject.next(this.remainingTime);
  }

  private publishDuration(): void {
    this.durationSubject.next(this.initialDuration);
  }

  private publishSettings(): void {
    this.settingsSubject.next(this.settings);
  }

  private publishPomodoroState(): void {
    this.pomodoroStateSubject.next(this.pomodoro);
  }

  private syncActiveSessionDuration(): void {
    if (this.status === 'running') {
      return;
    }

    const duration = this.pomodoro.enabled
      ? this.settings.durations[this.pomodoro.currentSession]
      : this.settings.selectedDuration;

    this.initialDuration = duration;
    this.remainingTime = duration;
    this.publishDuration();
    this.publishRemainingTime();
  }

  private getProfileById(profileId: PomodoroProfileId): PomodoroProfile | null {
    if (profileId === TimerService.CUSTOM_PROFILE_ID) {
      return this.settings.customPomodoroProfile;
    }

    return TimerService.BUILT_IN_POMODORO_PROFILES.find((profile) => profile.id === profileId) ?? null;
  }

  private applyTheme(theme: ThemeMode): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset['theme'] = theme;
  }

  private normalizeSettings(settings: Partial<TimerSettings>): TimerSettings {
    const defaultSettings = this.createDefaultSettings();
    const customPomodoroProfile = this.isValidPomodoroProfile(settings.customPomodoroProfile)
      ? settings.customPomodoroProfile
      : this.isValidDurations(settings.durations)
        ? {
            ...defaultSettings.customPomodoroProfile,
            durations: { ...settings.durations },
            cyclesBeforeLongBreak: this.isValidCycleCountValue(settings.cyclesBeforeLongBreak)
              ? settings.cyclesBeforeLongBreak
              : defaultSettings.cyclesBeforeLongBreak,
          }
        : defaultSettings.customPomodoroProfile;
    const profileId = this.isValidProfileId(settings.pomodoroProfileId)
      ? settings.pomodoroProfileId
      : this.isValidDurations(settings.durations)
        ? TimerService.CUSTOM_PROFILE_ID
        : defaultSettings.pomodoroProfileId;
    const profile = profileId === TimerService.CUSTOM_PROFILE_ID
      ? customPomodoroProfile
      : TimerService.BUILT_IN_POMODORO_PROFILES.find((candidate) => candidate.id === profileId) ??
        TimerService.BUILT_IN_POMODORO_PROFILES[0];

    return {
      selectedDuration: this.isValidDurationValue(settings.selectedDuration)
        ? settings.selectedDuration
        : defaultSettings.selectedDuration,
      durations: { ...profile.durations },
      cyclesBeforeLongBreak: profile.cyclesBeforeLongBreak,
      soundEnabled: typeof settings.soundEnabled === 'boolean'
        ? settings.soundEnabled
        : defaultSettings.soundEnabled,
      theme: this.isValidTheme(settings.theme) ? settings.theme : defaultSettings.theme,
      pomodoroProfileId: profile.id,
      customPomodoroProfile,
    };
  }

  private normalizePomodoroState(pomodoroState: PomodoroState): PomodoroState {
    return {
      ...pomodoroState,
      cycle: Math.min(pomodoroState.cycle, this.settings.cyclesBeforeLongBreak),
    };
  }

  private createDefaultSettings(): TimerSettings {
    const classicProfile = TimerService.BUILT_IN_POMODORO_PROFILES[0];

    return {
      selectedDuration: classicProfile.durations.focus,
      durations: { ...classicProfile.durations },
      cyclesBeforeLongBreak: classicProfile.cyclesBeforeLongBreak,
      soundEnabled: true,
      theme: 'dark',
      pomodoroProfileId: classicProfile.id,
      customPomodoroProfile: {
        id: TimerService.CUSTOM_PROFILE_ID,
        name: 'Custom',
        description: 'Your durations',
        durations: { ...classicProfile.durations },
        cyclesBeforeLongBreak: classicProfile.cyclesBeforeLongBreak,
      },
    };
  }

  private createDefaultPomodoroState(): PomodoroState {
    return {
      enabled: false,
      currentSession: 'focus',
      completedFocusSessions: 0,
      cycle: 1,
    };
  }

  private isValidStoredState(value: unknown): value is StoredTimerState {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<StoredTimerState>;

    if (
      !this.isValidTimestamp(candidate.targetEndTimestamp) ||
      typeof candidate.remainingTime !== 'number' ||
      typeof candidate.initialDuration !== 'number' ||
      !this.isValidSettings(candidate.settings) ||
      !this.isValidPomodoroState(candidate.pomodoro) ||
      !this.isValidCompletionEvent(candidate.lastCompletionEvent)
    ) {
      return false;
    }

    if (!this.isValidStatus(candidate.status)) {
      return false;
    }

    return this.isValidTimerSnapshot(
      candidate.remainingTime,
      candidate.initialDuration,
      candidate.status,
      candidate.targetEndTimestamp,
    );
  }

  private isLegacyTimerState(value: unknown): value is {
    targetEndTimestamp: number | null;
    remainingTime: number;
    initialDuration: number;
    status: TimerStatus;
  } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as {
      targetEndTimestamp?: unknown;
      remainingTime?: unknown;
      initialDuration?: unknown;
      status?: unknown;
    };

    if (
      !this.isValidTimestamp(candidate.targetEndTimestamp) ||
      typeof candidate.remainingTime !== 'number' ||
      typeof candidate.initialDuration !== 'number' ||
      !this.isValidStatus(candidate.status)
    ) {
      return false;
    }

    return this.isValidTimerSnapshot(
      candidate.remainingTime,
      candidate.initialDuration,
      candidate.status,
      candidate.targetEndTimestamp,
    );
  }

  private isValidTimerSnapshot(
    remainingTime: number,
    initialDuration: number,
    status: TimerStatus,
    targetEndTimestamp: number | null,
  ): boolean {
    if (
      !Number.isInteger(remainingTime) ||
      remainingTime < 0 ||
      !Number.isInteger(initialDuration) ||
      initialDuration <= 0 ||
      remainingTime > initialDuration
    ) {
      return false;
    }

    if (status === 'idle') {
      return targetEndTimestamp === null;
    }

    if (status === 'completed') {
      return targetEndTimestamp === null && remainingTime === 0;
    }

    if (status === 'paused') {
      return targetEndTimestamp === null && remainingTime > 0;
    }

    return targetEndTimestamp !== null && remainingTime > 0;
  }

  private isValidSettings(value: unknown): value is TimerSettings {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<TimerSettings>;

    return (
      typeof candidate.selectedDuration === 'number' &&
      Number.isInteger(candidate.selectedDuration) &&
      candidate.selectedDuration > 0 &&
      this.isValidDurations(candidate.durations) &&
      typeof candidate.soundEnabled === 'boolean' &&
      (candidate.cyclesBeforeLongBreak === undefined ||
        this.isValidCycleCountValue(candidate.cyclesBeforeLongBreak)) &&
      (candidate.theme === undefined || this.isValidTheme(candidate.theme)) &&
      (candidate.pomodoroProfileId === undefined || this.isValidProfileId(candidate.pomodoroProfileId)) &&
      (candidate.customPomodoroProfile === undefined ||
        this.isValidPomodoroProfile(candidate.customPomodoroProfile))
    );
  }

  private isValidDurations(value: unknown): value is SessionDurations {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<SessionDurations>;

    return (
      this.isValidDurationValue(candidate.focus) &&
      this.isValidDurationValue(candidate['short-break']) &&
      this.isValidDurationValue(candidate['long-break'])
    );
  }

  private isValidDurationValue(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
  }

  private isValidCycleCountValue(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 12;
  }

  private isValidTheme(value: unknown): value is ThemeMode {
    return value === 'dark' || value === 'light';
  }

  private isValidProfileId(value: unknown): value is PomodoroProfileId {
    return value === 'classic' || value === 'deep-work' || value === 'study' || value === 'custom';
  }

  private isValidPomodoroProfile(value: unknown): value is PomodoroProfile {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<PomodoroProfile>;

    return (
      this.isValidProfileId(candidate.id) &&
      typeof candidate.name === 'string' &&
      candidate.name.length > 0 &&
      typeof candidate.description === 'string' &&
      this.isValidDurations(candidate.durations) &&
      this.isValidCycleCountValue(candidate.cyclesBeforeLongBreak)
    );
  }

  private isValidPomodoroState(value: unknown): value is PomodoroState {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<PomodoroState>;

    return (
      typeof candidate.enabled === 'boolean' &&
      this.isValidSessionType(candidate.currentSession) &&
      typeof candidate.completedFocusSessions === 'number' &&
      Number.isInteger(candidate.completedFocusSessions) &&
      candidate.completedFocusSessions >= 0 &&
      typeof candidate.cycle === 'number' &&
      Number.isInteger(candidate.cycle) &&
      candidate.cycle >= 1 &&
      candidate.cycle <= 12
    );
  }

  private isValidCompletionEvent(value: unknown): value is TimerCompletionEvent | null {
    if (value === null) {
      return true;
    }

    if (typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<TimerCompletionEvent>;

    return (
      typeof candidate.id === 'number' &&
      Number.isInteger(candidate.id) &&
      typeof candidate.completedAt === 'number' &&
      Number.isInteger(candidate.completedAt) &&
      this.isValidSessionType(candidate.sessionType) &&
      (candidate.nextSessionType === null || this.isValidSessionType(candidate.nextSessionType)) &&
      typeof candidate.pomodoroEnabled === 'boolean'
    );
  }

  private isValidTimestamp(timestamp: unknown): timestamp is number | null {
    return timestamp === null || (typeof timestamp === 'number' && Number.isInteger(timestamp));
  }

  private isValidStatus(status: unknown): status is TimerStatus {
    return status === 'idle' || status === 'running' || status === 'paused' || status === 'completed';
  }

  private isValidSessionType(value: unknown): value is SessionType {
    return value === 'focus' || value === 'short-break' || value === 'long-break';
  }

  private setStatus(status: TimerStatus): void {
    this.status = status;
    this.completedSubject.next(status === 'completed');
    this.statusSubject.next(status);
  }
}
