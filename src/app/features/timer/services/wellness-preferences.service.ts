import { Injectable } from '@angular/core';

import { WellnessCategory } from '../models/wellness-break.model';

export interface WellnessCategoryOption {
  id: WellnessCategory;
  label: string;
}

const STORAGE_KEY = 'devbreak-wellness-categories';
const DEFAULT_CATEGORIES: WellnessCategory[] = ['stretching', 'mobility', 'cardio', 'recovery', 'posture'];

const CATEGORY_OPTIONS: readonly WellnessCategoryOption[] = [
  { id: 'stretching', label: 'Stretching' },
  { id: 'mobility', label: 'Mobility' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'strength', label: 'Strength' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'posture', label: 'Posture' },
];

@Injectable({
  providedIn: 'root',
})
export class WellnessPreferencesService {
  readonly categoryOptions = CATEGORY_OPTIONS;

  private enabledCategories = this.restoreCategories();

  getEnabledCategories(): WellnessCategory[] {
    return [...this.enabledCategories];
  }

  setEnabledCategories(categories: WellnessCategory[]): void {
    const validCategories = categories.filter((category) =>
      CATEGORY_OPTIONS.some((option) => option.id === category)
    );

    this.enabledCategories = [...new Set(validCategories)];
    this.persistCategories();
  }

  private restoreCategories(): WellnessCategory[] {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);

      if (!storedValue) {
        return [...DEFAULT_CATEGORIES];
      }

      const parsedValue: unknown = JSON.parse(storedValue);

      return this.isCategoryArray(parsedValue) && parsedValue.length
        ? parsedValue
        : [...DEFAULT_CATEGORIES];
    } catch {
      return [...DEFAULT_CATEGORIES];
    }
  }

  private persistCategories(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.enabledCategories));
    } catch {
      // Wellness preferences remain available in memory if storage is unavailable.
    }
  }

  private isCategoryArray(value: unknown): value is WellnessCategory[] {
    return Array.isArray(value) && value.every((category) =>
      CATEGORY_OPTIONS.some((option) => option.id === category)
    );
  }
}
