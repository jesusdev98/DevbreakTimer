import { Component, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import {
  AppSettings,
  PomodoroState,
  PomodoroProfile,
  PomodoroProfileId,
  SessionType,
  ThemeMode,
  TimerCompletionEvent,
  TimerService,
  TimerSettings,
  TimerStatus,
} from '../../services/timer.service';

type SettingsDraft = {
  theme: ThemeMode;
  profileId: PomodoroProfileId;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
  soundEnabled: boolean;
};

@Component({
  selector: 'app-timer-container',
  standalone: false,
  templateUrl: './timer-container.component.html',
  styleUrls: ['./timer-container.component.scss'],
})
export class TimerContainerComponent implements OnDestroy {
  public readonly remainingTime$: Observable<number>;
  public readonly status$: Observable<TimerStatus>;
  public readonly settings$: Observable<TimerSettings>;
  public readonly pomodoroState$: Observable<PomodoroState>;

  public readonly pomodoroProfiles = TimerService.BUILT_IN_POMODORO_PROFILES;
  public readonly presets = [5, 15, 25, 45];
  public settingsPanelOpen = false;
  public settingsDraft: SettingsDraft = this.createSettingsDraft(null);
  public currentStatus: TimerStatus = 'idle';
  public durationInMinutes = 25;
  public currentExercise: string | null = null;
  public completionMessage: string | null = null;
  public progress = 0;
  public soundEnabled = true;
  public pomodoroEnabled = false;
  public pomodoroState: PomodoroState = {
    enabled: false,
    currentSession: 'focus',
    completedFocusSessions: 0,
    cycle: 1,
  };

  private readonly destroy$ = new Subject<void>();
  private handledCompletionEventId: number | null = null;
  private completionMessageTimeout: ReturnType<typeof setTimeout> | null = null;
  private initialDuration = 25 * 60;
  private settings: TimerSettings | null = null;
  private readonly exercises: string[] = [
    '10 burpees',
    '15 squats',
    '30s plank',
    '20 jumping jacks',
    'stretch your back',
    'walk for 1 minute',
  ];

  public constructor(private readonly timerService: TimerService) {
    this.remainingTime$ = this.timerService.remainingTime$;
    this.status$ = this.timerService.status$;
    this.settings$ = this.timerService.settings$;
    this.pomodoroState$ = this.timerService.pomodoroState$;

    this.timerService.duration$
      .pipe(takeUntil(this.destroy$))
      .subscribe((duration: number): void => {
        this.initialDuration = duration;
        this.durationInMinutes = Math.max(1, Math.round(duration / 60));
      });

    this.remainingTime$
      .pipe(takeUntil(this.destroy$))
      .subscribe((remainingTime: number): void => {
        const nextProgress = this.initialDuration > 0
          ? (remainingTime / this.initialDuration) * 100
          : 0;

        this.progress = Math.max(0, Math.min(100, nextProgress));
      });

    this.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings: TimerSettings): void => {
        this.settings = settings;
        this.soundEnabled = settings.soundEnabled;
        this.settingsDraft = this.settingsPanelOpen ? this.settingsDraft : this.createSettingsDraft(settings);

        if (!this.pomodoroEnabled && this.currentStatus !== 'running') {
          this.durationInMinutes = Math.max(1, Math.round(settings.selectedDuration / 60));
        }
      });

    this.pomodoroState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((pomodoroState: PomodoroState): void => {
        this.pomodoroState = pomodoroState;
        this.pomodoroEnabled = pomodoroState.enabled;
      });

    this.status$
      .pipe(takeUntil(this.destroy$))
      .subscribe((status: TimerStatus): void => {
        this.currentStatus = status;
      });

    this.timerService.completionEvent$
      .pipe(
        filter((event: TimerCompletionEvent | null): event is TimerCompletionEvent => event !== null),
        takeUntil(this.destroy$),
      )
      .subscribe((event: TimerCompletionEvent): void => {
        if (this.handledCompletionEventId === event.id) {
          return;
        }

        this.handledCompletionEventId = event.id;
        this.currentExercise = this.getRandomExercise();
        this.triggerCompletionEffects(event);
        this.timerService.acknowledgeCompletionEvent(event.id);
      });
  }

  public start(): void {
    if (this.currentStatus === 'running') {
      return;
    }

    if (this.currentStatus === 'paused') {
      this.timerService.start();
      return;
    }

    const durationInSeconds = this.getStartDuration();
    this.timerService.start(durationInSeconds);
  }

  public pause(): void {
    this.timerService.pause();
  }

  public reset(): void {
    this.timerService.reset();
    this.currentExercise = null;
    this.completionMessage = null;
  }

  public selectPreset(minutes: number): void {
    if (this.currentStatus === 'running') {
      return;
    }

    this.durationInMinutes = minutes;
    this.timerService.setSelectedDuration(minutes * 60);
  }

  public setDuration(minutes: number | string): void {
    const duration = Number(minutes);

    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }

    this.timerService.setSelectedDuration(Math.floor(duration * 60));
  }

  public setPomodoroEnabled(enabled: boolean): void {
    this.timerService.setPomodoroEnabled(enabled);
  }

  public setSoundEnabled(enabled: boolean): void {
    this.timerService.setSoundEnabled(enabled);
  }

  public openSettings(): void {
    this.settingsDraft = this.createSettingsDraft(this.settings);
    this.settingsPanelOpen = true;
  }

  public closeSettings(): void {
    this.settingsPanelOpen = false;
    this.settingsDraft = this.createSettingsDraft(this.settings);
  }

  public selectSettingsProfile(profileId: PomodoroProfileId): void {
    this.settingsDraft = {
      ...this.settingsDraft,
      profileId,
    };

    const profile = this.getDraftProfile(profileId);

    if (profile === null) {
      return;
    }

    this.settingsDraft = {
      ...this.settingsDraft,
      focusMinutes: this.secondsToMinutes(profile.durations.focus),
      shortBreakMinutes: this.secondsToMinutes(profile.durations['short-break']),
      longBreakMinutes: this.secondsToMinutes(profile.durations['long-break']),
      cyclesBeforeLongBreak: profile.cyclesBeforeLongBreak,
    };
  }

  public saveSettings(): void {
    this.timerService.setSoundEnabled(this.settingsDraft.soundEnabled);
    this.timerService.setTheme(this.settingsDraft.theme);

    if (this.settingsDraft.profileId === 'custom') {
      this.timerService.setCustomPomodoroProfile({
        durations: {
          focus: this.minutesToSeconds(this.settingsDraft.focusMinutes),
          'short-break': this.minutesToSeconds(this.settingsDraft.shortBreakMinutes),
          'long-break': this.minutesToSeconds(this.settingsDraft.longBreakMinutes),
        },
        cyclesBeforeLongBreak: Math.min(12, Math.max(1, Math.floor(this.settingsDraft.cyclesBeforeLongBreak))),
      });
    } else {
      this.timerService.setPomodoroProfile(this.settingsDraft.profileId);
    }

    this.settingsPanelOpen = false;
  }

  public getSessionTitle(sessionType: SessionType): string {
    const labels: Record<SessionType, string> = {
      focus: 'Focus Session',
      'short-break': 'Short Break',
      'long-break': 'Long Break',
    };

    return labels[sessionType];
  }

  public getNextSessionTitle(): string {
    return this.getSessionTitle(this.getNextSessionType());
  }

  public getCyclesBeforeLongBreak(): number {
    return this.settings?.cyclesBeforeLongBreak ?? 4;
  }

  public getRemainingFocusSessionsInCycle(): number {
    if (this.pomodoroState.currentSession === 'long-break') {
      return 0;
    }

    const completedInCurrentCycle = this.pomodoroState.completedFocusSessions % this.getCyclesBeforeLongBreak();

    return this.getCyclesBeforeLongBreak() - completedInCurrentCycle;
  }

  public getDurationLockMessage(): string | null {
    if (this.currentStatus === 'running') {
      return 'Locked while the timer is running. Pause or reset to change duration.';
    }

    if (this.pomodoroEnabled) {
      return 'Pomodoro uses fixed focus and break lengths, so custom duration controls are locked.';
    }

    return null;
  }

  public formatTime(seconds: number | null): string {
    const safeSeconds = Math.max(0, seconds ?? 0);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;

    if (safeSeconds < 3600) {
      const totalMinutes = Math.floor(safeSeconds / 60);

      return `${totalMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  public ngOnDestroy(): void {
    if (this.completionMessageTimeout !== null) {
      clearTimeout(this.completionMessageTimeout);
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  private getStartDuration(): number {
    if (this.pomodoroEnabled && this.settings !== null) {
      return this.settings.durations[this.pomodoroState.currentSession];
    }

    const durationInSeconds = Math.max(1, Math.floor(this.durationInMinutes * 60));
    this.timerService.setSelectedDuration(durationInSeconds);

    return durationInSeconds;
  }

  private triggerCompletionEffects(event: TimerCompletionEvent): void {
    this.completionMessage = this.getCompletionMessage(event);
    this.scheduleCompletionMessageClear();
    this.sendNotification(event);

    if (this.soundEnabled) {
      this.playSound();
    }
  }

  private getNextSessionType(): SessionType {
    if (this.pomodoroState.currentSession !== 'focus') {
      return 'focus';
    }

    const nextCompletedFocusSessions = this.pomodoroState.completedFocusSessions + 1;
    return nextCompletedFocusSessions % this.getCyclesBeforeLongBreak() === 0
      ? 'long-break'
      : 'short-break';
  }

  private createSettingsDraft(settings: AppSettings | null): SettingsDraft {
    const activeSettings = settings ?? this.settings;
    const defaultProfile = this.pomodoroProfiles[0];
    const customProfile = activeSettings?.customPomodoroProfile ?? {
      ...defaultProfile,
      id: 'custom' as const,
      name: 'Custom',
      description: 'Your durations',
    };
    const profileId = activeSettings?.pomodoroProfileId ?? defaultProfile.id;
    const profile = profileId === 'custom'
      ? customProfile
      : this.pomodoroProfiles.find((candidate) => candidate.id === profileId) ?? defaultProfile;

    return {
      theme: activeSettings?.theme ?? 'dark',
      profileId,
      focusMinutes: this.secondsToMinutes(profile.durations.focus),
      shortBreakMinutes: this.secondsToMinutes(profile.durations['short-break']),
      longBreakMinutes: this.secondsToMinutes(profile.durations['long-break']),
      cyclesBeforeLongBreak: profile.cyclesBeforeLongBreak,
      soundEnabled: activeSettings?.soundEnabled ?? true,
    };
  }

  private getDraftProfile(profileId: PomodoroProfileId): PomodoroProfile | null {
    if (profileId === 'custom') {
      return this.settings?.customPomodoroProfile ?? null;
    }

    return this.pomodoroProfiles.find((profile) => profile.id === profileId) ?? null;
  }

  private secondsToMinutes(seconds: number): number {
    return Math.max(1, Math.round(seconds / 60));
  }

  private minutesToSeconds(minutes: number): number {
    return Math.max(1, Math.floor(Number(minutes) || 1)) * 60;
  }

  private getCompletionMessage(event: TimerCompletionEvent): string {
    const completedSession = this.getSessionTitle(event.sessionType);

    if (!event.pomodoroEnabled || event.nextSessionType === null) {
      return `${completedSession} complete. Nice work.`;
    }

    return `${completedSession} complete. ${this.getSessionTitle(event.nextSessionType)} started automatically.`;
  }

  private scheduleCompletionMessageClear(): void {
    if (this.completionMessageTimeout !== null) {
      clearTimeout(this.completionMessageTimeout);
    }

    this.completionMessageTimeout = setTimeout((): void => {
      this.completionMessage = null;
      this.completionMessageTimeout = null;
    }, 7000);
  }

  private getRandomExercise(): string {
    const index = Math.floor(Math.random() * this.exercises.length);
    return this.exercises[index];
  }

  private sendNotification(event: TimerCompletionEvent): void {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const permission = Notification.permission;

    if (permission === 'granted') {
      this.createNotification(event);
      return;
    }

    if (permission === 'default') {
      void Notification.requestPermission()
        .then((nextPermission: NotificationPermission): void => {
          if (nextPermission === 'granted') {
            this.createNotification(event);
          }
        })
        .catch((): void => {
          return;
        });
    }
  }

  private createNotification(event: TimerCompletionEvent): void {
    const nextSession = event.nextSessionType === null
      ? null
      : this.getSessionTitle(event.nextSessionType);

    try {
      new Notification(`${this.getSessionTitle(event.sessionType)} complete`, {
        body: nextSession === null ? 'Time is up. Take a moment to reset.' : `${nextSession} started automatically.`,
      });
    } catch {
      return;
    }
  }

  private playSound(): void {
    const audio = new Audio('assets/beep.mp3');
    audio.volume = 1;

    void audio.play().then((): void => {
      setTimeout((): void => {
        audio.currentTime = 0;
        void audio.play().catch((): void => {
          return;
        });
      }, 180);
    }).catch((): void => {
      return;
    });
  }
}
