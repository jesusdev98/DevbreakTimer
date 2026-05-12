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
import { LanguageService } from '../../../../services/language.service';

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
  protected readonly filterOptions: { id: TaskFilter; labelKey: string }[] = [
    { id: 'active', labelKey: 'kanban.filters.active' },
    { id: 'focused', labelKey: 'kanban.filters.focused' },
    { id: 'completed', labelKey: 'kanban.filters.completed' },
    { id: 'archived', labelKey: 'kanban.filters.archived' },
  ];
  protected readonly sortOptions: { id: TaskSort; labelKey: string }[] = [
    { id: 'recent', labelKey: 'kanban.sort.recent' },
    { id: 'oldest', labelKey: 'kanban.sort.oldest' },
    { id: 'alphabetical', labelKey: 'kanban.sort.alphabetical' },
    { id: 'focusedTime', labelKey: 'kanban.sort.focusedTime' },
  ];
  protected readonly densityOptions: { id: DensityMode; labelKey: string }[] = [
    { id: 'compact', labelKey: 'kanban.density.compact' },
    { id: 'comfortable', labelKey: 'kanban.density.comfortable' },
    { id: 'focus', labelKey: 'kanban.density.focus' },
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
    private readonly languageService: LanguageService,
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
    this.announceBoardState(this.translate('kanban.announcements.filterApplied', {
      filter: this.labelForFilter(filter),
    }));
  }

  protected setSort(sort: TaskSort): void {
    this.filterState = {
      ...this.filterState,
      sort,
    };
    this.persistFilterState();
    this.announceBoardState(this.translate('kanban.announcements.sortedBy', {
      sort: this.labelForSort(sort),
    }));
  }

  protected emptyStateLabel(): string {
    if (this.taskSearch.trim()) {
      return this.translate('kanban.empty.noMatches');
    }

    if (this.filterState.filter === 'archived') {
      return this.translate('kanban.empty.noArchived');
    }

    if (this.filterState.filter === 'completed') {
      return this.translate('kanban.empty.noCompleted');
    }

    if (this.filterState.filter === 'focused') {
      return this.translate('kanban.empty.noFocused');
    }

    return this.translate('kanban.empty.clear');
  }

  protected emptyStateHint(): string {
    if (this.taskSearch.trim()) {
      return this.translate('kanban.empty.adjustSearch');
    }

    if (this.filterState.filter === 'archived') {
      return this.translate('kanban.empty.archivedHint');
    }

    if (this.filterState.filter === 'completed') {
      return this.translate('kanban.empty.completedHint');
    }

    if (this.filterState.filter === 'focused') {
      return this.translate('kanban.empty.focusedHint');
    }

    return this.translate('kanban.empty.clearHint');
  }

  protected setDensityMode(mode: DensityMode): void {
    this.densityMode = mode;
    this.persistDensityMode();
  }

  protected resetWorkspace(): void {
    this.activeQuickAddStatus = null;
    this.tasks = this.kanbanService.resetWorkspace();
    this.announce(this.translate('kanban.announcements.workspaceReset'));
  }

  protected handleTaskAction({ task, action }: TaskActionEvent): void {
    if (action === 'focus') {
      if (!this.canUseFocusWorkflow()) {
        return;
      }

      this.tasks = this.kanbanService.setActiveTask(task);
      this.announce(this.translate('kanban.announcements.focusSet', { task: task.title }));
      return;
    }

    if (action === 'clearFocus') {
      if (!this.canUseFocusWorkflow()) {
        return;
      }

      this.tasks = this.kanbanService.clearActiveTask();
      this.announce(this.translate('kanban.announcements.focusCleared'));
      return;
    }

    if (action === 'delete') {
      this.tasks = this.kanbanService.deleteTask(task);
      this.announce(this.translate('kanban.announcements.deleted', { task: task.title }));
      return;
    }

    if (action === 'restore') {
      this.tasks = this.kanbanService.restoreTask(task);
      this.announce(this.translate('kanban.announcements.restored', { task: task.title }));
      return;
    }

    if (action === 'archive') {
      this.tasks = this.kanbanService.archiveTask(task);
      this.announce(this.translate('kanban.announcements.archived', { task: task.title }));
      return;
    }

    this.tasks = this.kanbanService.moveTask(task, action);
    this.announce(this.translate('kanban.announcements.moved', { task: task.title }));
  }

  protected createTask(request: TaskCreateRequest): void {
    this.tasks = this.kanbanService.createTask(request);
    this.wellnessReminderEngine.recordTaskCreated();
    this.announce(this.translate('kanban.announcements.created', {
      task: request.title,
      column: this.labelForStatus(request.status ?? 'ideas'),
    }));
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
    this.announce(this.translate('kanban.announcements.updated', { task: changes.title }));
  }

  protected handleTaskDrop(event: KanbanDropEvent): void {
    if (this.isArchivedFilter()) {
      return;
    }

    this.tasks = this.kanbanService.handleDrop(event.event, event.status);
    this.announce(this.translate('kanban.announcements.movedTo', {
      task: event.event.item.data.title,
      column: this.labelForStatus(event.status),
    }));
  }

  protected clearSearch(): void {
    this.taskSearch = '';
    this.announceBoardState(this.translate('kanban.announcements.searchCleared'));
  }

  protected setTaskSearch(query: string): void {
    this.taskSearch = query;

    if (this.searchAnnouncementTimeout !== null) {
      clearTimeout(this.searchAnnouncementTimeout);
    }

    this.searchAnnouncementTimeout = setTimeout(() => {
      this.announceBoardState(this.translate(this.taskSearch.trim()
        ? 'kanban.announcements.searchUpdated'
        : 'kanban.announcements.searchCleared'));
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
    this.announce(this.translate('kanban.announcements.boardState', {
      prefix,
      count,
      taskLabel: this.translate(count === 1 ? 'kanban.task.singular' : 'kanban.task.plural'),
    }));
  }

  private visibleTaskCount(): number {
    return this.columns.reduce((total, column) => total + this.tasksFor(column.status).length, 0);
  }

  private labelForFilter(filter: TaskFilter): string {
    const option = this.filterOptions.find((candidate) => candidate.id === filter);
    return option ? this.translate(option.labelKey) : filter;
  }

  private labelForSort(sort: TaskSort): string {
    const option = this.sortOptions.find((candidate) => candidate.id === sort);
    return option ? this.translate(option.labelKey) : sort;
  }

  private labelForStatus(status: TaskStatus): string {
    return this.translate(`kanban.columns.${status}`);
  }

  protected translate(key: string, params?: Record<string, unknown>): string {
    return this.languageService.instant(key, params);
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

    return true;
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
