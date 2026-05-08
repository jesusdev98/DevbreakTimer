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
import { WellnessBreakSuggestion, WellnessCategory } from '../../models/wellness-break.model';
import { FocusSessionCompletion } from '../../models/focus-session.model';
import { WellnessBreakService } from '../../services/wellness-break.service';
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
  public timerAnnouncement = '';

  @ViewChild('settingsButton') private settingsButton?: ElementRef<HTMLButtonElement>;

  private readonly destroy$ = new Subject<void>();
  private handledCompletionEventId: number | null = null;
  private completionMessageTimeout: ReturnType<typeof setTimeout> | null = null;
  private initialDuration = 25 * 60;
  private settings: TimerSettings | null = null;
  private wellnessSuggestionSession: SessionType | null = null;

  public constructor(
    private readonly timerService: TimerService,
    private readonly kanbanService: KanbanService,
    private readonly workspaceModeService: WorkspaceModeService,
    private readonly wellnessBreakService: WellnessBreakService,
    private readonly wellnessPreferencesService: WellnessPreferencesService,
    private readonly focusSessionService: FocusSessionService,
    private readonly shortcutService: ShortcutService,
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
    this.wellnessCategoryOptions = this.wellnessPreferencesService.categoryOptions;
    this.currentWorkspaceMode = this.workspaceModeService.getSelectedMode();
    this.shortcuts = this.shortcutService.getShortcuts();
    this.wellnessReminderPreferences = this.wellnessReminderEngine.getPreferences();
    this.settingsDraft = this.createSettingsDraft(null);

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
        this.prepareBreakSuggestion(event.nextSessionType);
        this.completeFocusSession(event);
        this.triggerCompletionEffects(event);
        this.timerService.acknowledgeCompletionEvent(event.id);
      });
  }

  public start(): void {
    if (this.currentStatus === 'running') {
      return;
    }

    this.taskCompletionMessage = null;

    if (this.currentStatus === 'paused') {
      this.timerService.start();
      this.announceTimer('Timer resumed');
      return;
    }

    const durationInSeconds = this.getStartDuration();
    this.wellnessReminderEngine.recordWorkSessionStart(
      durationInSeconds,
      this.pomodoroEnabled ? this.pomodoroState.currentSession : 'focus',
    );
    this.timerService.start(durationInSeconds);
    this.startFocusSession(durationInSeconds);
    this.announceTimer(`${this.getSessionTitle(this.pomodoroState.currentSession)} started`);
  }

  public pause(): void {
    this.timerService.pause();
    this.announceTimer('Timer paused');
  }

  public reset(): void {
    this.timerService.reset();
    this.wellnessReminderEngine.markReset();
    this.focusSessionService.cancelActiveSession();
    this.focusSessionCompletion = null;
    this.taskCompletionMessage = null;
    this.clearWellnessSuggestion();
    this.completionMessage = null;
    this.announceTimer('Timer reset');
  }

  public clearActiveTask(): void {
    this.kanbanService.clearActiveTask();
    this.announceTimer('Focus task cleared');
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

  public setWellnessRemindersEnabled(enabled: boolean): void {
    this.wellnessReminderEngine.setEnabled(enabled);
  }

  public setWellnessReminderTypeEnabled(type: WellnessReminderType, enabled: boolean): void {
    this.wellnessReminderEngine.setReminderEnabled(type, enabled);
  }

  public setWellnessReminderTypeFromEvent(change: { type: WellnessReminderType; enabled: boolean }): void {
    this.setWellnessReminderTypeEnabled(change.type, change.enabled);
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
    this.timerService.setSoundEnabled(this.settingsDraft.soundEnabled);
    this.timerService.setTheme(this.settingsDraft.theme);
    this.wellnessPreferencesService.setEnabledCategories(this.settingsDraft.wellnessCategories);
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

    this.settingsPanelOpen = false;
    this.editingShortcutAction = null;
    this.shortcutValidationMessage = null;
    this.restoreSettingsButtonFocus();
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

  public toggleFocusPanel(): void {
    if (!this.isFocusMode()) {
      return;
    }

    this.focusPanelVisible = !this.focusPanelVisible;
    this.announceTimer(this.focusPanelVisible ? 'Focus panel shown' : 'Focus panel hidden');
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
    this.focusSessionCompletion = null;
    this.announceTimer('Focus summary dismissed');
  }

  public markFocusedTaskDone(): void {
    const taskId = this.focusSessionCompletion?.session.taskId;

    if (!taskId) {
      return;
    }

    this.kanbanService.completeTaskById(taskId);
    this.focusSessionCompletion = null;
    this.taskCompletionMessage = 'Task Completed. Great progress.';
    this.announceTimer('Task completed');
  }

  public startBreakFromCompletion(): void {
    this.wellnessReminderEngine.markReset();
    this.focusSessionCompletion = null;
    this.announceTimer('Break started');
  }

  public dismissWellnessReminder(reminder: WellnessReminder): void {
    this.wellnessReminderEngine.dismiss(reminder.type);
    this.announceTimer('Wellness reminder dismissed');
  }

  public completeWellnessReminder(reminder: WellnessReminder): void {
    if (reminder.type === 'sedentary') {
      this.wellnessReminderEngine.markReset();
      this.announceTimer('Movement break completed');
      return;
    }

    this.wellnessReminderEngine.complete(reminder.type);
    this.announceTimer('Wellness action completed');
  }

  public nextWellnessSuggestion(reminder: WellnessReminder): void {
    this.wellnessReminderEngine.nextSuggestion(reminder.type);
    this.announceTimer('Wellness suggestion updated');
  }

  public ngOnDestroy(): void {
    if (this.completionMessageTimeout !== null) {
      clearTimeout(this.completionMessageTimeout);
    }

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

    if (this.shortcutService.matches(event, 'toggleFocusPanel')) {
      event.preventDefault();
      this.toggleFocusPanel();
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

  private startFocusSession(durationInSeconds: number): void {
    if (!this.isFocusMode() || !this.isFocusSessionContext()) {
      return;
    }

    const activeTask = this.kanbanService.getActiveTask();

    if (activeTask === null) {
      return;
    }

    this.focusSessionCompletion = null;
    this.focusSessionService.startSession({
      taskId: activeTask.id,
      taskTitle: activeTask.title,
      workspaceMode: this.currentWorkspaceMode.id,
      durationMinutes: Math.max(1, Math.round(durationInSeconds / 60)),
    });
  }

  private completeFocusSession(event: TimerCompletionEvent): void {
    if (event.sessionType !== 'focus' || !this.isFocusMode()) {
      return;
    }

    this.focusSessionCompletion = this.focusSessionService.completeActiveSession();
    this.announceTimer('Focus session completed');
  }

  private isFocusSessionContext(): boolean {
    return !this.pomodoroEnabled || this.pomodoroState.currentSession === 'focus';
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

  private syncWellnessSuggestion(pomodoroState: PomodoroState): void {
    if (!pomodoroState.enabled || pomodoroState.currentSession === 'focus') {
      this.clearWellnessSuggestion();
      return;
    }

    this.prepareBreakSuggestion(pomodoroState.currentSession);
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
