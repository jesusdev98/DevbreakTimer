import { Component, EventEmitter, Input, Output } from '@angular/core';

import { TimerStatus } from '../../services/timer.service';

@Component({
  selector: 'app-timer-action-toolbar',
  standalone: false,
  templateUrl: './timer-action-toolbar.component.html',
  styleUrls: ['./timer-action-toolbar.component.scss'],
})
export class TimerActionToolbarComponent {
  @Input({ required: true }) status!: TimerStatus;
  @Input() durationInMinutes = 25;
  @Input() pomodoroEnabled = false;
  @Input() presets: readonly number[] = [];
  @Input() durationLockMessage: string | null = null;

  @Output() durationChanged = new EventEmitter<number | string>();
  @Output() presetSelected = new EventEmitter<number>();
  @Output() startTimer = new EventEmitter<void>();
  @Output() pauseTimer = new EventEmitter<void>();
  @Output() resetTimer = new EventEmitter<void>();

  protected get durationLocked(): boolean {
    return this.status === 'running' || this.pomodoroEnabled;
  }

  protected get startLabel(): string {
    if (this.status === 'paused') {
      return 'Resume';
    }

    return this.status === 'completed' ? 'Restart' : 'Start';
  }
}
