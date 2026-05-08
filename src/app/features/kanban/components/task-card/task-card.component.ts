import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

import { Task, TaskCardAction, TaskEditRequest } from '../../models/task.model';
import { ShortcutService } from '../../../../services/shortcut.service';

@Component({
  selector: 'app-task-card',
  standalone: false,
  templateUrl: './task-card.component.html',
  styleUrls: ['./task-card.component.scss'],
})
export class TaskCardComponent {
  @Input({ required: true }) task!: Task;
  @Input() isActive = false;
  @Input() showFocusAction = true;
  @Input() showEditAction = true;
  @Input() showArchiveAction = true;
  @Input() showRestoreAction = false;

  @Output() taskAction = new EventEmitter<TaskCardAction>();
  @Output() editStarted = new EventEmitter<void>();
  @Output() editCancelled = new EventEmitter<void>();
  @Output() saveTask = new EventEmitter<TaskEditRequest>();

  @ViewChild('editTitleInput') private editTitleInput?: ElementRef<HTMLInputElement>;
  @ViewChild('editButton') private editButton?: ElementRef<HTMLButtonElement>;

  protected isEditing = false;
  protected draftTitle = '';
  protected draftDescription = '';

  constructor(private readonly shortcutService: ShortcutService) {}

  protected get canSave(): boolean {
    return this.draftTitle.trim().length > 0;
  }

  protected emitAction(action: TaskCardAction): void {
    this.taskAction.emit(action);
  }

  protected startEdit(): void {
    this.draftTitle = this.task.title;
    this.draftDescription = this.task.description ?? '';
    this.isEditing = true;
    this.editStarted.emit();
    window.setTimeout(() => {
      this.editTitleInput?.nativeElement.focus();
      this.editTitleInput?.nativeElement.select();
    });
  }

  protected cancelEdit(): void {
    this.isEditing = false;
    this.draftTitle = '';
    this.draftDescription = '';
    this.editCancelled.emit();
    this.restoreEditButtonFocus();
  }

  protected saveEdit(): void {
    const title = this.draftTitle.trim();
    const description = this.draftDescription.trim();

    if (!title) {
      return;
    }

    this.saveTask.emit({
      title,
      description: description || undefined,
    });

    this.isEditing = false;
    this.restoreEditButtonFocus();
  }

  protected handleEditKeydown(event: KeyboardEvent): void {
    if (this.shortcutService.matches(event, 'escapeModal')) {
      event.preventDefault();
      this.cancelEdit();
      return;
    }

    if (this.shortcutService.matches(event, 'save')) {
      event.preventDefault();
      this.saveEdit();
    }
  }

  private restoreEditButtonFocus(): void {
    window.setTimeout(() => this.editButton?.nativeElement.focus());
  }
}
