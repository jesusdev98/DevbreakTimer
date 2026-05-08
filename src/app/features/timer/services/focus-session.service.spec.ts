import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FocusSessionService } from './focus-session.service';

describe('FocusSessionService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T09:00:00'));
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('resets today stats while preserving completed focus history', () => {
    const service = new FocusSessionService();

    service.startSession({
      workspaceMode: 'focus',
      durationMinutes: 25,
    });
    service.completeActiveSession();

    expect(service.getDailyMetrics()).toEqual({
      totalFocusMinutesToday: 25,
      completedSessionsToday: 1,
    });

    vi.setSystemTime(new Date('2026-05-08T09:30:00'));
    service.resetTodayStats();

    expect(service.getDailyMetrics()).toEqual({
      totalFocusMinutesToday: 0,
      completedSessionsToday: 0,
    });
    expect(localStorage.getItem('devbreak-focus-sessions')).not.toBe('[]');

    service.startSession({
      workspaceMode: 'focus',
      durationMinutes: 15,
    });
    service.completeActiveSession();

    expect(service.getDailyMetrics()).toEqual({
      totalFocusMinutesToday: 15,
      completedSessionsToday: 1,
    });
  });
});
