import { Component } from '@angular/core';

import { MOCK_TASKS } from '../../data/mock-tasks';
import { Task, TaskStatus } from '../../models/task.model';
import { TaskCardAction } from '../task-card/task-card.component';

interface KanbanColumn {
  title: string;
  status: TaskStatus;
}

interface TaskActionEvent {
  task: Task;
  action: TaskCardAction;
}

const STORAGE_KEY = 'devbreak-kanban-tasks';

@Component({
  selector: 'app-kanban-board',
  standalone: false,
  templateUrl: './kanban-board.component.html',
  styleUrls: ['./kanban-board.component.scss'],
})
export class KanbanBoardComponent {
  private readonly workflow: TaskStatus[] = ['ideas', 'todo', 'in-progress', 'done'];

  protected readonly columns: KanbanColumn[] = [
    { title: 'Ideas', status: 'ideas' },
    { title: 'To Do', status: 'todo' },
    { title: 'In Progress', status: 'in-progress' },
    { title: 'Done', status: 'done' },
  ];

  protected tasks = this.restoreTasks();

  protected tasksFor(status: TaskStatus): Task[] {
    return this.tasks.filter((task) => task.status === status && !task.archived);
  }

  protected canMoveBack(status: TaskStatus): boolean {
    return this.workflow.indexOf(status) > 0;
  }

  protected canMoveForward(status: TaskStatus): boolean {
    return this.workflow.indexOf(status) < this.workflow.length - 1;
  }

  protected handleTaskAction({ task, action }: TaskActionEvent): void {
    if (action === 'delete') {
      this.tasks = this.tasks.filter((currentTask) => currentTask.id !== task.id);
      this.persistTasks();
      return;
    }

    if (action === 'archive') {
      this.tasks = this.tasks.map((currentTask) =>
        currentTask.id === task.id ? { ...currentTask, archived: true } : currentTask
      );
      this.persistTasks();
      return;
    }

    this.moveTask(task, action);
  }

  private moveTask(task: Task, action: Extract<TaskCardAction, 'moveBack' | 'moveForward'>): void {
    const currentIndex = this.workflow.indexOf(task.status);
    const direction = action === 'moveForward' ? 1 : -1;
    const nextStatus = this.workflow[currentIndex + direction];

    if (!nextStatus) {
      return;
    }

    this.tasks = this.tasks.map((currentTask) =>
      currentTask.id === task.id ? { ...currentTask, status: nextStatus } : currentTask
    );
    this.persistTasks();
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
      this.workflow.includes(candidate.status as TaskStatus) &&
      typeof candidate.createdAt === 'number' &&
      typeof candidate.archived === 'boolean'
    );
  }
}
