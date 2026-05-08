import { Component, EventEmitter, Input, Output } from '@angular/core';

import { WellnessReminder } from '../../services/wellness-reminder-engine.service';

@Component({
  selector: 'app-wellness-reminder-card',
  standalone: false,
  templateUrl: './wellness-reminder-card.component.html',
})
export class WellnessReminderCardComponent {
  @Input({ required: true }) reminder!: WellnessReminder;
  @Input() wellnessMode = false;

  @Output() completeReminder = new EventEmitter<WellnessReminder>();
  @Output() nextSuggestion = new EventEmitter<WellnessReminder>();
  @Output() dismissReminder = new EventEmitter<WellnessReminder>();
}
