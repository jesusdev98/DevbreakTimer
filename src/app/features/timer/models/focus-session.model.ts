import { WorkspaceModeId } from '../../../models/workspace-mode.model';

export interface FocusSession {
  id: string;
  taskId?: string;
  taskTitle?: string;
  workspaceMode: WorkspaceModeId;
  startedAt: number;
  completedAt: number | null;
  skippedAt?: number | null;
  durationMinutes: number;
  completed: boolean;
  skipped?: boolean;
}

export interface DailyFocusMetrics {
  totalFocusMinutesToday: number;
  completedSessionsToday: number;
  skippedSessionsToday: number;
}

export interface FocusSessionCompletion {
  session: FocusSession;
  dailyMetrics: DailyFocusMetrics;
}

export interface ProductivityStats extends DailyFocusMetrics {
  currentStreakDays: number;
}

export interface ProductivityStatsViewModel extends ProductivityStats {
  tasksCompletedToday: number;
}
