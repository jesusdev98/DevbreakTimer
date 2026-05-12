import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import {
  DailyFocusMetrics,
  FocusSession,
  FocusSessionCompletion,
  ProductivityStats,
} from '../models/focus-session.model';
import { WorkspaceModeId } from '../../../models/workspace-mode.model';

interface StartFocusSessionRequest {
  taskId?: string;
  taskTitle?: string;
  workspaceMode: WorkspaceModeId;
  durationMinutes: number;
}

const COMPLETED_SESSIONS_KEY = 'devbreak-focus-sessions';
const ACTIVE_SESSION_KEY = 'devbreak-active-focus-session';
const DAILY_STATS_RESET_KEY = 'devbreak-focus-daily-stats-reset-at';

@Injectable({
  providedIn: 'root',
})
export class FocusSessionService {
  private completedSessions = this.restoreCompletedSessions();
  private activeSession = this.restoreActiveSession();
  private dailyStatsResetAt = this.restoreDailyStatsResetAt();
  private readonly productivityStatsSubject = new BehaviorSubject<ProductivityStats>(
    this.calculateProductivityStats()
  );

  readonly productivityStats$: Observable<ProductivityStats> = this.productivityStatsSubject.asObservable();

  getDailyMetrics(): DailyFocusMetrics {
    return this.calculateDailyMetrics();
  }

  startSession(request: StartFocusSessionRequest): FocusSession {
    if (this.isActiveSessionUnfinished()) {
      this.skipActiveSession();
    }

    const session: FocusSession = {
      id: this.createSessionId(),
      taskId: request.taskId,
      taskTitle: request.taskTitle,
      workspaceMode: request.workspaceMode,
      startedAt: Date.now(),
      completedAt: null,
      skippedAt: null,
      durationMinutes: request.durationMinutes,
      completed: false,
      skipped: false,
    };

    this.activeSession = session;
    this.persistActiveSession();

    return session;
  }

  completeActiveSession(): FocusSessionCompletion | null {
    if (!this.isActiveSessionUnfinished()) {
      return null;
    }

    const activeSession = this.activeSession as FocusSession;
    const completedSession: FocusSession = {
      ...activeSession,
      completedAt: Date.now(),
      skippedAt: null,
      completed: true,
      skipped: false,
    };

    this.completedSessions = [...this.completedSessions, completedSession];
    this.activeSession = null;
    this.persistCompletedSessions();
    this.persistActiveSession();
    this.publishProductivityStats();

    return {
      session: completedSession,
      dailyMetrics: this.calculateDailyMetrics(),
    };
  }

  cancelActiveSession(): FocusSession | null {
    return this.skipActiveSession();
  }

  resetTodayStats(): void {
    this.dailyStatsResetAt = Date.now();
    this.persistDailyStatsResetAt();
    this.publishProductivityStats();
  }

  private calculateDailyMetrics(): DailyFocusMetrics {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
    const effectiveStart = this.dailyStatsResetAt >= startOfDay && this.dailyStatsResetAt < endOfDay
      ? this.dailyStatsResetAt
      : startOfDay;
    const todaysSessions = this.completedSessions.filter((session) =>
      session.completed === true &&
      session.completedAt !== null &&
      session.completedAt >= effectiveStart &&
      session.completedAt < endOfDay
    );
    const skippedSessionsToday = this.completedSessions.filter((session) =>
      session.skipped === true &&
      session.skippedAt !== null &&
      session.skippedAt !== undefined &&
      session.skippedAt >= effectiveStart &&
      session.skippedAt < endOfDay
    ).length;

    return {
      totalFocusMinutesToday: todaysSessions.reduce(
        (total, session) => total + session.durationMinutes,
        0
      ),
      completedSessionsToday: todaysSessions.length,
      skippedSessionsToday,
    };
  }

  private calculateProductivityStats(): ProductivityStats {
    return {
      ...this.calculateDailyMetrics(),
      currentStreakDays: this.calculateCurrentStreak(),
    };
  }

  private calculateCurrentStreak(): number {
    const completedDayKeys = [...new Set(
      this.completedSessions
        .filter((session) => session.completed === true && session.completedAt !== null)
        .map((session) => this.getDayKey(session.completedAt as number))
    )].sort((a, b) => b.localeCompare(a));

    if (!completedDayKeys.length) {
      return 0;
    }

    const today = this.getDayKey(Date.now());
    const yesterday = this.getDayKey(Date.now() - 24 * 60 * 60 * 1000);
    let expectedDay = completedDayKeys[0] === today ? today : yesterday;
    let streak = 0;

    for (const dayKey of completedDayKeys) {
      if (dayKey !== expectedDay) {
        break;
      }

      streak += 1;
      expectedDay = this.getPreviousDayKey(expectedDay);
    }

    return streak;
  }

  private publishProductivityStats(): void {
    this.productivityStatsSubject.next(this.calculateProductivityStats());
  }

  private getDayKey(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private getPreviousDayKey(dayKey: string): string {
    const [year, month, day] = dayKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    date.setDate(date.getDate() - 1);

    return this.getDayKey(date.getTime());
  }

  private restoreCompletedSessions(): FocusSession[] {
    try {
      const storedValue = window.localStorage.getItem(COMPLETED_SESSIONS_KEY);

      if (!storedValue) {
        return [];
      }

      const parsedValue: unknown = JSON.parse(storedValue);

      if (!Array.isArray(parsedValue)) {
        return [];
      }

      const sessions = parsedValue
        .filter((session): session is FocusSession => this.isFocusSession(session))
        .map((session) => this.normalizeStoredSession(session))
        .filter((session): session is FocusSession => session !== null);

      this.persistSessionHistory(sessions);

      return sessions;
    } catch {
      return [];
    }
  }

  private restoreActiveSession(): FocusSession | null {
    try {
      const storedValue = window.localStorage.getItem(ACTIVE_SESSION_KEY);

      if (!storedValue) {
        return null;
      }

      const parsedValue: unknown = JSON.parse(storedValue);

      const restoredSession = this.isFocusSession(parsedValue)
        ? this.normalizeActiveSession(parsedValue)
        : null;

      if (restoredSession === null) {
        window.localStorage.removeItem(ACTIVE_SESSION_KEY);
      }

      return restoredSession !== null
        ? restoredSession
        : null;
    } catch {
      return null;
    }
  }

  private persistCompletedSessions(): void {
    this.persistSessionHistory(this.completedSessions);
  }

  private persistSessionHistory(sessions: FocusSession[]): void {
    try {
      window.localStorage.setItem(COMPLETED_SESSIONS_KEY, JSON.stringify(sessions));
    } catch {
      // Focus history remains available in memory if storage is unavailable.
    }
  }

  private persistActiveSession(): void {
    try {
      if (this.activeSession) {
        window.localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(this.activeSession));
        return;
      }

      window.localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch {
      // Active focus session remains available in memory if storage is unavailable.
    }
  }

  private skipActiveSession(): FocusSession | null {
    if (!this.isActiveSessionUnfinished()) {
      return null;
    }

    const activeSession = this.activeSession as FocusSession;
    const skippedSession: FocusSession = {
      ...activeSession,
      completedAt: null,
      skippedAt: Date.now(),
      completed: false,
      skipped: true,
    };

    this.completedSessions = [...this.completedSessions, skippedSession];
    this.activeSession = null;
    this.persistCompletedSessions();
    this.persistActiveSession();
    this.publishProductivityStats();

    return skippedSession;
  }

  private isActiveSessionUnfinished(): boolean {
    return (
      this.activeSession !== null &&
      this.activeSession.completed !== true &&
      this.activeSession.skipped !== true &&
      this.activeSession.completedAt === null
    );
  }

  private normalizeStoredSession(session: FocusSession): FocusSession | null {
    const skippedAt = typeof session.skippedAt === 'number' && Number.isFinite(session.skippedAt)
      ? session.skippedAt
      : session.startedAt;
    const isSkipped = session.skipped === true && Number.isFinite(skippedAt);
    const isCompleted = (
      session.completed === true &&
      session.skipped !== true &&
      typeof session.completedAt === 'number' &&
      Number.isFinite(session.completedAt)
    );

    if (isCompleted) {
      return {
        ...session,
        completedAt: session.completedAt,
        skippedAt: null,
        completed: true,
        skipped: false,
      };
    }

    if (isSkipped) {
      return {
        ...session,
        completedAt: null,
        skippedAt,
        completed: false,
        skipped: true,
      };
    }

    return null;
  }

  private normalizeActiveSession(session: FocusSession): FocusSession | null {
    if (
      session.completed === true ||
      session.skipped === true ||
      session.completedAt !== null
    ) {
      return null;
    }

    return {
      ...session,
      skippedAt: null,
      completed: false,
      skipped: false,
    };
  }

  private restoreDailyStatsResetAt(): number {
    try {
      const storedValue = window.localStorage.getItem(DAILY_STATS_RESET_KEY);
      const parsedValue = Number(storedValue);

      return Number.isFinite(parsedValue) ? parsedValue : 0;
    } catch {
      return 0;
    }
  }

  private persistDailyStatsResetAt(): void {
    try {
      window.localStorage.setItem(DAILY_STATS_RESET_KEY, String(this.dailyStatsResetAt));
    } catch {
      // Daily stats reset remains active in memory if storage is unavailable.
    }
  }

  private isFocusSession(value: unknown): value is FocusSession {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<FocusSession>;

    return (
      typeof candidate.id === 'string' &&
      (candidate.taskId === undefined || typeof candidate.taskId === 'string') &&
      (candidate.taskTitle === undefined || typeof candidate.taskTitle === 'string') &&
      this.isWorkspaceMode(candidate.workspaceMode) &&
      typeof candidate.startedAt === 'number' &&
      Number.isFinite(candidate.startedAt) &&
      (candidate.completedAt === null ||
        (typeof candidate.completedAt === 'number' && Number.isFinite(candidate.completedAt))) &&
      (
        candidate.skippedAt === undefined ||
        candidate.skippedAt === null ||
        (typeof candidate.skippedAt === 'number' && Number.isFinite(candidate.skippedAt))
      ) &&
      typeof candidate.durationMinutes === 'number' &&
      Number.isFinite(candidate.durationMinutes) &&
      candidate.durationMinutes > 0 &&
      typeof candidate.completed === 'boolean' &&
      (candidate.skipped === undefined || typeof candidate.skipped === 'boolean')
    );
  }

  private isWorkspaceMode(value: unknown): value is WorkspaceModeId {
    return value === 'focus' || value === 'pomodoro' || value === 'wellness' || value === 'hybrid';
  }

  private createSessionId(): string {
    return `focus-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
