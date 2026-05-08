import { Component, Input } from '@angular/core';

import { WellnessMetrics } from '../../services/wellness-reminder-engine.service';

@Component({
  selector: 'app-wellness-insights-card',
  standalone: false,
  templateUrl: './wellness-insights-card.component.html',
})
export class WellnessInsightsCardComponent {
  @Input({ required: true }) metrics!: WellnessMetrics;

  protected consistencyLabel(): string {
    if (this.metrics.weeklyConsistencyDays === 0) {
      return 'Recovery can start with the next quiet reset.';
    }

    if (this.metrics.weeklyConsistencyDays === 1) {
      return 'Recovery showed up on 1 day this week.';
    }

    return `Recovery showed up on ${this.metrics.weeklyConsistencyDays} days this week.`;
  }
}
