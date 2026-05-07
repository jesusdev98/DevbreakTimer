import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Task } from '../../models/task.model';
import { TaskCardAction } from '../task-card/task-card.component';

@Component({
  selector: 'app-kanban-column',
  standalone: false,
  templateUrl: './kanban-column.component.html',
  styleUrls: ['./kanban-column.component.scss'],
})
export class KanbanColumnComponent {
  @Input({ required: true }) title = '';
  @Input() tasks: Task[] = [];
  @Input() canMoveBack = true;
  @Input() canMoveForward = true;

  @Output() taskAction = new EventEmitter<{ task: Task; action: TaskCardAction }>();

  protected handleTaskAction(task: Task, action: TaskCardAction): void {
    this.taskAction.emit({ task, action });
  }
}
