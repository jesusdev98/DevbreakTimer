import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductivityStatsComponent } from './components/productivity-stats/productivity-stats.component';
import { TimerActionToolbarComponent } from './components/timer-action-toolbar/timer-action-toolbar.component';
import { TimerSettingsPanelComponent } from './components/timer-settings-panel/timer-settings-panel.component';
import { TimerContainerComponent } from './components/timer-container/timer-container.component';
import { WellnessBreakCardComponent } from './components/wellness-break-card/wellness-break-card.component';
import { WellnessInsightsCardComponent } from './components/wellness-insights-card/wellness-insights-card.component';
import { WellnessReminderCardComponent } from './components/wellness-reminder-card/wellness-reminder-card.component';

@NgModule({
  declarations: [
    ProductivityStatsComponent,
    TimerActionToolbarComponent,
    TimerSettingsPanelComponent,
    TimerContainerComponent,
    WellnessBreakCardComponent,
    WellnessInsightsCardComponent,
    WellnessReminderCardComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    ProductivityStatsComponent,
    TimerContainerComponent
  ]
})
export class TimerModule { }
