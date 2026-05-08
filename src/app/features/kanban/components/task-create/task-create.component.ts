import { Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';

import { TaskCreateRequest } from '../../models/task.model';
import { ShortcutService } from '../../../../services/shortcut.service';

@Component({
  selector: 'app-task-create',
  standalone: false,
  templateUrl: './task-create.component.html',
  styleUrls: ['./task-create.component.scss'],
})
export class TaskCreateComponent {
  @Output() createTask = new EventEmitter<TaskCreateRequest>();

  @ViewChild('titleInput') private titleInput?: ElementRef<HTMLInputElement>;

  protected title = '';
  protected description = '';

  constructor(private readonly shortcutService: ShortcutService) {}

  protected get canCreate(): boolean {
    return this.title.trim().length > 0;
  }

  protected submitTask(): void {
    const title = this.title.trim();
    const description = this.description.trim();

    if (!title) {
      return;
    }

    this.createTask.emit({
      title,
      description: description || undefined,
    });

    this.resetDraft();
    this.focusTitle();
  }

  public focusTitle(): void {
    window.setTimeout(() => this.titleInput?.nativeElement.focus());
  }

  public cancel(): void {
    this.resetDraft();
    this.titleInput?.nativeElement.blur();
  }

  protected handleCreateKeydown(event: KeyboardEvent): void {
    if (this.shortcutService.matches(event, 'escapeModal')) {
      event.preventDefault();
      this.cancel();
      return;
    }

    if (this.shortcutService.matches(event, 'save')) {
      event.preventDefault();
      this.submitTask();
    }
  }

  private resetDraft(): void {
    this.title = '';
    this.description = '';
  }
}
