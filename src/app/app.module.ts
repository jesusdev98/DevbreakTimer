import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { App } from './app';
import { KanbanModule } from './features/kanban/kanban.module';
import { TimerModule } from './features/timer/timer.module';

@NgModule({
  declarations: [
    App
  ],
  imports: [
    BrowserModule,
    KanbanModule,
    TimerModule
  ],
  providers: [],
  bootstrap: [App]
})
export class AppModule { }
