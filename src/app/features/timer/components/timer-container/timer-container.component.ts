import { Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { Task } from '../../../kanban/models/task.model';
import { KanbanService } from '../../../kanban/services/kanban.service';
import { WorkspaceMode, WorkspaceModeId } from '../../../../models/workspace-mode.model';
import { WorkspaceModeService } from '../../../../services/workspace-mode.service';
import {
  ShortcutActionId,
  ShortcutDefinition,
  ShortcutService,
} from '../../../../services/shortcut.service';
import { LanguageCode, LanguageService } from '../../../../services/language.service';
import { WellnessBreakSuggestion, WellnessCategory, WellnessExercise } from '../../models/wellness-break.model';
import { FocusSessionCompletion } from '../../models/focus-session.model';
import { WellnessBreakService } from '../../services/wellness-break.service';
import { WellnessExerciseInput, WellnessExerciseService } from '../../services/wellness-exercise.service';
import { FocusSessionService } from '../../services/focus-session.service';
import {
  WellnessCategoryOption,
  WellnessPreferencesService,
} from '../../services/wellness-preferences.service';
import {
  WellnessReminder,
  WellnessReminderEngineService,
  WellnessMetrics,
  WellnessReminderPreferences,
  WellnessReminderType,
} from '../../services/wellness-reminder-engine.service';
import {
  AppSettings,
  PomodoroState,
  PomodoroProfile,
  PomodoroProfileId,
  SessionType,
  SoundPresetId,
  ThemeMode,
  TimerCompletionEvent,
  TimerService,
  TimerSettings,
  TimerStatus,
} from '../../services/timer.service';
import { SettingsDraft } from '../timer-settings-panel/timer-settings-panel.component';

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
  public readonly activeTask$: Observable<Task | null>;
  public readonly wellnessReminder$: Observable<WellnessReminder | null>;
  public readonly wellnessMetrics$: Observable<WellnessMetrics>;

  public readonly pomodoroProfiles = TimerService.BUILT_IN_POMODORO_PROFILES;
  public readonly workspaceModes: readonly WorkspaceMode[];
  public readonly languageOptions;
  public readonly wellnessCategoryOptions: readonly WellnessCategoryOption[];
  public readonly presets = [5, 15, 25, 45];
  public settingsPanelOpen = false;
  public settingsDraft: SettingsDraft = {
    theme: 'dark',
    profileId: 'classic',
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLongBreak: 4,
    soundEnabled: true,
    soundPresetId: 'soft-bell',
    soundVolume: 70,
    completionSoundMode: 'once',
    language: 'en',
    workspaceModeId: 'hybrid',
    wellnessCategories: [],
  };
  public currentStatus: TimerStatus = 'idle';
  public durationInMinutes = 25;
  public wellnessSuggestion: WellnessBreakSuggestion | null = null;
  public focusSessionCompletion: FocusSessionCompletion | null = null;
  public taskCompletionMessage: string | null = null;
  public completionMessage: string | null = null;
  public progress = 0;
  public soundEnabled = true;
  public completionAlarmActive = false;
  public pomodoroEnabled = false;
  public pomodoroState: PomodoroState = {
    enabled: false,
    currentSession: 'focus',
    completedFocusSessions: 0,
    cycle: 1,
  };
  public currentWorkspaceMode: WorkspaceMode;
  public shortcuts: ShortcutDefinition[] = [];
  public editingShortcutAction: ShortcutActionId | null = null;
  public shortcutValidationMessage: string | null = null;
  public focusPanelVisible = true;
  public wellnessReminderPreferences: WellnessReminderPreferences;
  public wellnessExercises: WellnessExercise[] = [];
  public timerAnnouncement = '';

  @ViewChild('settingsButton') private settingsButton?: ElementRef<HTMLButtonElement>;

  private readonly destroy$ = new Subject<void>();
  private handledCompletionEventId: number | null = null;
  private completionMessageTimeout: ReturnType<typeof setTimeout> | null = null;
  private completionAlarmInterval: ReturnType<typeof setInterval> | null = null;
  private audioContext: AudioContext | null = null;
  private initialDuration = 25 * 60;
  private settings: TimerSettings | null = null;
  private wellnessSuggestionSession: SessionType | null = null;

  public constructor(
    private readonly timerService: TimerService,
    private readonly kanbanService: KanbanService,
    private readonly workspaceModeService: WorkspaceModeService,
    private readonly wellnessBreakService: WellnessBreakService,
    private readonly wellnessExerciseService: WellnessExerciseService,
    private readonly wellnessPreferencesService: WellnessPreferencesService,
    private readonly focusSessionService: FocusSessionService,
    private readonly shortcutService: ShortcutService,
    private readonly languageService: LanguageService,
    private readonly wellnessReminderEngine: WellnessReminderEngineService,
  ) {
    this.remainingTime$ = this.timerService.remainingTime$;
    this.status$ = this.timerService.status$;
    this.settings$ = this.timerService.settings$;
    this.pomodoroState$ = this.timerService.pomodoroState$;
    this.activeTask$ = this.kanbanService.activeTask$;
    this.wellnessReminder$ = this.wellnessReminderEngine.activeReminder$;
    this.wellnessMetrics$ = this.wellnessReminderEngine.metrics$;
    this.workspaceModes = this.workspaceModeService.modes;
    this.languageOptions = this.languageService.languages;
    this.wellnessCategoryOptions = this.wellnessPreferencesService.categoryOptions;
    this.currentWorkspaceMode = this.workspaceModeService.getSelectedMode();
    this.shortcuts = this.shortcutService.getShortcuts();
    this.wellnessReminderPreferences = this.wellnessReminderEngine.getPreferences();
    this.wellnessExercises = this.wellnessExerciseService.getExercises();
    this.settingsDraft = this.createSettingsDraft(null);

    this.wellnessExerciseService.exercises$
      .pipe(takeUntil(this.destroy$))
      .subscribe((exercises: WellnessExercise[]): void => {
        this.wellnessExercises = exercises;
        this.clearWellnessSuggestion();
        this.syncWellnessSuggestion(this.pomodoroState);
      });

    this.wellnessReminderEngine.preferences$
      .pipe(takeUntil(this.destroy$))
      .subscribe((preferences: WellnessReminderPreferences): void => {
        this.wellnessReminderPreferences = preferences;
      });

    this.wellnessReminder$
      .pipe(takeUntil(this.destroy$))
      .subscribe((reminder: WellnessReminder | null): void => {
        if (reminder !== null) {
          this.announceTimer(`Wellness reminder: ${reminder.title}`);
        }
      });

    this.shortcutService.shortcuts$
      .pipe(takeUntil(this.destroy$))
      .subscribe((shortcuts: ShortcutDefinition[]): void => {
        this.shortcuts = shortcuts;
      });

    this.workspaceModeService.selectedMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe((mode: WorkspaceMode): void => {
        this.currentWorkspaceMode = mode;
        this.settingsDraft = this.settingsPanelOpen ? this.settingsDraft : this.createSettingsDraft(this.settings);
        this.clearWellnessSuggestion();
        this.syncWellnessSuggestion(this.pomodoroState);
      });

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
        this.syncWellnessSuggestion(pomodoroState);
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
        this.prepareCompletionSuggestion(event);
        this.completeTrackedSession(event);
        this.triggerCompletionEffects(event);
        this.timerService.acknowledgeCompletionEvent(event.id);
      });
  }

  public start(): void {
    if (this.currentStatus === 'running') {
      return;
    }

    this.stopCompletionAlarm();
    this.taskCompletionMessage = null;

    if (this.currentStatus === 'paused') {
      this.timerService.start();
      this.announceTimer(this.translate('timer.announcements.resumed'));
      return;
    }

    const durationInSeconds = this.getStartDuration();
    this.wellnessReminderEngine.recordWorkSessionStart(
      durationInSeconds,
      this.pomodoroEnabled ? this.pomodoroState.currentSession : 'focus',
    );
    this.timerService.start(durationInSeconds);
    this.startTrackedSession(durationInSeconds);
    this.announceTimer(this.translate('timer.announcements.started', {
      session: this.getSessionTitle(this.pomodoroState.currentSession),
    }));
  }

  public pause(): void {
    this.timerService.pause();
    this.announceTimer(this.translate('timer.announcements.paused'));
  }

  public reset(): void {
    this.stopCompletionAlarm();
    this.timerService.reset();
    this.wellnessReminderEngine.markReset();
    const skippedSession = this.focusSessionService.cancelActiveSession();

    if (skippedSession?.skippedAt) {
      this.wellnessReminderEngine.recordSkippedFocusSession(skippedSession.skippedAt);
    }

    this.focusSessionCompletion = null;
    this.taskCompletionMessage = null;
    this.clearWellnessSuggestion();
    this.completionMessage = null;
    this.announceTimer(this.translate('timer.announcements.reset'));
  }

  public clearActiveTask(): void {
    this.kanbanService.clearActiveTask();
    this.announceTimer(this.translate('timer.announcements.focusTaskCleared'));
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

    if (!enabled) {
      this.stopCompletionAlarm();
    }
  }

  public applySoundSettings(): void {
    this.timerService.setSoundEnabled(this.settingsDraft.soundEnabled);
    this.timerService.setSoundPreset(this.settingsDraft.soundPresetId);
    this.timerService.setSoundVolume(Number(this.settingsDraft.soundVolume));
    this.timerService.setCompletionSoundMode(this.settingsDraft.completionSoundMode);

    if (!this.settingsDraft.soundEnabled) {
      this.stopCompletionAlarm();
    }

    if (this.settingsDraft.completionSoundMode === 'once') {
      this.stopCompletionAlarm();
    }
  }

  public applyLanguageSetting(language: LanguageCode): void {
    this.settingsDraft = {
      ...this.settingsDraft,
      language,
    };
    this.languageService.setLanguage(language);
  }

  public setWellnessRemindersEnabled(enabled: boolean): void {
    this.wellnessReminderEngine.setEnabled(enabled);
  }

  public setWellnessReminderTypeEnabled(type: WellnessReminderType, enabled: boolean): void {
    this.wellnessReminderEngine.setReminderEnabled(type, enabled);
  }

  public setWellnessReminderTypeFromEvent(change: { type: WellnessReminderType; enabled: boolean }): void {
    this.setWellnessReminderTypeEnabled(change.type, change.enabled);
  }

  public addWellnessExercise(exercise: WellnessExerciseInput): void {
    this.wellnessExerciseService.addExercise(exercise);
  }

  public updateWellnessExercise(change: { id: string; exercise: WellnessExerciseInput }): void {
    this.wellnessExerciseService.updateExercise(change.id, change.exercise);
  }

  public deleteWellnessExercise(id: string): void {
    this.wellnessExerciseService.deleteExercise(id);
  }

  public handleShortcutCaptureEvent(capture: { event: KeyboardEvent; action: ShortcutActionId }): void {
    this.handleShortcutCapture(capture.event, capture.action);
  }

  public openSettings(): void {
    this.settingsDraft = this.createSettingsDraft(this.settings);
    this.settingsPanelOpen = true;
  }

  public closeSettings(): void {
    this.settingsPanelOpen = false;
    this.settingsDraft = this.createSettingsDraft(this.settings);
    this.editingShortcutAction = null;
    this.shortcutValidationMessage = null;
    this.restoreSettingsButtonFocus();
  }

  public handleSettingsKeydown(event: KeyboardEvent): void {
    if (this.shortcutService.matches(event, 'escapeModal')) {
      event.preventDefault();
      this.closeSettings();
    }
  }

  public selectSettingsProfile(profileId: PomodoroProfileId): void {
    if (this.areSessionSettingsLocked()) {
      return;
    }

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

  public toggleWellnessCategory(category: WellnessCategory): void {
    const selectedCategories = this.settingsDraft.wellnessCategories;
    const nextCategories = selectedCategories.includes(category)
      ? selectedCategories.filter((selectedCategory) => selectedCategory !== category)
      : [...selectedCategories, category];

    this.settingsDraft = {
      ...this.settingsDraft,
      wellnessCategories: nextCategories,
    };
  }

  public isWellnessCategorySelected(category: WellnessCategory): boolean {
    return this.settingsDraft.wellnessCategories.includes(category);
  }

  public showWellnessPreferences(modeId: WorkspaceModeId = this.settingsDraft.workspaceModeId): boolean {
    return modeId === 'wellness' || modeId === 'hybrid';
  }

  public saveSettings(): void {
    this.applySoundSettings();
    this.languageService.setLanguage(this.settingsDraft.language);
    this.timerService.setTheme(this.settingsDraft.theme);
    this.wellnessPreferencesService.setEnabledCategories(this.settingsDraft.wellnessCategories);

    if (!this.areSessionSettingsLocked()) {
      this.workspaceModeService.setMode(this.settingsDraft.workspaceModeId);

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
    }

    this.settingsPanelOpen = false;
    this.editingShortcutAction = null;
    this.shortcutValidationMessage = null;
    this.restoreSettingsButtonFocus();
  }

  public getSessionTitle(sessionType: SessionType): string {
    return this.translate(`timer.sessions.${sessionType}`);
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
      return this.translate('timer.duration.lockedRunning');
    }

    if (this.pomodoroEnabled) {
      return this.translate('timer.duration.lockedPomodoro');
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

  public formatFocusMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours === 0) {
      return `${remainingMinutes}m`;
    }

    if (remainingMinutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${remainingMinutes}m`;
  }

  public isFocusMode(): boolean {
    return this.currentWorkspaceMode.id === 'focus';
  }

  public shouldShowFocusPanel(activeTask: Task | null): boolean {
    return activeTask !== null && this.isFocusMode() && this.focusPanelVisible;
  }

  public startShortcutCapture(action: ShortcutActionId): void {
    this.editingShortcutAction = action;
    this.shortcutValidationMessage = null;
  }

  public handleShortcutCapture(event: KeyboardEvent, action: ShortcutActionId): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.shortcutService.matches(event, 'escapeModal') && action !== 'escapeModal') {
      this.editingShortcutAction = null;
      this.shortcutValidationMessage = null;
      return;
    }

    const combo = this.shortcutService.comboFromEvent(event);

    if (combo === null) {
      this.shortcutValidationMessage = 'Press a key with an optional modifier.';
      return;
    }

    const result = this.shortcutService.setShortcut(action, combo);
    this.shortcutValidationMessage = result.message;

    if (result.valid) {
      this.editingShortcutAction = null;
    }
  }

  public resetShortcuts(): void {
    this.shortcutService.resetDefaults();
    this.editingShortcutAction = null;
    this.shortcutValidationMessage = null;
  }

  public formatShortcut(combo: string): string {
    return this.shortcutService.formatCombo(combo);
  }

  public continueTask(): void {
    this.stopCompletionAlarm();
    this.focusSessionCompletion = null;
    this.announceTimer(this.translate('timer.announcements.focusSummaryDismissed'));
  }

  public markFocusedTaskDone(): void {
    this.stopCompletionAlarm();
    const taskId = this.focusSessionCompletion?.session.taskId;

    if (!taskId) {
      return;
    }

    this.kanbanService.completeTaskById(taskId);
    this.focusSessionCompletion = null;
    this.taskCompletionMessage = this.translate('timer.taskCompletedMessage');
    this.announceTimer(this.translate('timer.announcements.taskCompleted'));
  }

  public startBreakFromCompletion(): void {
    this.stopCompletionAlarm();
    this.wellnessReminderEngine.markReset();
    this.focusSessionCompletion = null;
    this.announceTimer(this.translate('timer.announcements.breakStarted'));
  }

  public dismissWellnessReminder(reminder: WellnessReminder): void {
    this.wellnessReminderEngine.dismiss(reminder.type);
    this.announceTimer(this.translate('wellness.announcements.reminderDismissed'));
  }

  public completeWellnessReminder(reminder: WellnessReminder): void {
    if (reminder.type === 'sedentary') {
      this.wellnessReminderEngine.completeMovementReset();
      this.announceTimer(this.translate('wellness.announcements.movementCompleted'));
      return;
    }

    this.wellnessReminderEngine.complete(reminder.type);
    this.announceTimer(this.translate('wellness.announcements.actionCompleted'));
  }

  public nextWellnessSuggestion(reminder: WellnessReminder): void {
    this.wellnessReminderEngine.nextSuggestion(reminder.type);
    this.announceTimer(this.translate('wellness.announcements.suggestionUpdated'));
  }

  public ngOnDestroy(): void {
    if (this.completionMessageTimeout !== null) {
      clearTimeout(this.completionMessageTimeout);
    }

    this.stopCompletionAlarm();
    void this.audioContext?.close().catch((): void => {
      return;
    });
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown', ['$event'])
  protected handleGlobalShortcut(event: KeyboardEvent): void {
    if (event.defaultPrevented || this.isTypingTarget(event.target)) {
      return;
    }

    if (this.settingsPanelOpen && this.shortcutService.matches(event, 'escapeModal')) {
      event.preventDefault();
      this.closeSettings();
      return;
    }

  }

  private getStartDuration(): number {
    if (this.pomodoroEnabled && this.settings !== null) {
      return this.settings.durations[this.pomodoroState.currentSession];
    }

    const durationInSeconds = Math.max(1, Math.floor(this.durationInMinutes * 60));
    this.timerService.setSelectedDuration(durationInSeconds);

    return durationInSeconds;
  }

  private startTrackedSession(durationInSeconds: number): void {
    if (!this.isFocusSessionContext()) {
      return;
    }

    const activeTask = this.kanbanService.getActiveTask();

    this.focusSessionCompletion = null;
    this.focusSessionService.startSession({
      taskId: this.isFocusMode() ? activeTask?.id : undefined,
      taskTitle: this.isFocusMode() ? activeTask?.title : undefined,
      workspaceMode: this.currentWorkspaceMode.id,
      durationMinutes: Math.max(1, Math.round(durationInSeconds / 60)),
    });
  }

  private completeTrackedSession(event: TimerCompletionEvent): void {
    if (event.sessionType !== 'focus') {
      return;
    }

    const completion = this.focusSessionService.completeActiveSession();

    this.focusSessionCompletion = this.isFocusMode() ? completion : null;
    this.announceTimer(this.translate('timer.announcements.focusCompleted'));
  }

  private isFocusSessionContext(): boolean {
    return !this.pomodoroEnabled || this.pomodoroState.currentSession === 'focus';
  }

  private areSessionSettingsLocked(): boolean {
    return this.currentStatus === 'running' || this.currentStatus === 'paused';
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();

    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target.isContentEditable
    );
  }

  private restoreSettingsButtonFocus(): void {
    window.setTimeout(() => this.settingsButton?.nativeElement.focus());
  }

  private announceTimer(message: string): void {
    this.timerAnnouncement = message;
  }

  private triggerCompletionEffects(event: TimerCompletionEvent): void {
    this.stopCompletionAlarm();
    this.completionMessage = this.getCompletionMessage(event);
    this.sendNotification(event);

    if (this.soundEnabled) {
      this.playCompletionSound();

      if (this.settings?.completionSoundMode === 'repeat') {
        this.startCompletionAlarm();
      } else {
        this.scheduleCompletionMessageClear();
      }
      return;
    }

    this.scheduleCompletionMessageClear();
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
      soundPresetId: activeSettings?.soundPresetId ?? 'soft-bell',
      soundVolume: activeSettings?.soundVolume ?? 70,
      completionSoundMode: activeSettings?.completionSoundMode ?? 'once',
      language: this.languageService.getCurrentLanguage(),
      workspaceModeId: this.currentWorkspaceMode.id,
      wellnessCategories: this.wellnessPreferencesService.getEnabledCategories(),
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
      return this.translate('timer.completion.once', { session: completedSession });
    }

    return this.translate('timer.completion.nextStarted', {
      session: completedSession,
      nextSession: this.getSessionTitle(event.nextSessionType),
    });
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

  public dismissCompletionAlarm(): void {
    this.stopCompletionAlarm();
    this.completionMessage = null;
    this.announceTimer(this.translate('timer.announcements.alarmDismissed'));
  }

  private syncWellnessSuggestion(pomodoroState: PomodoroState): void {
    if (
      !this.shouldShowExerciseSuggestions() ||
      !pomodoroState.enabled ||
      pomodoroState.currentSession === 'focus'
    ) {
      this.clearWellnessSuggestion();
      return;
    }

    this.prepareBreakSuggestion(pomodoroState.currentSession);
  }

  private prepareCompletionSuggestion(event: TimerCompletionEvent): void {
    if (event.sessionType !== 'focus' || !this.shouldShowExerciseSuggestions()) {
      this.clearWellnessSuggestion();
      return;
    }

    this.prepareBreakSuggestion(event.nextSessionType ?? 'short-break');
  }

  private prepareBreakSuggestion(sessionType: SessionType | null): void {
    if (sessionType === null || sessionType === 'focus') {
      return;
    }

    if (this.wellnessSuggestion !== null && this.wellnessSuggestionSession === sessionType) {
      return;
    }

    this.wellnessSuggestion = this.wellnessBreakService.getSuggestion(
      sessionType,
      this.currentWorkspaceMode,
      this.wellnessPreferencesService.getEnabledCategories(),
    );
    this.wellnessSuggestionSession = sessionType;
  }

  private clearWellnessSuggestion(): void {
    this.wellnessSuggestion = null;
    this.wellnessSuggestionSession = null;
  }

  private shouldShowExerciseSuggestions(): boolean {
    return this.currentWorkspaceMode.breakPromptBehavior === 'exercise';
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
    try {
      new Notification(this.getNotificationTitle(event), {
        body: this.getNotificationBody(event),
      });
    } catch {
      return;
    }
  }

  private getNotificationTitle(event: TimerCompletionEvent): string {
    return this.translate(`timer.notifications.titles.${this.currentWorkspaceMode.id}`, {
      session: this.getSessionTitle(event.sessionType),
    });
  }

  private getNotificationBody(event: TimerCompletionEvent): string {
    const nextSession = event.nextSessionType === null
      ? null
      : this.getSessionTitle(event.nextSessionType);
    const baseBody = nextSession === null
      ? this.translate(`timer.notifications.bodies.${this.currentWorkspaceMode.id}.reset`)
      : this.translate(`timer.notifications.bodies.${this.currentWorkspaceMode.id}.next`, { nextSession });
    const suggestionText = this.getNotificationSuggestionText();

    if (
      suggestionText === null ||
      (this.currentWorkspaceMode.id !== 'wellness' && this.currentWorkspaceMode.id !== 'hybrid')
    ) {
      return baseBody;
    }

    return `${baseBody} ${this.translate('timer.notifications.suggestedRecovery', {
      suggestion: suggestionText,
    })}`;
  }

  private getNotificationSuggestionText(): string | null {
    if (this.wellnessSuggestion === null) {
      return null;
    }

    const title = this.wellnessSuggestion.custom
      ? this.wellnessSuggestion.title
      : this.translate(`wellness.exercises.presets.${this.wellnessSuggestion.id}`);
    const duration = this.wellnessSuggestion.duration
      ? this.translate('wellness.exercises.durationSeconds', {
          duration: this.wellnessSuggestion.duration,
        })
      : null;

    return duration === null ? title : `${title} - ${duration}`;
  }

  private startCompletionAlarm(): void {
    if (this.completionAlarmInterval !== null || !this.soundEnabled) {
      return;
    }

    this.completionAlarmActive = true;

    this.completionAlarmInterval = setInterval((): void => {
      if (!this.soundEnabled || this.currentStatus === 'running') {
        this.stopCompletionAlarm();
        return;
      }

      this.playCompletionSound();
    }, 4500);
  }

  private stopCompletionAlarm(): void {
    if (this.completionAlarmInterval !== null) {
      clearInterval(this.completionAlarmInterval);
      this.completionAlarmInterval = null;
    }

    this.completionAlarmActive = false;
  }

  private playCompletionSound(): void {
    if (!this.soundEnabled || (this.settings?.soundVolume ?? 70) <= 0) {
      return;
    }

    try {
      const context = this.getAudioContext();
      const preset = this.settings?.soundPresetId ?? 'soft-bell';
      const volume = Math.max(0, Math.min(1, (this.settings?.soundVolume ?? 70) / 100));
      const now = context.currentTime;

      this.soundSequenceFor(preset).forEach((tone): void => {
        this.playTone(context, now + tone.delay, tone.frequency, tone.duration, volume, tone.type);
      });
    } catch {
      return;
    }
  }

  private getAudioContext(): AudioContext {
    if (this.audioContext !== null) {
      return this.audioContext;
    }

    const audioWindow = window as Window & typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextConstructor = audioWindow.AudioContext || audioWindow.webkitAudioContext;

    if (AudioContextConstructor === undefined) {
      throw new Error('Web Audio is unavailable.');
    }

    this.audioContext = new AudioContextConstructor();

    return this.audioContext;
  }

  private soundSequenceFor(
    preset: SoundPresetId,
  ): readonly { delay: number; frequency: number; duration: number; type: OscillatorType }[] {
    const sequences: Record<
      SoundPresetId,
      readonly { delay: number; frequency: number; duration: number; type: OscillatorType }[]
    > = {
      'soft-bell': [
        { delay: 0, frequency: 660, duration: 0.42, type: 'sine' },
        { delay: 0.18, frequency: 880, duration: 0.52, type: 'sine' },
      ],
      digital: [
        { delay: 0, frequency: 880, duration: 0.12, type: 'square' },
        { delay: 0.16, frequency: 1175, duration: 0.14, type: 'square' },
      ],
      minimal: [
        { delay: 0, frequency: 720, duration: 0.22, type: 'sine' },
      ],
      retro: [
        { delay: 0, frequency: 523, duration: 0.12, type: 'triangle' },
        { delay: 0.14, frequency: 659, duration: 0.12, type: 'triangle' },
        { delay: 0.28, frequency: 784, duration: 0.18, type: 'triangle' },
      ],
      alarm: [
        { delay: 0, frequency: 988, duration: 0.18, type: 'sawtooth' },
        { delay: 0.24, frequency: 988, duration: 0.18, type: 'sawtooth' },
        { delay: 0.48, frequency: 740, duration: 0.22, type: 'sawtooth' },
      ],
    };

    return sequences[preset];
  }

  private playTone(
    context: AudioContext,
    startTime: number,
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const safeVolume = Math.max(0.001, volume * 0.22);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(safeVolume, startTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.03);
  }

  private translate(key: string, params?: Record<string, unknown>): string {
    return this.languageService.instant(key, params);
  }
}
