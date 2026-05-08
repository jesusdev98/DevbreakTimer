export type TaskStatus = 'ideas' | 'todo' | 'in-progress' | 'done';
export type TaskCardAction =
  | 'moveBack'
  | 'moveForward'
  | 'archive'
  | 'delete'
  | 'restore'
  | 'focus'
  | 'clearFocus';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: number;
  completedAt?: number;
  completedSessionsCount?: number;
  archived: boolean;
}

export interface TaskCreateRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
}

export interface TaskEditRequest {
  title: string;
  description?: string;
}
