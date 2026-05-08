import { Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

import {
  Task,
  TaskCardAction,
  TaskCreateRequest,
  TaskEditRequest,
  TaskStatus,
} from '../../models/task.model';
import { KanbanColumn, KanbanService } from '../../services/kanban.service';
import { TaskCreateComponent } from '../task-create/task-create.component';
import { ShortcutService } from '../../../../services/shortcut.service';
import { WorkspaceModeService } from '../../../../services/workspace-mode.service';
import { WellnessReminderEngineService } from '../../../timer/services/wellness-reminder-engine.service';

interface TaskActionEvent {
  task: Task;
  action: TaskCardAction;
}

interface TaskEditEvent {
  task: Task;
  changes: TaskEditRequest;
}

interface KanbanDropEvent {
  event: CdkDragDrop<Task[]>;
  status: TaskStatus;
}

type TaskFilter = 'active' | 'focused' | 'completed' | 'archived';
type TaskSort = 'recent' | 'oldest' | 'alphabetical' | 'focusedTime';
type DensityMode = 'compact' | 'comfortable' | 'focus';

interface TaskFilterState {
  filter: TaskFilter;
  sort: TaskSort;
}

const TASK_FILTER_STORAGE_KEY = 'devbreak-task-filters';
const DEFAULT_FILTER_STATE: TaskFilterState = {
  filter: 'active',
  sort: 'recent',
};
const DENSITY_MODE_STORAGE_KEY = 'devbreak-density-mode';
const DEFAULT_DENSITY_MODE: DensityMode = 'comfortable';

@Component({
  selector: 'app-kanban-board',
  standalone: false,
  templateUrl: './kanban-board.component.html',
  styleUrls: [
    './kanban-board.component.scss',
    './kanban-board-toolbar.component.scss',
    './kanban-board-archive.component.scss',
  ],
})
export class KanbanBoardComponent implements OnDestroy {
  protected readonly columns: KanbanColumn[];
  protected readonly filterOptions: { id: TaskFilter; label: string }[] = [
    { id: 'active', label: 'Active' },
    { id: 'focused', label: 'Focused' },
    { id: 'completed', label: 'Completed' },
    { id: 'archived', label: 'Archived' },
  ];
  protected readonly sortOptions: { id: TaskSort; label: string }[] = [
    { id: 'recent', label: 'Recent first' },
    { id: 'oldest', label: 'Oldest first' },
    { id: 'alphabetical', label: 'Alphabetical' },
    { id: 'focusedTime', label: 'Most focused time' },
  ];
  protected readonly densityOptions: { id: DensityMode; label: string }[] = [
    { id: 'compact', label: 'Compact' },
    { id: 'comfortable', label: 'Comfortable' },
    { id: 'focus', label: 'Focus' },
  ];
  protected tasks: Task[];
  protected taskSearch = '';
  protected activeQuickAddStatus: TaskStatus | null = null;
  protected filterState = this.restoreFilterState();
  protected densityMode = this.restoreDensityMode();
  protected boardAnnouncement = '';

  @ViewChild(TaskCreateComponent) private taskCreate?: TaskCreateComponent;
  @ViewChild('taskSearchInput') private taskSearchInput?: ElementRef<HTMLInputElement>;
  private searchAnnouncementTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly kanbanService: KanbanService,
    private readonly shortcutService: ShortcutService,
    private readonly workspaceModeService: WorkspaceModeService,
    private readonly wellnessReminderEngine: WellnessReminderEngineService,
  ) {
    this.columns = this.kanbanService.columns;
    this.tasks = this.kanbanService.getTasks();
  }

  protected tasksFor(status: TaskStatus): Task[] {
    return this.sortTasks(
      this.tasks.filter((task) =>
        task.status === status &&
        this.matchesArchiveScope(task) &&
        this.matchesCurrentFilter(task) &&
        this.matchesSearch(task)
      )
    );
  }

  protected dropListId(status: TaskStatus): string {
    return this.kanbanService.dropListId(status);
  }

  protected connectedDropLists(status: TaskStatus): string[] {
    return this.kanbanService.connectedDropLists(status);
  }

  protected activeTaskId(): string | null {
    return this.kanbanService.getActiveTaskId();
  }

  protected isArchivedFilter(): boolean {
    return this.filterState.filter === 'archived';
  }

  protected filterCount(filter: TaskFilter): number {
    return this.tasks.filter((task) => this.matchesFilter(task, filter)).length;
  }

  protected canUseFocusWorkflow(): boolean {
    return this.workspaceModeService.getSelectedMode().id === 'focus';
  }

  protected shortcutLabel(action: 'createTask' | 'search' | 'escapeModal'): string {
    return this.shortcutService.formatCombo(this.shortcutService.getCombo(action));
  }

  protected archivedTasks(): Task[] {
    return this.sortTasks(
      this.kanbanService.archivedTasks().filter((task) => this.matchesSearch(task))
    );
  }

  protected setFilter(filter: TaskFilter): void {
    this.filterState = {
      ...this.filterState,
      filter,
    };
    this.activeQuickAddStatus = null;
    this.persistFilterState();
    this.announceBoardState(`${this.labelForFilter(filter)} filter applied`);
  }

  protected setSort(sort: TaskSort): void {
    this.filterState = {
      ...this.filterState,
      sort,
    };
    this.persistFilterState();
    this.announceBoardState(`Sorted by ${this.labelForSort(sort)}`);
  }

  protected emptyStateLabel(): string {
    if (this.taskSearch.trim()) {
      return 'No matching tasks';
    }

    if (this.filterState.filter === 'archived') {
      return 'No archived tasks';
    }

    if (this.filterState.filter === 'completed') {
      return 'No completed tasks';
    }

    if (this.filterState.filter === 'focused') {
      return 'No focused tasks';
    }

    return 'Column is clear';
  }

  protected emptyStateHint(): string {
    if (this.taskSearch.trim()) {
      return 'Adjust search or switch filters.';
    }

    if (this.filterState.filter === 'archived') {
      return 'Archived tasks will appear here.';
    }

    if (this.filterState.filter === 'completed') {
      return 'Completed work lands here.';
    }

    if (this.filterState.filter === 'focused') {
      return 'Set an active focus task to narrow the board.';
    }

    return 'Add a task when this lane needs attention.';
  }

  protected setDensityMode(mode: DensityMode): void {
    this.densityMode = mode;
    this.persistDensityMode();
  }

  protected handleTaskAction({ task, action }: TaskActionEvent): void {
    if (action === 'focus') {
      if (!this.canUseFocusWorkflow()) {
        return;
      }

      this.tasks = this.kanbanService.setActiveTask(task);
      this.announce(`${task.title} is now the focus task`);
      return;
    }

    if (action === 'clearFocus') {
      if (!this.canUseFocusWorkflow()) {
        return;
      }

      this.tasks = this.kanbanService.clearActiveTask();
      this.announce('Focus task cleared');
      return;
    }

    if (action === 'delete') {
      this.tasks = this.kanbanService.deleteTask(task);
      this.announce(`${task.title} deleted`);
      return;
    }

    if (action === 'restore') {
      this.tasks = this.kanbanService.restoreTask(task);
      this.announce(`${task.title} restored`);
      return;
    }

    if (action === 'archive') {
      this.tasks = this.kanbanService.archiveTask(task);
      this.announce(`${task.title} archived`);
      return;
    }

    this.tasks = this.kanbanService.moveTask(task, action);
    this.announce(`${task.title} moved`);
  }

  protected createTask(request: TaskCreateRequest): void {
    this.tasks = this.kanbanService.createTask(request);
    this.wellnessReminderEngine.recordTaskCreated();
    this.announce(`${request.title} added to ${this.labelForStatus(request.status ?? 'ideas')}`);
  }

  protected openQuickAdd(status: TaskStatus): void {
    this.activeQuickAddStatus = status;
  }

  protected cancelQuickAdd(status: TaskStatus): void {
    if (this.activeQuickAddStatus === status) {
      this.activeQuickAddStatus = null;
    }
  }

  protected updateTask({ task, changes }: TaskEditEvent): void {
    this.tasks = this.kanbanService.updateTask(task, changes);
    this.announce(`${changes.title} updated`);
  }

  protected handleTaskDrop(event: KanbanDropEvent): void {
    if (this.isArchivedFilter()) {
      return;
    }

    this.tasks = this.kanbanService.handleDrop(event.event, event.status);
    this.announce(`${event.event.item.data.title} moved to ${this.labelForStatus(event.status)}`);
  }

  protected clearSearch(): void {
    this.taskSearch = '';
    this.announceBoardState('Search cleared');
  }

  protected setTaskSearch(query: string): void {
    this.taskSearch = query;

    if (this.searchAnnouncementTimeout !== null) {
      clearTimeout(this.searchAnnouncementTimeout);
    }

    this.searchAnnouncementTimeout = setTimeout(() => {
      this.announceBoardState(this.taskSearch.trim() ? 'Search updated' : 'Search cleared');
      this.searchAnnouncementTimeout = null;
    }, 350);
  }

  ngOnDestroy(): void {
    if (this.searchAnnouncementTimeout !== null) {
      clearTimeout(this.searchAnnouncementTimeout);
    }
  }

  @HostListener('document:keydown', ['$event'])
  protected handleGlobalShortcut(event: KeyboardEvent): void {
    if (event.defaultPrevented || this.isTypingTarget(event.target)) {
      return;
    }

    if (this.shortcutService.matches(event, 'createTask')) {
      event.preventDefault();
      this.focusCreateTask();
      return;
    }

    if (this.shortcutService.matches(event, 'search')) {
      event.preventDefault();
      this.focusSearch();
      return;
    }

    if (this.shortcutService.matches(event, 'escapeModal')) {
      event.preventDefault();
      this.clearSearch();
      this.taskCreate?.cancel();
    }
  }

  private focusCreateTask(): void {
    this.taskCreate?.focusTitle();
  }

  private focusSearch(): void {
    window.setTimeout(() => this.taskSearchInput?.nativeElement.focus());
  }

  private announce(message: string): void {
    this.boardAnnouncement = message;
  }

  private announceBoardState(prefix: string): void {
    const count = this.visibleTaskCount();
    this.announce(`${prefix}. ${count} ${count === 1 ? 'task' : 'tasks'} shown`);
  }

  private visibleTaskCount(): number {
    return this.columns.reduce((total, column) => total + this.tasksFor(column.status).length, 0);
  }

  private labelForFilter(filter: TaskFilter): string {
    return this.filterOptions.find((option) => option.id === filter)?.label ?? filter;
  }

  private labelForSort(sort: TaskSort): string {
    return this.sortOptions.find((option) => option.id === sort)?.label ?? sort;
  }

  private labelForStatus(status: TaskStatus): string {
    return this.columns.find((column) => column.status === status)?.title ?? status;
  }

  private matchesArchiveScope(task: Task): boolean {
    return this.isArchivedFilter() ? task.archived : !task.archived;
  }

  private matchesCurrentFilter(task: Task): boolean {
    return this.matchesFilter(task, this.filterState.filter);
  }

  private matchesFilter(task: Task, filter: TaskFilter): boolean {
    if (filter === 'archived') {
      return task.archived;
    }

    if (task.archived) {
      return false;
    }

    if (filter === 'completed') {
      return task.status === 'done';
    }

    if (filter === 'focused') {
      return task.id === this.activeTaskId() || (task.completedSessionsCount ?? 0) > 0;
    }

    return task.status !== 'done';
  }

  private matchesSearch(task: Task): boolean {
    const query = this.taskSearch.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      task.title.toLowerCase().includes(query) ||
      (task.description?.toLowerCase().includes(query) ?? false)
    );
  }

  private sortTasks(tasks: Task[]): Task[] {
    const sortedTasks = [...tasks];

    if (this.filterState.sort === 'oldest') {
      return sortedTasks.sort((first, second) => first.createdAt - second.createdAt);
    }

    if (this.filterState.sort === 'alphabetical') {
      return sortedTasks.sort((first, second) => first.title.localeCompare(second.title));
    }

    if (this.filterState.sort === 'focusedTime') {
      return sortedTasks.sort((first, second) =>
        (second.completedSessionsCount ?? 0) - (first.completedSessionsCount ?? 0) ||
        second.createdAt - first.createdAt
      );
    }

    return sortedTasks.sort((first, second) => second.createdAt - first.createdAt);
  }

  private restoreFilterState(): TaskFilterState {
    try {
      const storedValue = window.localStorage.getItem(TASK_FILTER_STORAGE_KEY);

      if (!storedValue) {
        return DEFAULT_FILTER_STATE;
      }

      const parsedValue: unknown = JSON.parse(storedValue);

      return this.isFilterState(parsedValue) ? parsedValue : DEFAULT_FILTER_STATE;
    } catch {
      return DEFAULT_FILTER_STATE;
    }
  }

  private persistFilterState(): void {
    try {
      window.localStorage.setItem(TASK_FILTER_STORAGE_KEY, JSON.stringify(this.filterState));
    } catch {
      // Board filters remain usable in memory if storage is unavailable.
    }
  }

  private restoreDensityMode(): DensityMode {
    try {
      const storedValue = window.localStorage.getItem(DENSITY_MODE_STORAGE_KEY);

      return this.isDensityMode(storedValue) ? storedValue : DEFAULT_DENSITY_MODE;
    } catch {
      return DEFAULT_DENSITY_MODE;
    }
  }

  private persistDensityMode(): void {
    try {
      window.localStorage.setItem(DENSITY_MODE_STORAGE_KEY, this.densityMode);
    } catch {
      // Density remains usable in memory if storage is unavailable.
    }
  }

  private isFilterState(value: unknown): value is TaskFilterState {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<TaskFilterState>;

    return this.isTaskFilter(candidate.filter) && this.isTaskSort(candidate.sort);
  }

  private isTaskFilter(value: unknown): value is TaskFilter {
    return value === 'active' || value === 'focused' || value === 'completed' || value === 'archived';
  }

  private isTaskSort(value: unknown): value is TaskSort {
    return value === 'recent' || value === 'oldest' || value === 'alphabetical' || value === 'focusedTime';
  }

  private isDensityMode(value: unknown): value is DensityMode {
    return value === 'compact' || value === 'comfortable' || value === 'focus';
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();

    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target.isContentEditable
    );
  }
}
