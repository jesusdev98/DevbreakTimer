import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceModeService } from '../../../services/workspace-mode.service';
import { WellnessReminder, WellnessReminderEngineService } from './wellness-reminder-engine.service';

describe('WellnessReminderEngineService', () => {
  const storageKey = 'devbreak-wellness-engine';
  let now = 1_700_000_000_000;
  let service: WellnessReminderEngineService;
  let workspaceModeService: WorkspaceModeService;

  beforeEach(() => {
    localStorage.clear();
    now = 1_700_000_000_000;
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    TestBed.configureTestingModule({});
    workspaceModeService = TestBed.inject(WorkspaceModeService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('recovers safe defaults from corrupted storage', () => {
    localStorage.setItem(storageKey, '{bad json');

    service = TestBed.inject(WellnessReminderEngineService);

    expect(service.getPreferences().enabled).toBe(true);
    expect(service.getPreferences().adaptive.recentSuggestionIds).toEqual([]);
  });

  it('normalizes malformed adaptive legacy state', () => {
    localStorage.setItem(storageKey, JSON.stringify({
      enabled: true,
      hydration: true,
      posture: true,
      sedentary: true,
      dismissedAt: {},
      adaptive: {
        dismissStreak: 'bad',
        recentSuggestionIds: 'bad',
      },
    }));

    service = TestBed.inject(WellnessReminderEngineService);

    expect(service.getPreferences().adaptive.dismissStreak).toBe(0);
    expect(service.getPreferences().adaptive.recentSuggestionIds).toEqual([]);
  });

  it('restores tracking defaults for legacy wellness state', () => {
    localStorage.setItem(storageKey, JSON.stringify({
      enabled: true,
      hydration: true,
      posture: true,
      sedentary: true,
      dismissedAt: {},
      adaptive: {},
    }));

    service = TestBed.inject(WellnessReminderEngineService);

    expect(service.getPreferences().tracking.events).toEqual([]);
    expect(readMetrics().totalInteractions).toBe(0);
  });

  it('increases adaptive snooze after repeated dismissals', () => {
    service = TestBed.inject(WellnessReminderEngineService);

    service.dismiss('posture');
    now += 1_000;
    service.dismiss('hydration');

    const stored = readStored();
    expect(stored.adaptive.dismissStreak).toBe(2);
    expect(stored.adaptive.snoozedUntil).toBe(now + 30 * 60_000);
  });

  it('prioritizes posture suggestions during long focus sessions', () => {
    workspaceModeService.setMode('focus');
    service = TestBed.inject(WellnessReminderEngineService);

    service.recordWorkSessionStart(50 * 60, 'focus');
    now += 76 * 60_000;
    evaluate();

    expect(readReminder()?.type).toBe('posture');
  });

  it('rotates suggestions and stores recent history', () => {
    service = TestBed.inject(WellnessReminderEngineService);
    now += 46 * 60_000;
    evaluate();
    const first = readReminder();

    service.nextSuggestion(first!.type);
    const second = readReminder();

    expect(second?.suggestion.id).not.toBe(first?.suggestion.id);
    expect(service.getPreferences().adaptive.recentSuggestionIds.length).toBeGreaterThan(1);
  });

  it('suppresses reminders after a completed wellness action', () => {
    service = TestBed.inject(WellnessReminderEngineService);
    service.complete('posture');
    now += 10 * 60_000;
    evaluate();

    expect(readReminder()).toBeNull();
  });

  it('tracks completed and dismissed wellness interactions', () => {
    service = TestBed.inject(WellnessReminderEngineService);

    service.complete('posture');
    now += 1_000;
    service.dismiss('hydration');

    const metrics = readMetrics();

    expect(metrics.completedActions).toBe(1);
    expect(metrics.dismissedReminders).toBe(1);
    expect(metrics.recoveryCompletionPercentage).toBe(50);
    expect(metrics.totalInteractions).toBe(2);
  });

  it('does not count ordinary timer resets as completed recovery actions', () => {
    service = TestBed.inject(WellnessReminderEngineService);

    service.markReset();

    expect(readMetrics()).toEqual({
      completedActions: 0,
      dismissedReminders: 0,
      recoveryCompletionPercentage: 0,
      recoveryStreakDays: 0,
      weeklyConsistencyDays: 0,
      totalInteractions: 0,
    });
  });

  it('counts explicit movement resets as completed recovery actions', () => {
    service = TestBed.inject(WellnessReminderEngineService);

    service.completeMovementReset();

    expect(readMetrics()).toEqual({
      completedActions: 1,
      dismissedReminders: 0,
      recoveryCompletionPercentage: 100,
      recoveryStreakDays: 1,
      weeklyConsistencyDays: 1,
      totalInteractions: 1,
    });
  });

  it('counts canonical skipped focus sessions as omitted recovery rhythm interactions', () => {
    service = TestBed.inject(WellnessReminderEngineService);

    service.recordSkippedFocusSession(now);

    expect(readMetrics()).toEqual({
      completedActions: 0,
      dismissedReminders: 1,
      recoveryCompletionPercentage: 0,
      recoveryStreakDays: 0,
      weeklyConsistencyDays: 0,
      totalInteractions: 1,
    });
  });

  it('derives recovery streak and weekly consistency from completed actions', () => {
    localStorage.setItem(storageKey, JSON.stringify({
      enabled: true,
      hydration: true,
      posture: true,
      sedentary: true,
      dismissedAt: {},
      adaptive: {},
      tracking: {
        events: [
          { action: 'completed', type: 'sedentary', at: now - 2 * 24 * 60 * 60_000 },
          { action: 'completed', type: 'posture', at: now - 24 * 60 * 60_000 },
          { action: 'completed', type: 'hydration', at: now },
          { action: 'dismissed', type: 'hydration', at: now },
        ],
      },
    }));

    service = TestBed.inject(WellnessReminderEngineService);

    const metrics = readMetrics();

    expect(metrics.recoveryStreakDays).toBe(3);
    expect(metrics.weeklyConsistencyDays).toBe(3);
    expect(metrics.recoveryCompletionPercentage).toBe(75);
  });

  function evaluate(): void {
    (service as unknown as { evaluateReminders: () => void }).evaluateReminders();
  }

  function readReminder(): WellnessReminder | null {
    let latest: WellnessReminder | null = null;
    service.activeReminder$.subscribe((reminder) => {
      latest = reminder;
    }).unsubscribe();

    return latest;
  }

  function readMetrics() {
    let latest = {
      completedActions: 0,
      dismissedReminders: 0,
      recoveryCompletionPercentage: 0,
      recoveryStreakDays: 0,
      weeklyConsistencyDays: 0,
      totalInteractions: 0,
    };
    service.metrics$.subscribe((metrics) => {
      latest = metrics;
    }).unsubscribe();

    return latest;
  }

  function readStored() {
    return JSON.parse(localStorage.getItem(storageKey) ?? '{}') as {
      adaptive: { dismissStreak: number; snoozedUntil: number };
    };
  }
});
