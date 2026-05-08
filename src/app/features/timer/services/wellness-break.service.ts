import { Injectable } from '@angular/core';

import { SessionType } from './timer.service';
import { WellnessBreakSuggestion, WellnessCategory } from '../models/wellness-break.model';
import { WorkspaceMode } from '../../../models/workspace-mode.model';

const WELLNESS_SUGGESTIONS: readonly WellnessBreakSuggestion[] = [
  {
    id: 'neck-stretch',
    title: 'Neck Stretch',
    description: 'Slowly tilt your head side to side and let your shoulders relax.',
    category: 'stretching',
    durationLabel: '45 seconds',
    sessionTypes: ['short-break', 'long-break'],
  },
  {
    id: 'shoulder-rolls',
    title: 'Shoulder Rolls',
    description: 'Roll your shoulders forward and backward to release desk tension.',
    category: 'mobility',
    durationLabel: '10 each way',
    sessionTypes: ['short-break', 'long-break'],
  },
  {
    id: 'stand-walk',
    title: 'Stand Up and Walk',
    description: 'Leave the chair, walk around, and reset your posture.',
    category: 'cardio',
    durationLabel: '2 minutes',
    sessionTypes: ['short-break', 'long-break'],
  },
  {
    id: 'wrist-mobility',
    title: 'Wrist Mobility',
    description: 'Circle both wrists and gently stretch fingers after keyboard work.',
    category: 'mobility',
    durationLabel: '60 seconds',
    sessionTypes: ['short-break', 'long-break'],
  },
  {
    id: 'deep-breathing',
    title: 'Deep Breathing',
    description: 'Inhale slowly, exhale fully, and soften your jaw and shoulders.',
    category: 'recovery',
    durationLabel: '5 breaths',
    sessionTypes: ['short-break', 'long-break'],
  },
  {
    id: 'eye-rest',
    title: 'Eye Rest Reminder',
    description: 'Look away from the screen and focus on something distant.',
    category: 'recovery',
    durationLabel: '20 seconds',
    sessionTypes: ['short-break', 'long-break'],
  },
  {
    id: 'posture-reset',
    title: 'Posture Reset',
    description: 'Stand tall, open your chest, and stack shoulders over hips.',
    category: 'posture',
    durationLabel: '45 seconds',
    sessionTypes: ['short-break', 'long-break'],
  },
  {
    id: 'desk-squats',
    title: 'Desk Squats',
    description: 'Do controlled bodyweight squats to wake up your legs.',
    category: 'strength',
    durationLabel: '8 reps',
    sessionTypes: ['long-break'],
  },
];

const BREAK_REMINDER: WellnessBreakSuggestion = {
  id: 'break-reminder',
  title: 'Time to Take a Break',
  description: 'Step away from the task, breathe, and let your attention reset.',
  category: 'recovery',
  sessionTypes: ['short-break', 'long-break'],
};

@Injectable({
  providedIn: 'root',
})
export class WellnessBreakService {
  private lastSuggestionId: string | null = null;

  getSuggestion(
    sessionType: SessionType,
    mode: WorkspaceMode,
    enabledCategories: WellnessCategory[],
  ): WellnessBreakSuggestion | null {
    if (sessionType === 'focus' || mode.breakPromptBehavior === 'none') {
      return null;
    }

    if (mode.breakPromptBehavior === 'reminder') {
      return BREAK_REMINDER;
    }

    const candidates = WELLNESS_SUGGESTIONS.filter((suggestion) =>
      suggestion.sessionTypes.includes(sessionType) && enabledCategories.includes(suggestion.category)
    );
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
