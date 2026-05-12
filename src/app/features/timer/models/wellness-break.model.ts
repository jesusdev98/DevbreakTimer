import { SessionType } from '../services/timer.service';

export type WellnessCategory =
  | 'stretching'
  | 'cardio'
  | 'strength'
  | 'mobility'
  | 'pilates';

export interface WellnessExercise {
  id: string;
  name: string;
  category: WellnessCategory;
  duration: number;
  custom: boolean;
}

export interface WellnessBreakSuggestion {
  id: string;
  title: string;
  description: string;
  category: WellnessCategory;
  durationLabel?: string;
  duration?: number;
  custom?: boolean;
  sessionTypes: Exclude<SessionType, 'focus'>[];
}
