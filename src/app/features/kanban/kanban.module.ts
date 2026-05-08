import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';

import { KanbanBoardComponent } from './components/kanban-board/kanban-board.component';
import { KanbanColumnComponent } from './components/kanban-column/kanban-column.component';
import { TaskCreateComponent } from './components/task-create/task-create.component';
import { TaskCardComponent } from './components/task-card/task-card.component';

@NgModule({
  declarations: [
    KanbanBoardComponent,
    KanbanColumnComponent,
    TaskCreateComponent,
    TaskCardComponent
  ],
  imports: [
    CommonModule,
    DragDropModule,
    FormsModule
  ],
  exports: [
    KanbanBoardComponent
  ]
})
export class KanbanModule { }
