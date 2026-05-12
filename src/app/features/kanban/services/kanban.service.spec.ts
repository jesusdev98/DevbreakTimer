import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KanbanService } from './kanban.service';

describe('KanbanService', () => {
  const tasksKey = 'devbreak-kanban-tasks';
  const activeTaskKey = 'devbreak-kanban-active-task-id';

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

  it('clears stale active task ids during restore', () => {
    localStorage.setItem(tasksKey, JSON.stringify([
      {
        id: 'task-valid',
        title: 'Valid task',
        status: 'todo',
        createdAt: Date.now(),
        archived: false,
      },
    ]));
    localStorage.setItem(activeTaskKey, 'missing-task');

    const service = new KanbanService();

    expect(service.getActiveTaskId()).toBeNull();
    expect(localStorage.getItem(activeTaskKey)).toBeNull();
  });

  it('falls back to a clean workspace for malformed persisted tasks', () => {
    localStorage.setItem(tasksKey, JSON.stringify([
      {
        id: '',
        title: '',
        status: 'todo',
        createdAt: Number.NaN,
        archived: false,
      },
    ]));

    const service = new KanbanService();

    expect(service.getTasks()).toEqual([]);
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

  it('counts tasks moved to done today even after archiving and restoring', () => {
    const service = new KanbanService();
    let completedTasksToday = -1;

    service.completedTasksToday$.subscribe((count) => {
      completedTasksToday = count;
    });

    const [task] = service.createTask({ title: 'Ship polish', status: 'in-progress' });
    const [completedTask] = service.moveTask(task, 'moveForward');

    expect(completedTask.status).toBe('done');
    expect(completedTasksToday).toBe(1);

    service.archiveTask(completedTask);

    expect(completedTasksToday).toBe(1);

    service.restoreTask({ ...completedTask, archived: true });

    expect(completedTasksToday).toBe(1);
  });

  it('does not refresh an already completed task timestamp when marked done again', () => {
    const service = new KanbanService();
    const [task] = service.createTask({ title: 'Already done', status: 'todo' });

    service.completeTaskById(task.id);
    const completedAt = service.getTasks()[0].completedAt;

    vi.setSystemTime(new Date('2026-05-08T11:00:00'));
    service.completeTaskById(task.id);

    expect(service.getTasks()[0].completedAt).toBe(completedAt);
    expect(service.getTasks()[0].completedSessionsCount).toBe(1);
  });
});
