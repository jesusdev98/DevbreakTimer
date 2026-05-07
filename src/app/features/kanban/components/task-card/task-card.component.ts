import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Task } from '../../models/task.model';

export type TaskCardAction = 'moveBack' | 'moveForward' | 'archive' | 'delete';

@Component({
  selector: 'app-task-card',
  standalone: false,
  templateUrl: './task-card.component.html',
  styleUrls: ['./task-card.component.scss'],
})
export class TaskCardComponent {
  @Input({ required: true }) task!: Task;
  @Input() canMoveBack = true;
  @Input() canMoveForward = true;

  @Output() taskAction = new EventEmitter<TaskCardAction>();

  protected emitAction(action: TaskCardAction): void {
    this.taskAction.emit(action);
  }
}
