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
      skippedSessionsToday: 0,
    });

    vi.setSystemTime(new Date('2026-05-08T09:30:00'));
    service.resetTodayStats();

    expect(service.getDailyMetrics()).toEqual({
      totalFocusMinutesToday: 0,
      completedSessionsToday: 0,
      skippedSessionsToday: 0,
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
      skippedSessionsToday: 0,
    });
  });

  it('tracks reset or cancelled active sessions as skipped without completed minutes', () => {
    const service = new FocusSessionService();

    service.startSession({
      workspaceMode: 'hybrid',
      durationMinutes: 25,
    });
    const skippedSession = service.cancelActiveSession();

    expect(service.getDailyMetrics()).toEqual({
      totalFocusMinutesToday: 0,
      completedSessionsToday: 0,
      skippedSessionsToday: 1,
    });
    expect(skippedSession).toEqual(expect.objectContaining({
      completed: false,
      skipped: true,
      skippedAt: expect.any(Number),
    }));

    const storedSessions = JSON.parse(localStorage.getItem('devbreak-focus-sessions') ?? '[]') as Array<{
      completed: boolean;
      skipped: boolean;
    }>;

    expect(storedSessions).toHaveLength(1);
    expect(storedSessions[0]).toEqual(expect.objectContaining({
      completed: false,
      skipped: true,
    }));
  });

  it('does not double count repeated resets after a skipped session', () => {
    const service = new FocusSessionService();

    service.startSession({
      workspaceMode: 'hybrid',
      durationMinutes: 25,
    });
    const skippedSession = service.cancelActiveSession();
    const repeatedReset = service.cancelActiveSession();

    expect(service.getDailyMetrics()).toEqual({
      totalFocusMinutesToday: 0,
      completedSessionsToday: 0,
      skippedSessionsToday: 1,
    });
    expect(skippedSession).not.toBeNull();
    expect(repeatedReset).toBeNull();
  });

  it('does not mark reset after completion as skipped', () => {
    const service = new FocusSessionService();

    service.startSession({
      workspaceMode: 'hybrid',
      durationMinutes: 25,
    });
    service.completeActiveSession();
    service.cancelActiveSession();

    expect(service.getDailyMetrics()).toEqual({
      totalFocusMinutesToday: 25,
      completedSessionsToday: 1,
      skippedSessionsToday: 0,
    });
  });

  it('skips an unfinished active session before starting a replacement session', () => {
    const service = new FocusSessionService();

    service.startSession({
      workspaceMode: 'wellness',
      durationMinutes: 10,
    });
    service.startSession({
      workspaceMode: 'wellness',
      durationMinutes: 15,
    });

    expect(service.getDailyMetrics()).toEqual({
      totalFocusMinutesToday: 0,
      completedSessionsToday: 0,
      skippedSessionsToday: 1,
    });
  });

  it('does not count skipped sessions toward streaks', () => {
    const service = new FocusSessionService();

    service.startSession({
      workspaceMode: 'wellness',
      durationMinutes: 10,
    });
    service.cancelActiveSession();

    let currentStreakDays = -1;
    service.productivityStats$.subscribe((stats) => {
      currentStreakDays = stats.currentStreakDays;
    }).unsubscribe();

    expect(currentStreakDays).toBe(0);
  });

  it('normalizes legacy contradictory sessions toward skipped, not completed', () => {
    localStorage.setItem('devbreak-focus-sessions', JSON.stringify([
      {
        id: 'legacy-reset',
        workspaceMode: 'hybrid',
        startedAt: Date.now(),
        completedAt: Date.now(),
        skippedAt: Date.now(),
        durationMinutes: 25,
        completed: true,
        skipped: true,
      },
      {
        id: 'legacy-complete',
        workspaceMode: 'focus',
        startedAt: Date.now(),
        completedAt: Date.now(),
        durationMinutes: 15,
        completed: true,
      },
    ]));

    const service = new FocusSessionService();

    expect(service.getDailyMetrics()).toEqual({
      totalFocusMinutesToday: 15,
      completedSessionsToday: 1,
      skippedSessionsToday: 1,
    });
  });

  it('clears completed or skipped active sessions during restore', () => {
    localStorage.setItem('devbreak-active-focus-session', JSON.stringify({
      id: 'stale-active',
      workspaceMode: 'focus',
      startedAt: Date.now(),
      completedAt: Date.now(),
      skippedAt: null,
      durationMinutes: 25,
      completed: true,
      skipped: false,
    }));

    const service = new FocusSessionService();

    expect(service.completeActiveSession()).toBeNull();
    expect(localStorage.getItem('devbreak-active-focus-session')).toBeNull();
  });
});
