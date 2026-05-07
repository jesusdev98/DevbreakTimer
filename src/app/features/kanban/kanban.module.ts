import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { KanbanBoardComponent } from './components/kanban-board/kanban-board.component';
import { KanbanColumnComponent } from './components/kanban-column/kanban-column.component';
import { TaskCardComponent } from './components/task-card/task-card.component';

@NgModule({
  declarations: [
    KanbanBoardComponent,
    KanbanColumnComponent,
    TaskCardComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    KanbanBoardComponent
  ]
})
export class KanbanModule { }
