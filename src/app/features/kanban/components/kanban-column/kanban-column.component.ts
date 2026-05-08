import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

import {
  Task,
  TaskCardAction,
  TaskCreateRequest,
  TaskEditRequest,
  TaskStatus,
} from '../../models/task.model';

@Component({
  selector: 'app-kanban-column',
  standalone: false,
  templateUrl: './kanban-column.component.html',
  styleUrls: ['./kanban-column.component.scss'],
})
export class KanbanColumnComponent implements OnChanges {
  @Input({ required: true }) title = '';
  @Input({ required: true }) status!: TaskStatus;
  @Input() tasks: Task[] = [];
  @Input() dropListId = '';
  @Input() connectedDropLists: string[] = [];
  @Input() activeTaskId: string | null = null;
  @Input() showFocusAction = true;
  @Input() showEditAction = true;
  @Input() showArchiveAction = true;
  @Input() showRestoreAction = false;
  @Input() disableDrag = false;
  @Input() showQuickAdd = true;
  @Input() quickAddOpen = false;
  @Input() emptyStateLabel = 'No tasks here';
  @Input() emptyStateHint = 'Use quick add to keep work moving.';

  @Output() taskDropped = new EventEmitter<CdkDragDrop<Task[]>>();
  @Output() taskAction = new EventEmitter<{ task: Task; action: TaskCardAction }>();
  @Output() taskEdit = new EventEmitter<{ task: Task; changes: TaskEditRequest }>();
  @Output() quickAddRequested = new EventEmitter<void>();
  @Output() quickAddCancelled = new EventEmitter<void>();
  @Output() quickTaskCreated = new EventEmitter<TaskCreateRequest>();

  @ViewChild('quickAddInput') private quickAddInput?: ElementRef<HTMLInputElement>;
  @ViewChild('quickAddTrigger') private quickAddTrigger?: ElementRef<HTMLButtonElement>;

  private readonly editingTaskIds = new Set<string>();
  protected quickAddTitle = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['quickAddOpen']) {
      return;
    }

    if (this.quickAddOpen) {
      this.focusQuickAddInput();
      return;
    }

    this.quickAddTitle = '';
  }

  protected handleTaskDrop(event: CdkDragDrop<Task[]>): void {
    this.taskDropped.emit(event);
  }

  protected handleTaskAction(task: Task, action: TaskCardAction): void {
    this.taskAction.emit({ task, action });
  }

  protected handleTaskEdit(task: Task, changes: TaskEditRequest): void {
    this.editingTaskIds.delete(task.id);
    this.taskEdit.emit({ task, changes });
  }

  protected markTaskEditing(task: Task): void {
    this.editingTaskIds.add(task.id);
  }

  protected clearTaskEditing(task: Task): void {
    this.editingTaskIds.delete(task.id);
  }

  protected isTaskEditing(task: Task): boolean {
    return this.editingTaskIds.has(task.id);
  }

  protected requestQuickAdd(): void {
    this.quickAddRequested.emit();
  }

  protected submitQuickTask(): void {
    const title = this.quickAddTitle.trim();

    if (!title) {
      return;
    }

    this.quickTaskCreated.emit({
      title,
      status: this.status,
    });
    this.quickAddTitle = '';
    this.focusQuickAddInput();
  }

  protected cancelQuickAdd(): void {
    this.quickAddTitle = '';
    this.quickAddCancelled.emit();
    window.setTimeout(() => this.quickAddTrigger?.nativeElement.focus());
  }

  protected handleQuickAddEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cancelQuickAdd();
  }

  private focusQuickAddInput(): void {
    window.setTimeout(() => this.quickAddInput?.nativeElement.focus());
  }
}
