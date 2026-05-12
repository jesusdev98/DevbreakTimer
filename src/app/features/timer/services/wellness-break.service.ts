import { Injectable } from '@angular/core';

import { SessionType } from './timer.service';
import { WellnessBreakSuggestion, WellnessCategory } from '../models/wellness-break.model';
import { WorkspaceMode } from '../../../models/workspace-mode.model';
import { WellnessExerciseService } from './wellness-exercise.service';

@Injectable({
  providedIn: 'root',
})
export class WellnessBreakService {
  private lastSuggestionId: string | null = null;

  constructor(private readonly wellnessExerciseService: WellnessExerciseService) {}

  getSuggestion(
    sessionType: SessionType,
    mode: WorkspaceMode,
    enabledCategories: WellnessCategory[],
  ): WellnessBreakSuggestion | null {
    if (sessionType === 'focus' || mode.breakPromptBehavior !== 'exercise') {
      return null;
    }

    const candidates = this.wellnessExerciseService.getExercises()
      .filter((exercise) => enabledCategories.includes(exercise.category))
      .map((exercise): WellnessBreakSuggestion => ({
        id: exercise.id,
        title: exercise.name,
        description: '',
        category: exercise.category,
        duration: exercise.duration,
        custom: exercise.custom,
        sessionTypes: ['short-break', 'long-break'],
      }))
      .filter((suggestion) => suggestion.sessionTypes.includes(sessionType));
    const availableCandidates = candidates.filter((suggestion) => suggestion.id !== this.lastSuggestionId);
    const suggestion = this.pickSuggestion(availableCandidates.length ? availableCandidates : candidates);

    this.lastSuggestionId = suggestion?.id ?? null;

    return suggestion;
  }

  private pickSuggestion(candidates: WellnessBreakSuggestion[]): WellnessBreakSuggestion | null {
    if (!candidates.length) {
      return null;
    }

    const index = Math.floor(Math.random() * candidates.length);

    return candidates[index];
  }
}
