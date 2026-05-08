import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { startWith } from 'rxjs/operators';

import { WorkspaceModeId } from '../../../models/workspace-mode.model';
import { WorkspaceModeService } from '../../../services/workspace-mode.service';

export type WellnessReminderType = 'hydration' | 'posture' | 'sedentary';

export interface WellnessReminder {
  type: WellnessReminderType;
  title: string;
  message: string;
  actionLabel: string;
  suggestion: WellnessExerciseSuggestion;
}

export interface WellnessExerciseSuggestion {
  id: string;
  label: string;
  durationLabel: string;
}

export interface WellnessReminderPreferences {
  enabled: boolean;
  hydration: boolean;
  posture: boolean;
  sedentary: boolean;
  dismissedAt: Partial<Record<WellnessReminderType, number>>;
  adaptive: WellnessAdaptiveState;
  tracking: WellnessTrackingState;
}

interface WellnessAdaptiveState {
  dismissStreak: number;
  snoozedUntil: number | null;
  lastWellnessActionAt: number | null;
  longFocusStartedAt: number | null;
  continuousWorkStartedAt: number;
  quickTaskWindowStartedAt: number | null;
  quickTaskCount: number;
  activeReminderShownAt: number | null;
  recentSuggestionIds: string[];
}

interface WellnessTrackingEvent {
  action: 'completed' | 'dismissed';
  type: WellnessReminderType;
  at: number;
}

interface WellnessTrackingState {
  events: WellnessTrackingEvent[];
}

export interface WellnessMetrics {
  completedActions: number;
  dismissedReminders: number;
  recoveryCompletionPercentage: number;
  recoveryStreakDays: number;
  weeklyConsistencyDays: number;
  totalInteractions: number;
}

const STORAGE_KEY = 'devbreak-wellness-engine';
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const TRACKING_WINDOW = 21 * DAY;
const DEFAULT_PREFERENCES: WellnessReminderPreferences = {
  enabled: true,
  hydration: true,
  posture: true,
  sedentary: true,
  dismissedAt: {},
  adaptive: createDefaultAdaptiveState(),
  tracking: createDefaultTrackingState(),
};

const REMINDERS: Record<WellnessReminderType, WellnessReminder> = {
  hydration: {
    type: 'hydration',
    title: 'Hydration check',
    message: 'Take a quiet sip of water before the next task switch.',
    actionLabel: 'Done',
    suggestion: { id: 'water-sip', label: 'Small water break', durationLabel: '20 sec' },
  },
  posture: {
    type: 'posture',
    title: 'Posture reset',
    message: 'Drop your shoulders, soften your jaw, and sit tall for a breath.',
    actionLabel: 'Reset',
    suggestion: { id: 'shoulder-roll', label: 'Shoulder roll', durationLabel: '20 sec' },
  },
  sedentary: {
    type: 'sedentary',
    title: 'Movement nudge',
    message: 'You have been in work mode for a while. Stand up for a short reset.',
    actionLabel: 'Reset timer',
    suggestion: { id: 'stand-up', label: 'Stand up', durationLabel: '1 min' },
  },
};

const EXERCISE_SUGGESTIONS: Record<WellnessReminderType, WellnessExerciseSuggestion[]> = {
  hydration: [
    { id: 'water-sip', label: 'Small water break', durationLabel: '20 sec' },
    { id: 'eye-reset', label: 'Eye reset', durationLabel: '20 sec' },
    { id: 'deep-breath', label: 'Deep breath', durationLabel: '30 sec' },
  ],
  posture: [
    { id: 'neck-stretch', label: 'Neck stretch', durationLabel: '30 sec' },
    { id: 'shoulder-roll', label: 'Shoulder roll', durationLabel: '20 sec' },
    { id: 'chest-open', label: 'Chest opener', durationLabel: '30 sec' },
    { id: 'wrist-reset', label: 'Wrist reset', durationLabel: '30 sec' },
  ],
  sedentary: [
    { id: 'stand-up', label: 'Stand up', durationLabel: '1 min' },
    { id: 'walk-briefly', label: 'Walk briefly', durationLabel: '2 min' },
    { id: 'calf-raise', label: 'Calf raises', durationLabel: '30 sec' },
    { id: 'desk-squat', label: 'Desk squats', durationLabel: '45 sec' },
  ],
};

const MODE_INTERVALS: Record<WorkspaceModeId, Record<WellnessReminderType, number>> = {
  focus: {
    hydration: 90 * MINUTE,
    posture: 75 * MINUTE,
    sedentary: 130 * MINUTE,
  },
  pomodoro: {
    hydration: 70 * MINUTE,
    posture: 55 * MINUTE,
    sedentary: 100 * MINUTE,
  },
  wellness: {
    hydration: 40 * MINUTE,
    posture: 32 * MINUTE,
    sedentary: 65 * MINUTE,
  },
  hybrid: {
    hydration: 55 * MINUTE,
    posture: 45 * MINUTE,
    sedentary: 85 * MINUTE,
  },
};

const MODE_COOLDOWNS: Record<WorkspaceModeId, number> = {
  focus: 45 * MINUTE,
  pomodoro: 30 * MINUTE,
  wellness: 18 * MINUTE,
  hybrid: 24 * MINUTE,
};

const LONG_FOCUS_THRESHOLD = 45 * MINUTE;
const RECENT_WELLNESS_WINDOW = 30 * MINUTE;
const QUICK_TASK_WINDOW = 12 * MINUTE;
const QUICK_TASK_THRESHOLD = 5;
const IGNORED_REMINDER_AFTER = 22 * MINUTE;
const MAX_DISMISS_SNOOZE = 90 * MINUTE;

function createDefaultAdaptiveState(): WellnessAdaptiveState {
  return {
    dismissStreak: 0,
    snoozedUntil: null,
    lastWellnessActionAt: null,
    longFocusStartedAt: null,
    continuousWorkStartedAt: Date.now(),
    quickTaskWindowStartedAt: null,
    quickTaskCount: 0,
    activeReminderShownAt: null,
    recentSuggestionIds: [],
  };
}

function createDefaultTrackingState(): WellnessTrackingState {
  return {
    events: [],
  };
}

function createDefaultPreferences(): WellnessReminderPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    dismissedAt: {},
    adaptive: createDefaultAdaptiveState(),
    tracking: createDefaultTrackingState(),
  };
}

@Injectable({
  providedIn: 'root',
})
export class WellnessReminderEngineService {
  private preferences = this.restorePreferences();
  private readonly preferencesSubject = new BehaviorSubject<WellnessReminderPreferences>(this.preferences);
  private readonly activeReminderSubject = new BehaviorSubject<WellnessReminder | null>(null);
  private readonly metricsSubject = new BehaviorSubject<WellnessMetrics>(this.calculateMetrics());
  private readonly startedAt = Date.now();

  readonly preferences$: Observable<WellnessReminderPreferences> = this.preferencesSubject.asObservable();
  readonly activeReminder$: Observable<WellnessReminder | null> = this.activeReminderSubject.asObservable();
  readonly metrics$: Observable<WellnessMetrics> = this.metricsSubject.asObservable();

  constructor(private readonly workspaceModeService: WorkspaceModeService) {
    interval(MINUTE)
      .pipe(startWith(0))
      .subscribe((): void => this.evaluateReminders());

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', (): void => {
        if (!document.hidden) {
          this.evaluateReminders();
        }
      });
    }
  }

  getPreferences(): WellnessReminderPreferences {
    return {
      ...this.preferences,
      dismissedAt: { ...this.preferences.dismissedAt },
      adaptive: {
        ...this.preferences.adaptive,
        recentSuggestionIds: [...this.preferences.adaptive.recentSuggestionIds],
      },
      tracking: {
        events: [...this.preferences.tracking.events],
      },
    };
  }

  setEnabled(enabled: boolean): void {
    this.updatePreferences({ enabled });

    if (!enabled) {
      this.activeReminderSubject.next(null);
    }
  }

  setReminderEnabled(type: WellnessReminderType, enabled: boolean): void {
    this.updatePreferences({ [type]: enabled });

    if (!enabled && this.activeReminderSubject.value?.type === type) {
      this.activeReminderSubject.next(null);
    }
  }

  nextSuggestion(type: WellnessReminderType): void {
    const activeReminder = this.activeReminderSubject.value;

    if (activeReminder?.type !== type) {
      return;
    }

    this.activeReminderSubject.next(this.withSuggestion(activeReminder, true));
  }

  dismiss(type: WellnessReminderType): void {
    const now = Date.now();
    const dismissStreak = this.preferences.adaptive.dismissStreak + 1;

    this.updatePreferences({
      dismissedAt: {
        ...this.preferences.dismissedAt,
        [type]: now,
      },
      adaptive: {
        ...this.preferences.adaptive,
        dismissStreak,
        snoozedUntil: now + Math.min(MAX_DISMISS_SNOOZE, dismissStreak * 15 * MINUTE),
        activeReminderShownAt: null,
      },
      tracking: this.recordTrackingEvent('dismissed', type, now),
    });

    if (this.activeReminderSubject.value?.type === type) {
      this.activeReminderSubject.next(null);
    }
  }

  complete(type: WellnessReminderType): void {
    const now = Date.now();

    this.updatePreferences({
      dismissedAt: {
        ...this.preferences.dismissedAt,
        [type]: now,
      },
      adaptive: {
        ...this.preferences.adaptive,
        dismissStreak: 0,
        snoozedUntil: now + 18 * MINUTE,
        lastWellnessActionAt: now,
        activeReminderShownAt: null,
      },
      tracking: this.recordTrackingEvent('completed', type, now),
    });

    if (this.activeReminderSubject.value?.type === type) {
      this.activeReminderSubject.next(null);
    }
  }

  markReset(): void {
    const now = Date.now();

    this.updatePreferences({
      dismissedAt: {
        ...this.preferences.dismissedAt,
        sedentary: now,
        posture: this.preferences.dismissedAt.posture ?? now,
      },
      adaptive: {
        ...this.preferences.adaptive,
        dismissStreak: 0,
        snoozedUntil: now + 20 * MINUTE,
        lastWellnessActionAt: now,
        longFocusStartedAt: null,
        continuousWorkStartedAt: now,
        activeReminderShownAt: null,
      },
      tracking: this.recordTrackingEvent('completed', 'sedentary', now),
    });
    this.activeReminderSubject.next(null);
  }

  recordWorkSessionStart(durationSeconds: number, sessionType: 'focus' | 'short-break' | 'long-break'): void {
    const now = Date.now();

    if (sessionType !== 'focus') {
      this.markReset();
      return;
    }

    this.updatePreferences({
      adaptive: {
        ...this.preferences.adaptive,
        continuousWorkStartedAt: this.preferences.adaptive.continuousWorkStartedAt || now,
        longFocusStartedAt: durationSeconds >= LONG_FOCUS_THRESHOLD ? now : this.preferences.adaptive.longFocusStartedAt,
      },
    });
  }

  recordTaskCreated(): void {
    const now = Date.now();
    const windowStartedAt = this.preferences.adaptive.quickTaskWindowStartedAt;
    const withinWindow = windowStartedAt !== null && now - windowStartedAt <= QUICK_TASK_WINDOW;

    this.updatePreferences({
      adaptive: {
        ...this.preferences.adaptive,
        quickTaskWindowStartedAt: withinWindow ? windowStartedAt : now,
        quickTaskCount: withinWindow ? this.preferences.adaptive.quickTaskCount + 1 : 1,
      },
    });
  }

  private evaluateReminders(): void {
    if (!this.preferences.enabled || this.isTabHidden()) {
      return;
    }

    const now = Date.now();
    const activeReminder = this.activeReminderSubject.value;

    if (activeReminder !== null && this.preferences[activeReminder.type]) {
      this.handleIgnoredReminder(now);
      return;
    }

    const modeId = this.workspaceModeService.getSelectedMode().id;
    const nextReminder = this.pickReminder(modeId, now);

    if (nextReminder) {
      this.updatePreferences({
        adaptive: {
          ...this.preferences.adaptive,
          activeReminderShownAt: now,
        },
      });
    }

    this.activeReminderSubject.next(nextReminder);
  }

  private pickReminder(modeId: WorkspaceModeId, now: number): WellnessReminder | null {
    if (this.isAdaptivelySnoozed(now)) {
      return null;
    }

    const cooldown = this.getAdaptiveCooldown(modeId, now);
    const orderedTypes = this.getContextualOrder(modeId, now);

    return orderedTypes
      .filter((type) => this.preferences[type])
      .map((type) => ({
        type,
        elapsed: now - (this.preferences.dismissedAt[type] ?? this.startedAt),
        interval: this.getAdaptiveInterval(modeId, type, now),
      }))
      .filter((candidate) =>
        candidate.elapsed >= candidate.interval &&
        candidate.elapsed >= cooldown
      )
      .sort((first, second) => second.elapsed - first.elapsed)
      .map((candidate) => this.withSuggestion(REMINDERS[candidate.type]))[0] ?? null;
  }

  private updatePreferences(changes: Partial<WellnessReminderPreferences>): void {
    this.preferences = {
      ...this.preferences,
      ...changes,
      dismissedAt: changes.dismissedAt ?? this.preferences.dismissedAt,
      adaptive: changes.adaptive ?? this.preferences.adaptive,
      tracking: changes.tracking ?? this.preferences.tracking,
    };
    this.persistPreferences();
    this.preferencesSubject.next(this.getPreferences());
    this.metricsSubject.next(this.calculateMetrics());
  }

  private recordTrackingEvent(
    action: WellnessTrackingEvent['action'],
    type: WellnessReminderType,
    at: number,
  ): WellnessTrackingState {
    const cutoff = at - TRACKING_WINDOW;

    return {
      events: [
        ...this.preferences.tracking.events.filter((event) => event.at >= cutoff),
        { action, type, at },
      ],
    };
  }

  private calculateMetrics(now = Date.now()): WellnessMetrics {
    const cutoff = now - 7 * DAY;
    const weeklyEvents = this.preferences.tracking.events.filter((event) => event.at >= cutoff);
    const completedActions = weeklyEvents.filter((event) => event.action === 'completed').length;
    const dismissedReminders = weeklyEvents.filter((event) => event.action === 'dismissed').length;
    const totalInteractions = completedActions + dismissedReminders;
    const completedDayKeys = new Set(
      weeklyEvents
        .filter((event) => event.action === 'completed')
        .map((event) => this.dayKey(event.at)),
    );

    return {
      completedActions,
      dismissedReminders,
      recoveryCompletionPercentage: totalInteractions === 0
        ? 0
        : Math.round((completedActions / totalInteractions) * 100),
      recoveryStreakDays: this.countConsecutiveDays(completedDayKeys, now),
      weeklyConsistencyDays: completedDayKeys.size,
      totalInteractions,
    };
  }

  private countConsecutiveDays(completedDayKeys: Set<string>, now: number): number {
    let streak = 0;

    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(now - offset * DAY);

      if (!completedDayKeys.has(this.dayKey(day.getTime()))) {
        break;
      }

      streak += 1;
    }

    return streak;
  }

  private dayKey(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  private withSuggestion(reminder: WellnessReminder, forceRotate = false): WellnessReminder {
    const modeId = this.workspaceModeService.getSelectedMode().id;
    const suggestion = this.pickSuggestion(reminder.type, modeId, forceRotate);

    return {
      ...reminder,
      suggestion,
    };
  }

  private pickSuggestion(
    type: WellnessReminderType,
    modeId: WorkspaceModeId,
    forceRotate: boolean,
  ): WellnessExerciseSuggestion {
    const catalog = this.getSuggestionCatalog(type, modeId);
    const recentIds = this.preferences.adaptive.recentSuggestionIds;
    const available = catalog.filter((suggestion) => !recentIds.includes(suggestion.id));
    const pool = available.length ? available : catalog;
    const index = forceRotate && pool.length > 1
      ? Math.floor(Math.random() * (pool.length - 1)) + 1
      : Math.floor(Math.random() * pool.length);
    const suggestion = pool[index] ?? catalog[0];

    this.updateRecentSuggestions(suggestion.id);

    return suggestion;
  }

  private getSuggestionCatalog(
    type: WellnessReminderType,
    modeId: WorkspaceModeId,
  ): WellnessExerciseSuggestion[] {
    if (modeId === 'focus') {
      return EXERCISE_SUGGESTIONS[type].slice(0, 2);
    }

    if (modeId === 'wellness') {
      return EXERCISE_SUGGESTIONS[type];
    }

    return EXERCISE_SUGGESTIONS[type].slice(0, 3);
  }

  private updateRecentSuggestions(suggestionId: string): void {
    const recentSuggestionIds = [
      suggestionId,
      ...this.preferences.adaptive.recentSuggestionIds.filter((id) => id !== suggestionId),
    ].slice(0, 4);

    this.updatePreferences({
      adaptive: {
        ...this.preferences.adaptive,
        recentSuggestionIds,
      },
    });
  }

  private isTabHidden(): boolean {
    return typeof document !== 'undefined' && document.hidden;
  }

  private handleIgnoredReminder(now: number): void {
    const shownAt = this.preferences.adaptive.activeReminderShownAt;

    if (shownAt === null || now - shownAt < IGNORED_REMINDER_AFTER) {
      return;
    }

    this.updatePreferences({
      adaptive: {
        ...this.preferences.adaptive,
        dismissStreak: this.preferences.adaptive.dismissStreak + 1,
        snoozedUntil: now + 30 * MINUTE,
        activeReminderShownAt: null,
      },
    });
    this.activeReminderSubject.next(null);
  }

  private isAdaptivelySnoozed(now: number): boolean {
    const snoozedUntil = this.preferences.adaptive.snoozedUntil;

    return snoozedUntil !== null && now < snoozedUntil;
  }

  private getAdaptiveCooldown(modeId: WorkspaceModeId, now: number): number {
    const recentWellnessAt = this.preferences.adaptive.lastWellnessActionAt;
    const wellnessMultiplier = recentWellnessAt !== null && now - recentWellnessAt < RECENT_WELLNESS_WINDOW
      ? 1.55
      : 1;
    const dismissMultiplier = Math.min(2.2, 1 + this.preferences.adaptive.dismissStreak * 0.28);

    return MODE_COOLDOWNS[modeId] * wellnessMultiplier * dismissMultiplier;
  }

  private getAdaptiveInterval(
    modeId: WorkspaceModeId,
    type: WellnessReminderType,
    now: number,
  ): number {
    let intervalMs = MODE_INTERVALS[modeId][type];

    if (this.isLongFocusActive(now) && (type === 'posture' || type === 'sedentary')) {
      intervalMs *= 0.74;
    }

    if (this.isQuickTaskBurst(now) && type === 'hydration') {
      intervalMs *= 1.35;
    }

    if (type === 'sedentary') {
      const continuousElapsed = now - this.preferences.adaptive.continuousWorkStartedAt;

      if (continuousElapsed > MODE_INTERVALS[modeId].sedentary) {
        intervalMs *= 0.82;
      }
    }

    return intervalMs;
  }

  private getContextualOrder(modeId: WorkspaceModeId, now: number): WellnessReminderType[] {
    if (this.isLongFocusActive(now)) {
      return ['posture', 'sedentary', 'hydration'];
    }

    if (this.isContinuousWorkflowLong(modeId, now)) {
      return ['sedentary', 'posture', 'hydration'];
    }

    if (this.isQuickTaskBurst(now)) {
      return ['posture', 'sedentary', 'hydration'];
    }

    return modeId === 'wellness'
      ? ['posture', 'sedentary', 'hydration']
      : ['hydration', 'posture', 'sedentary'];
  }

  private isLongFocusActive(now: number): boolean {
    const longFocusStartedAt = this.preferences.adaptive.longFocusStartedAt;

    return longFocusStartedAt !== null && now - longFocusStartedAt <= 2 * 60 * MINUTE;
  }

  private isQuickTaskBurst(now: number): boolean {
    const windowStartedAt = this.preferences.adaptive.quickTaskWindowStartedAt;

    return (
      windowStartedAt !== null &&
      now - windowStartedAt <= QUICK_TASK_WINDOW &&
      this.preferences.adaptive.quickTaskCount >= QUICK_TASK_THRESHOLD
    );
  }

  private isContinuousWorkflowLong(modeId: WorkspaceModeId, now: number): boolean {
    return now - this.preferences.adaptive.continuousWorkStartedAt >= MODE_INTERVALS[modeId].sedentary;
  }

  private restorePreferences(): WellnessReminderPreferences {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);

      if (!storedValue) {
        return createDefaultPreferences();
      }

      const parsedValue: unknown = JSON.parse(storedValue);

      return this.isPreferences(parsedValue)
        ? {
            ...parsedValue,
            adaptive: this.normalizeAdaptiveState(parsedValue.adaptive),
            tracking: this.normalizeTrackingState(parsedValue.tracking),
          }
        : createDefaultPreferences();
    } catch {
      return createDefaultPreferences();
    }
  }

  private persistPreferences(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
    } catch {
      // Wellness reminders remain available in memory if storage is unavailable.
    }
  }

  private isPreferences(value: unknown): value is WellnessReminderPreferences {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<WellnessReminderPreferences>;

    return (
      typeof candidate.enabled === 'boolean' &&
      typeof candidate.hydration === 'boolean' &&
      typeof candidate.posture === 'boolean' &&
      typeof candidate.sedentary === 'boolean' &&
      this.isDismissMap(candidate.dismissedAt)
    );
  }

  private isDismissMap(value: unknown): value is Partial<Record<WellnessReminderType, number>> {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<Record<WellnessReminderType, unknown>>;

    return (
      (candidate.hydration === undefined || typeof candidate.hydration === 'number') &&
      (candidate.posture === undefined || typeof candidate.posture === 'number') &&
      (candidate.sedentary === undefined || typeof candidate.sedentary === 'number')
    );
  }

  private normalizeAdaptiveState(value: unknown): WellnessAdaptiveState {
    const defaults = createDefaultAdaptiveState();

    if (!value || typeof value !== 'object') {
      return defaults;
    }

    const candidate = value as Partial<WellnessAdaptiveState>;

    return {
      dismissStreak: typeof candidate.dismissStreak === 'number' ? candidate.dismissStreak : defaults.dismissStreak,
      snoozedUntil: candidate.snoozedUntil === null || typeof candidate.snoozedUntil === 'number'
        ? candidate.snoozedUntil
        : defaults.snoozedUntil,
      lastWellnessActionAt:
        candidate.lastWellnessActionAt === null || typeof candidate.lastWellnessActionAt === 'number'
          ? candidate.lastWellnessActionAt
          : defaults.lastWellnessActionAt,
      longFocusStartedAt:
        candidate.longFocusStartedAt === null || typeof candidate.longFocusStartedAt === 'number'
          ? candidate.longFocusStartedAt
          : defaults.longFocusStartedAt,
      continuousWorkStartedAt: typeof candidate.continuousWorkStartedAt === 'number'
        ? candidate.continuousWorkStartedAt
        : defaults.continuousWorkStartedAt,
      quickTaskWindowStartedAt:
        candidate.quickTaskWindowStartedAt === null || typeof candidate.quickTaskWindowStartedAt === 'number'
          ? candidate.quickTaskWindowStartedAt
          : defaults.quickTaskWindowStartedAt,
      quickTaskCount: typeof candidate.quickTaskCount === 'number' ? candidate.quickTaskCount : defaults.quickTaskCount,
      activeReminderShownAt:
        candidate.activeReminderShownAt === null || typeof candidate.activeReminderShownAt === 'number'
          ? candidate.activeReminderShownAt
          : defaults.activeReminderShownAt,
      recentSuggestionIds: Array.isArray(candidate.recentSuggestionIds)
        ? candidate.recentSuggestionIds.filter((id): id is string => typeof id === 'string').slice(0, 4)
        : defaults.recentSuggestionIds,
    };
  }

  private normalizeTrackingState(value: unknown): WellnessTrackingState {
    if (!value || typeof value !== 'object') {
      return createDefaultTrackingState();
    }

    const candidate = value as Partial<WellnessTrackingState>;
    const cutoff = Date.now() - TRACKING_WINDOW;

    return {
      events: Array.isArray(candidate.events)
        ? candidate.events
            .filter((event): event is WellnessTrackingEvent => this.isTrackingEvent(event))
            .filter((event) => event.at >= cutoff)
        : [],
    };
  }

  private isTrackingEvent(value: unknown): value is WellnessTrackingEvent {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<WellnessTrackingEvent>;

    return (
      (candidate.action === 'completed' || candidate.action === 'dismissed') &&
      this.isReminderType(candidate.type) &&
      typeof candidate.at === 'number'
    );
  }

  private isReminderType(value: unknown): value is WellnessReminderType {
    return value === 'hydration' || value === 'posture' || value === 'sedentary';
  }
}
