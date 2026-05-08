import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShortcutService } from '../../../../services/shortcut.service';
import { WorkspaceModeService } from '../../../../services/workspace-mode.service';
import { WorkspaceMode, WorkspaceModeId } from '../../../../models/workspace-mode.model';
import { WellnessReminderEngineService } from '../../../timer/services/wellness-reminder-engine.service';
import { Task, TaskStatus } from '../../models/task.model';
import { KanbanService } from '../../services/kanban.service';
import { KanbanBoardComponent } from './kanban-board.component';

describe('KanbanBoardComponent', () => {
  const filterStorageKey = 'devbreak-task-filters';
  const densityStorageKey = 'devbreak-density-mode';
  let tasks: Task[];
  let kanbanService: Pick<
    KanbanService,
    | 'columns'
    | 'getTasks'
    | 'getActiveTaskId'
    | 'archivedTasks'
    | 'dropListId'
    | 'connectedDropLists'
    | 'setActiveTask'
    | 'clearActiveTask'
    | 'deleteTask'
    | 'restoreTask'
    | 'archiveTask'
    | 'moveTask'
    | 'createTask'
    | 'updateTask'
    | 'handleDrop'
  >;
  let shortcutService: Pick<ShortcutService, 'formatCombo' | 'getCombo' | 'matches'>;
  let workspaceModeService: Pick<WorkspaceModeService, 'getSelectedMode'>;
  let wellnessReminderEngine: Pick<WellnessReminderEngineService, 'recordTaskCreated'>;

  beforeEach(() => {
    localStorage.clear();
    tasks = [
      task('1', 'Write spec', 'todo', 100, { completedSessionsCount: 2 }),
      task('2', 'Archive me', 'todo', 200, { archived: true }),
      task('3', 'Done alpha', 'done', 300),
      task('4', 'Done beta', 'done', 250),
      task('5', 'In progress note', 'in-progress', 400),
    ];
    kanbanService = {
      columns: [
        { title: 'To Do', status: 'todo' },
        { title: 'Done', status: 'done' },
      ],
      getTasks: vi.fn(() => tasks),
      getActiveTaskId: vi.fn(() => '1'),
      archivedTasks: vi.fn(() => tasks.filter((item) => item.archived)),
      dropListId: vi.fn((status: TaskStatus) => `${status}-list`),
      connectedDropLists: vi.fn(() => []),
      setActiveTask: vi.fn((selected: Task) => tasks.map((item) => ({ ...item, active: item.id === selected.id }))),
      clearActiveTask: vi.fn(() => tasks),
      deleteTask: vi.fn(() => tasks),
      restoreTask: vi.fn(() => tasks),
      archiveTask: vi.fn(() => tasks),
      moveTask: vi.fn(() => tasks),
      createTask: vi.fn(() => tasks),
      updateTask: vi.fn(() => tasks),
      handleDrop: vi.fn(() => tasks),
    };
    shortcutService = {
      formatCombo: vi.fn((combo: string) => combo),
      getCombo: vi.fn(() => 'N'),
      matches: vi.fn(() => false),
    };
    workspaceModeService = {
      getSelectedMode: vi.fn(() => workspaceMode('hybrid')),
    };
    wellnessReminderEngine = {
      recordTaskCreated: vi.fn(),
    };
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('falls back from invalid persisted filters and density', () => {
    localStorage.setItem(filterStorageKey, JSON.stringify({ filter: 'bad', sort: 'bad' }));
    localStorage.setItem(densityStorageKey, 'dense');

    const component = createComponent();

    expect(component.filterState).toEqual({ filter: 'active', sort: 'recent' });
    expect(component.densityMode).toBe('comfortable');
  });

  it('combines search, filters, and sorting on derived task lists', () => {
    const component = createComponent();

    component.taskSearch = 'done';
    component.setFilter('completed');
    component.setSort('alphabetical');

    expect(component.tasksFor('done').map((item: Task) => item.title)).toEqual(['Done alpha', 'Done beta']);
  });

  it('keeps archived tasks isolated to archived filtering', () => {
    const component = createComponent();

    expect(component.tasksFor('todo').map((item: Task) => item.id)).toEqual(['1']);

    component.setFilter('archived');

    expect(component.tasksFor('todo').map((item: Task) => item.id)).toEqual(['2']);
  });

  it('blocks focus task actions outside Focus mode', () => {
    const component = createComponent();

    component.handleTaskAction({ task: tasks[0], action: 'focus' });

    expect(kanbanService.setActiveTask).not.toHaveBeenCalled();
  });

  it('allows focus task actions in Focus mode', () => {
    workspaceModeService.getSelectedMode = vi.fn(() => workspaceMode('focus'));
    const component = createComponent();

    component.handleTaskAction({ task: tasks[0], action: 'focus' });

    expect(kanbanService.setActiveTask).toHaveBeenCalledWith(tasks[0]);
  });

  it('persists density mode changes', () => {
    const component = createComponent();

    component.setDensityMode('compact');

    expect(localStorage.getItem(densityStorageKey)).toBe('compact');
  });

  it('records wellness activity when quick-add creates a task', () => {
    const component = createComponent();

    component.createTask({ title: 'New task', status: 'todo' });

    expect(kanbanService.createTask).toHaveBeenCalledWith({ title: 'New task', status: 'todo' });
    expect(wellnessReminderEngine.recordTaskCreated).toHaveBeenCalled();
  });

  function createComponent(): any {
    return new KanbanBoardComponent(
      kanbanService as KanbanService,
      shortcutService as ShortcutService,
      workspaceModeService as WorkspaceModeService,
      wellnessReminderEngine as WellnessReminderEngineService,
    ) as any;
  }

  function workspaceMode(id: WorkspaceModeId): WorkspaceMode {
    return {
      id,
      label: id,
      description: '',
      focusDurationStrategy: '',
      breakBehavior: '',
      wellnessIntensity: 'medium',
      interruptionFrequency: 'balanced',
      breakPromptBehavior: 'exercise',
      timerCue: '',
    };
  }

  function task(
    id: string,
    title: string,
    status: TaskStatus,
    createdAt: number,
    overrides: Partial<Task> = {},
  ): Task {
    return {
      id,
      title,
      status,
      createdAt,
      archived: false,
      ...overrides,
    };
  }
});
