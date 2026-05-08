import { Component } from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';

import { KanbanService } from '../../../kanban/services/kanban.service';
import { ProductivityStatsViewModel } from '../../models/focus-session.model';
import { FocusSessionService } from '../../services/focus-session.service';

@Component({
  selector: 'app-productivity-stats',
  standalone: false,
  templateUrl: './productivity-stats.component.html',
  styleUrls: ['./productivity-stats.component.scss'],
})
export class ProductivityStatsComponent {
  protected readonly stats$: Observable<ProductivityStatsViewModel>;

  constructor(
    private readonly focusSessionService: FocusSessionService,
    private readonly kanbanService: KanbanService,
  ) {
    this.stats$ = combineLatest([
      this.focusSessionService.productivityStats$,
      this.kanbanService.completedTasksToday$,
    ]).pipe(
      map(([stats, tasksCompletedToday]) => ({
        ...stats,
        tasksCompletedToday,
      }))
    );
  }

  protected formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours === 0) {
      return `${remainingMinutes}m`;
    }

    return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
  }

  protected resetToday(): void {
    this.focusSessionService.resetTodayStats();
    this.kanbanService.resetCompletedTasksToday();
  }
}
