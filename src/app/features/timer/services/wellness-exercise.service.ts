import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { WellnessCategory, WellnessExercise } from '../models/wellness-break.model';

export type WellnessExerciseInput = Pick<WellnessExercise, 'name' | 'category' | 'duration'>;

const STORAGE_KEY = 'devbreak-wellness-exercises';
const CATEGORY_LIMIT = 5;
const CATEGORY_ORDER: readonly WellnessCategory[] = ['stretching', 'mobility', 'cardio', 'strength', 'pilates'];

const DEFAULT_EXERCISES: readonly WellnessExercise[] = [
  { id: 'neck-stretch', name: 'Neck stretch', category: 'stretching', duration: 45, custom: false },
  { id: 'shoulder-stretch', name: 'Shoulder stretch', category: 'stretching', duration: 45, custom: false },
  { id: 'back-stretch', name: 'Back stretch', category: 'stretching', duration: 45, custom: false },
  { id: 'leg-stretch', name: 'Leg stretch', category: 'stretching', duration: 45, custom: false },
  { id: 'wrist-stretch', name: 'Wrist stretch', category: 'stretching', duration: 30, custom: false },
  { id: 'neck-rotations', name: 'Neck rotations', category: 'mobility', duration: 30, custom: false },
  { id: 'shoulder-rotations', name: 'Shoulder rotations', category: 'mobility', duration: 30, custom: false },
  { id: 'hip-mobility', name: 'Hip mobility', category: 'mobility', duration: 45, custom: false },
  { id: 'ankle-rotations', name: 'Ankle rotations', category: 'mobility', duration: 30, custom: false },
  { id: 'spinal-flexion-extension', name: 'Spinal flexion & extension', category: 'mobility', duration: 45, custom: false },
  { id: 'jumping-jacks', name: 'Jumping jacks', category: 'cardio', duration: 45, custom: false },
  { id: 'high-knees', name: 'High knees', category: 'cardio', duration: 45, custom: false },
  { id: 'jump-squats', name: 'Jump squats', category: 'cardio', duration: 45, custom: false },
  { id: 'mountain-climbers', name: 'Mountain climbers', category: 'cardio', duration: 45, custom: false },
  { id: 'burpees', name: 'Burpees', category: 'cardio', duration: 45, custom: false },
  { id: 'push-ups', name: 'Push-ups', category: 'strength', duration: 45, custom: false },
  { id: 'squats', name: 'Squats', category: 'strength', duration: 45, custom: false },
  { id: 'lunges', name: 'Lunges', category: 'strength', duration: 45, custom: false },
  { id: 'plank', name: 'Plank', category: 'strength', duration: 45, custom: false },
  { id: 'tricep-dips', name: 'Tricep dips', category: 'strength', duration: 45, custom: false },
  { id: 'glute-bridge', name: 'Glute bridge', category: 'pilates', duration: 45, custom: false },
  { id: 'roll-up', name: 'Roll-up', category: 'pilates', duration: 45, custom: false },
  { id: 'modified-hundred', name: 'Modified hundred', category: 'pilates', duration: 45, custom: false },
  { id: 'cat-camel', name: 'Cat-camel', category: 'pilates', duration: 45, custom: false },
  { id: 'leg-raises', name: 'Leg raises', category: 'pilates', duration: 45, custom: false },
];

@Injectable({
  providedIn: 'root',
})
export class WellnessExerciseService {
  readonly categoryLimit = CATEGORY_LIMIT;
  readonly exercises$: Observable<WellnessExercise[]>;

  private exercises = this.restoreExercises();
  private readonly exercisesSubject = new BehaviorSubject<WellnessExercise[]>(this.exercises);

  constructor() {
    this.exercises$ = this.exercisesSubject.asObservable();
  }

  getExercises(): WellnessExercise[] {
    return [...this.exercises];
  }

  getDefaultExercises(): WellnessExercise[] {
    return DEFAULT_EXERCISES.map((exercise) => ({ ...exercise }));
  }

  countByCategory(category: WellnessCategory, excludingId: string | null = null): number {
    return this.exercises.filter((exercise) =>
      exercise.category === category && exercise.id !== excludingId
    ).length;
  }

  canAddToCategory(category: WellnessCategory, excludingId: string | null = null): boolean {
    return this.countByCategory(category, excludingId) < CATEGORY_LIMIT;
  }

  addExercise(input: WellnessExerciseInput): WellnessExercise | null {
    const exercise = this.normalizeExerciseInput(input);

    if (exercise === null || !this.canAddToCategory(exercise.category)) {
      return null;
    }

    const nextExercise: WellnessExercise = {
      ...exercise,
      id: this.createExerciseId(),
      custom: true,
    };

    this.setExercises([...this.exercises, nextExercise]);

    return nextExercise;
  }

  updateExercise(id: string, input: WellnessExerciseInput): WellnessExercise | null {
    const existingExercise = this.exercises.find((exercise) => exercise.id === id);
    const exercise = this.normalizeExerciseInput(input);

    if (existingExercise === undefined || exercise === null || !this.canAddToCategory(exercise.category, id)) {
      return null;
    }

    const nextExercise: WellnessExercise = {
      ...existingExercise,
      ...exercise,
      custom: existingExercise.custom || exercise.name !== existingExercise.name,
    };

    this.setExercises(this.exercises.map((candidate) => candidate.id === id ? nextExercise : candidate));

    return nextExercise;
  }

  deleteExercise(id: string): void {
    this.setExercises(this.exercises.filter((exercise) => exercise.id !== id));
  }

  private setExercises(exercises: WellnessExercise[]): void {
    this.exercises = this.sortExercises(exercises);
    this.persistExercises();
    this.exercisesSubject.next(this.getExercises());
  }

  private restoreExercises(): WellnessExercise[] {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);

      if (!storedValue) {
        return this.getDefaultExercises();
      }

      const parsedValue: unknown = JSON.parse(storedValue);
      const restoredExercises = this.normalizeExerciseArray(parsedValue);

      return restoredExercises.length ? restoredExercises : this.getDefaultExercises();
    } catch {
      return this.getDefaultExercises();
    }
  }

  private persistExercises(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.exercises));
    } catch {
      // Wellness exercises remain available in memory if storage is unavailable.
    }
  }

  private normalizeExerciseArray(value: unknown): WellnessExercise[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const exercises: WellnessExercise[] = [];

    value.forEach((candidate) => {
      const exercise = this.normalizeStoredExercise(candidate);

      if (exercise !== null && this.countCategoryIn(exercises, exercise.category) < CATEGORY_LIMIT) {
        exercises.push(exercise);
      }
    });

    return this.sortExercises(exercises);
  }

  private normalizeStoredExercise(value: unknown): WellnessExercise | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<WellnessExercise>;
    const input = this.normalizeExerciseInput(candidate);

    if (input === null || typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
      return null;
    }

    return {
      ...input,
      id: candidate.id.trim(),
      custom: candidate.custom === true,
    };
  }

  private normalizeExerciseInput(value: Partial<WellnessExerciseInput>): WellnessExerciseInput | null {
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    const category = this.normalizeCategory(value.category);
    const duration = Math.max(10, Math.min(600, Math.round(Number(value.duration))));

    if (!name || category === null || !Number.isFinite(duration)) {
      return null;
    }

    return { name, category, duration };
  }

  private normalizeCategory(value: unknown): WellnessCategory | null {
    return CATEGORY_ORDER.includes(value as WellnessCategory) ? value as WellnessCategory : null;
  }

  private sortExercises(exercises: WellnessExercise[]): WellnessExercise[] {
    return [...exercises].sort((first, second) => {
      const categorySort = CATEGORY_ORDER.indexOf(first.category) - CATEGORY_ORDER.indexOf(second.category);

      return categorySort === 0 ? first.name.localeCompare(second.name) : categorySort;
    });
  }

  private countCategoryIn(exercises: WellnessExercise[], category: WellnessCategory): number {
    return exercises.filter((exercise) => exercise.category === category).length;
  }

  private createExerciseId(): string {
    return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
