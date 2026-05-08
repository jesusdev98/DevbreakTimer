import { Injectable } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { BehaviorSubject, Observable } from 'rxjs';

import { MOCK_TASKS } from '../data/mock-tasks';
import {
  Task,
  TaskCardAction,
  TaskCreateRequest,
  TaskEditRequest,
  TaskStatus,
} from '../models/task.model';

export interface KanbanColumn {
  title: string;
  status: TaskStatus;
}

const STORAGE_KEY = 'devbreak-kanban-tasks';
const ACTIVE_TASK_STORAGE_KEY = 'devbreak-kanban-active-task-id';
const DROP_LIST_PREFIX = 'kanban-column-';
const WORKFLOW: TaskStatus[] = ['ideas', 'todo', 'in-progress', 'done'];
const COLUMNS: KanbanColumn[] = [
  { title: 'Ideas', status: 'ideas' },
  { title: 'To Do', status: 'todo' },
  { title: 'In Progress', status: 'in-progress' },
  { title: 'Done', status: 'done' },
];

@Injectable({
  providedIn: 'root',
})
export class KanbanService {
  readonly columns = COLUMNS;

  private tasks = this.restoreTasks();
  private activeTaskId = this.restoreActiveTaskId();
  private readonly activeTaskSubject = new BehaviorSubject<Task | null>(this.findActiveTask());
  private readonly completedTasksTodaySubject = new BehaviorSubject<number>(
    this.calculateCompletedTasksToday()
  );

  readonly activeTask$: Observable<Task | null> = this.activeTaskSubject.asObservable();
  readonly completedTasksToday$: Observable<number> = this.completedTasksTodaySubject.asObservable();

  getTasks(): Task[] {
    return this.tasks;
  }

  getActiveTaskId(): string | null {
    return this.activeTaskId;
  }

  getActiveTask(): Task | null {
    return this.findActiveTask();
  }

  tasksFor(status: TaskStatus): Task[] {
    return this.tasks.filter((task) => task.status === status && !task.archived);
  }

  archivedTasks(): Task[] {
    return this.tasks.filter((task) => task.archived);
  }

  dropListId(status: TaskStatus): string {
    return `${DROP_LIST_PREFIX}${status}`;
  }

  connectedDropLists(status: TaskStatus): string[] {
    return WORKFLOW
      .filter((columnStatus) => columnStatus !== status)
      .map((columnStatus) => this.dropListId(columnStatus));
  }

  canMoveBack(status: TaskStatus): boolean {
    return WORKFLOW.indexOf(status) > 0;
  }

  canMoveForward(status: TaskStatus): boolean {
    return WORKFLOW.indexOf(status) < WORKFLOW.length - 1;
  }

  createTask(request: TaskCreateRequest): Task[] {
    const task: Task = {
      id: this.createTaskId(),
      title: request.title,
      description: request.description,
      status: request.status ?? 'ideas',
      createdAt: Date.now(),
      archived: false,
    };

    return this.commit([...this.tasks, task]);
  }

  updateTask(task: Task, changes: TaskEditRequest): Task[] {
    return this.commit(
      this.tasks.map((currentTask) =>
        currentTask.id === task.id ? { ...currentTask, ...changes } : currentTask
      )
    );
  }

  archiveTask(task: Task): Task[] {
    return this.commit(
      this.tasks.map((currentTask) =>
        currentTask.id === task.id ? { ...currentTask, archived: true } : currentTask
      )
    );
  }

  restoreTask(task: Task): Task[] {
    return this.commit(
      this.tasks.map((currentTask) =>
        currentTask.id === task.id ? { ...currentTask, archived: false } : currentTask
      )
    );
  }

  completeTaskById(taskId: string, completedSessionsCount = 1): Task[] {
    const completedAt = Date.now();

    return this.commit(
      this.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: 'done',
              completedAt,
              completedSessionsCount: (task.completedSessionsCount ?? 0) + completedSessionsCount,
            }
          : task
      )
    );
  }

  deleteTask(task: Task): Task[] {
    return this.commit(this.tasks.filter((currentTask) => currentTask.id !== task.id));
  }

  setActiveTask(task: Task): Task[] {
    this.activeTaskId = task.id;
    this.persistActiveTaskId();
    this.emitActiveTask();

    return this.tasks;
  }

  clearActiveTask(): Task[] {
    this.activeTaskId = null;
    this.persistActiveTaskId();
    this.emitActiveTask();

    return this.tasks;
  }

  moveTask(task: Task, action: Extract<TaskCardAction, 'moveBack' | 'moveForward'>): Task[] {
    const currentIndex = WORKFLOW.indexOf(task.status);
    const direction = action === 'moveForward' ? 1 : -1;
    const nextStatus = WORKFLOW[currentIndex + direction];

    if (!nextStatus) {
      return this.tasks;
    }

    const sourceTasks = this.tasksFor(task.status).filter(
      (currentTask) => currentTask.id !== task.id
    );
    const targetTasks = [...this.tasksFor(nextStatus), { ...task, status: nextStatus }];

    return this.replaceColumns([
      { status: task.status, tasks: sourceTasks },
      { status: nextStatus, tasks: targetTasks },
    ]);
  }

  handleDrop(event: CdkDragDrop<Task[]>, status: TaskStatus): Task[] {
    const previousStatus = this.statusFromDropListId(event.previousContainer.id);
    const previousTasks = [...event.previousContainer.data];
    const currentTasks = [...event.container.data];

    if (event.previousContainer === event.container) {
      moveItemInArray(currentTasks, event.previousIndex, event.currentIndex);
      return this.replaceColumns([{ status, tasks: currentTasks }]);
    }

    transferArrayItem(previousTasks, currentTasks, event.previousIndex, event.currentIndex);

    return this.replaceColumns([
      { status: previousStatus, tasks: previousTasks },
      { status, tasks: currentTasks.map((task) => ({ ...task, status })) },
    ]);
  }

  private replaceColumns(updates: { status: TaskStatus; tasks: Task[] }[]): Task[] {
    const updateMap = new Map(updates.map((update) => [update.status, update.tasks]));
    const archivedTasks = this.tasks.filter((task) => task.archived);

    return this.commit([
      ...WORKFLOW.flatMap((status) => updateMap.get(status) ?? this.tasksFor(status)),
      ...archivedTasks,
    ]);
  }

  private commit(tasks: Task[]): Task[] {
    this.tasks = tasks;
    this.persistTasks();
    this.syncActiveTask();
    this.publishCompletedTasksToday();

    return this.tasks;
  }

  private publishCompletedTasksToday(): void {
    this.completedTasksTodaySubject.next(this.calculateCompletedTasksToday());
  }

  private calculateCompletedTasksToday(): number {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    return this.tasks.filter((task) =>
      task.completedAt !== undefined &&
      task.completedAt >= startOfDay &&
      task.completedAt < endOfDay
    ).length;
  }

  private restoreTasks(): Task[] {
    const storedTasks = this.readStoredTasks();

    return storedTasks ?? MOCK_TASKS.map((task) => ({ ...task }));
  }

  private readStoredTasks(): Task[] | null {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);

      if (!storedValue) {
        return null;
      }

      const parsedValue: unknown = JSON.parse(storedValue);

      return this.isTaskArray(parsedValue) ? parsedValue : null;
    } catch {
      return null;
    }
  }

  private persistTasks(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks));
    } catch {
      // Persistence is best-effort so board interactions continue if storage is unavailable.
    }
  }

  private restoreActiveTaskId(): string | null {
    try {
      return window.localStorage.getItem(ACTIVE_TASK_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private persistActiveTaskId(): void {
    try {
      if (this.activeTaskId) {
        window.localStorage.setItem(ACTIVE_TASK_STORAGE_KEY, this.activeTaskId);
        return;
      }

      window.localStorage.removeItem(ACTIVE_TASK_STORAGE_KEY);
    } catch {
      // Focus selection remains usable in memory if storage is unavailable.
    }
  }

  private syncActiveTask(): void {
    if (!this.activeTaskId) {
      this.emitActiveTask();
      return;
    }

    if (!this.findActiveTask()) {
      this.activeTaskId = null;
      this.persistActiveTaskId();
    }

    this.emitActiveTask();
  }

  private emitActiveTask(): void {
    this.activeTaskSubject.next(this.findActiveTask());
  }

  private findActiveTask(): Task | null {
    if (!this.activeTaskId) {
      return null;
    }

    return this.tasks.find((task) =>
      task.id === this.activeTaskId &&
      !task.archived &&
      task.status !== 'done'
    ) ?? null;
  }

  private isTaskArray(value: unknown): value is Task[] {
    return Array.isArray(value) && value.every((task) => this.isTask(task));
  }

  private isTask(value: unknown): value is Task {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<Task>;

    return (
      typeof candidate.id === 'string' &&
      typeof candidate.title === 'string' &&
      (candidate.description === undefined || typeof candidate.description === 'string') &&
      WORKFLOW.includes(candidate.status as TaskStatus) &&
      typeof candidate.createdAt === 'number' &&
      (candidate.completedAt === undefined || typeof candidate.completedAt === 'number') &&
      (
        candidate.completedSessionsCount === undefined ||
        typeof candidate.completedSessionsCount === 'number'
      ) &&
      typeof candidate.archived === 'boolean'
    );
  }

  private statusFromDropListId(dropListId: string): TaskStatus {
    return dropListId.replace(DROP_LIST_PREFIX, '') as TaskStatus;
  }

  private createTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
