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

@Injectable({
  providedIn: 'root',
})
export class FocusSessionService {
  private completedSessions = this.restoreCompletedSessions();
  private activeSession = this.restoreActiveSession();
  private readonly productivityStatsSubject = new BehaviorSubject<ProductivityStats>(
    this.calculateProductivityStats()
  );

  readonly productivityStats$: Observable<ProductivityStats> = this.productivityStatsSubject.asObservable();

  getDailyMetrics(): DailyFocusMetrics {
    return this.calculateDailyMetrics();
  }

  startSession(request: StartFocusSessionRequest): FocusSession {
    const session: FocusSession = {
      id: this.createSessionId(),
      taskId: request.taskId,
      taskTitle: request.taskTitle,
      workspaceMode: request.workspaceMode,
      startedAt: Date.now(),
      completedAt: null,
      durationMinutes: request.durationMinutes,
      completed: false,
    };

    this.activeSession = session;
    this.persistActiveSession();

    return session;
  }

  completeActiveSession(): FocusSessionCompletion | null {
    if (this.activeSession === null) {
      return null;
    }

    const completedSession: FocusSession = {
      ...this.activeSession,
      completedAt: Date.now(),
      completed: true,
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

  cancelActiveSession(): void {
    if (this.activeSession === null) {
      return;
    }

    this.activeSession = null;
    this.persistActiveSession();
  }

  private calculateDailyMetrics(): DailyFocusMetrics {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
    const todaysSessions = this.completedSessions.filter((session) =>
      session.completedAt !== null &&
      session.completedAt >= startOfDay &&
      session.completedAt < endOfDay
    );

    return {
      totalFocusMinutesToday: todaysSessions.reduce(
        (total, session) => total + session.durationMinutes,
        0
      ),
      completedSessionsToday: todaysSessions.length,
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
        .filter((session) => session.completedAt !== null)
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

      return this.isFocusSessionArray(parsedValue)
        ? parsedValue.filter((session) => session.completed)
        : [];
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

      return this.isFocusSession(parsedValue) && !parsedValue.completed ? parsedValue : null;
    } catch {
      return null;
    }
  }

  private persistCompletedSessions(): void {
    try {
      window.localStorage.setItem(COMPLETED_SESSIONS_KEY, JSON.stringify(this.completedSessions));
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

  private isFocusSessionArray(value: unknown): value is FocusSession[] {
    return Array.isArray(value) && value.every((session) => this.isFocusSession(session));
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
      (candidate.completedAt === null || typeof candidate.completedAt === 'number') &&
      typeof candidate.durationMinutes === 'number' &&
      typeof candidate.completed === 'boolean'
    );
  }

  private isWorkspaceMode(value: unknown): value is WorkspaceModeId {
    return value === 'focus' || value === 'pomodoro' || value === 'wellness' || value === 'hybrid';
  }

  private createSessionId(): string {
    return `focus-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
