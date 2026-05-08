import { SessionType } from '../services/timer.service';

export type WellnessCategory =
  | 'stretching'
  | 'cardio'
  | 'strength'
  | 'mobility'
  | 'posture'
  | 'recovery';

export interface WellnessBreakSuggestion {
  id: string;
  title: string;
  description: string;
  category: WellnessCategory;
  durationLabel?: string;
  sessionTypes: Exclude<SessionType, 'focus'>[];
}
