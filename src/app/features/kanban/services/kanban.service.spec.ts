import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KanbanService } from './kanban.service';

describe('KanbanService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T10:00:00'));
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('starts with a clean workspace when no tasks are stored', () => {
    const service = new KanbanService();

    expect(service.getTasks()).toEqual([]);
  });

  it('resets workspace tasks and active task without clearing preferences', () => {
    const service = new KanbanService();
    const [task] = service.createTask({ title: 'Reset me', status: 'todo' });

    service.setActiveTask(task);
    service.resetWorkspace();

    expect(service.getTasks()).toEqual([]);
    expect(service.getActiveTaskId()).toBeNull();
    expect(localStorage.getItem('devbreak-kanban-tasks')).toBe('[]');
    expect(localStorage.getItem('devbreak-kanban-active-task-id')).toBeNull();
  });

  it('resets completed task counts for today while preserving tasks', () => {
    const service = new KanbanService();
    let completedTasksToday = -1;

    service.completedTasksToday$.subscribe((count) => {
      completedTasksToday = count;
    });

    const [task] = service.createTask({ title: 'Done before reset', status: 'todo' });
    service.completeTaskById(task.id);

    expect(completedTasksToday).toBe(1);

    vi.setSystemTime(new Date('2026-05-08T10:30:00'));
    service.resetCompletedTasksToday();

    expect(completedTasksToday).toBe(0);
    expect(service.getTasks()).toHaveLength(1);

    const nextTask = service.createTask({ title: 'Done after reset', status: 'todo' }).at(-1);

    if (!nextTask) {
      throw new Error('Expected created task');
    }

    vi.setSystemTime(new Date('2026-05-08T10:45:00'));
    service.completeTaskById(nextTask.id);

    expect(completedTasksToday).toBe(1);
  });
});
