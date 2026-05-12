import { Component, Input } from '@angular/core';
import { LanguageService } from '../../../../services/language.service';

import { WellnessMetrics } from '../../services/wellness-reminder-engine.service';

@Component({
  selector: 'app-wellness-insights-card',
  standalone: false,
  templateUrl: './wellness-insights-card.component.html',
})
export class WellnessInsightsCardComponent {
  @Input({ required: true }) metrics!: WellnessMetrics;

  constructor(private readonly languageService: LanguageService) {}

  protected consistencyLabel(): string {
    if (this.metrics.weeklyConsistencyDays === 0) {
      return this.languageService.instant('wellness.insights.noDays');
    }

    if (this.metrics.weeklyConsistencyDays === 1) {
      return this.languageService.instant('wellness.insights.oneDay');
    }

    return this.languageService.instant('wellness.insights.manyDays', {
      count: this.metrics.weeklyConsistencyDays,
    });
  }
}
