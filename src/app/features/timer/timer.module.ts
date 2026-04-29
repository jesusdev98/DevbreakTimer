import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimerContainerComponent } from './components/timer-container/timer-container.component';

@NgModule({
  declarations: [
    TimerContainerComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    TimerContainerComponent
  ]
})
export class TimerModule { }
