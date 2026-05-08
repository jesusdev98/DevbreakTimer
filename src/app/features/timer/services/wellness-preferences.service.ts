import { Injectable } from '@angular/core';

import { WellnessCategory } from '../models/wellness-break.model';

export interface WellnessCategoryOption {
  id: WellnessCategory;
  label: string;
}

const STORAGE_KEY = 'devbreak-wellness-categories';
const DEFAULT_CATEGORIES: WellnessCategory[] = ['stretching', 'mobility', 'cardio', 'pilates'];
const LEGACY_CATEGORY_MAP: Partial<Record<string, WellnessCategory>> = {
  recovery: 'pilates',
  posture: 'mobility',
};

const CATEGORY_OPTIONS: readonly WellnessCategoryOption[] = [
  { id: 'stretching', label: 'Stretching' },
  { id: 'mobility', label: 'Mobility' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'strength', label: 'Strength' },
  { id: 'pilates', label: 'Pilates' },
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
    const validCategories = categories
      .map((category) => this.normalizeCategory(category))
      .filter((category): category is WellnessCategory => category !== null);

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

      const restoredCategories = this.normalizeCategories(parsedValue);

      return restoredCategories.length
        ? restoredCategories
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

  private normalizeCategories(value: unknown): WellnessCategory[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return [
      ...new Set(
        value
          .map((category) => this.normalizeCategory(category))
          .filter((category): category is WellnessCategory => category !== null)
      ),
    ];
  }

  private normalizeCategory(value: unknown): WellnessCategory | null {
    if (typeof value !== 'string') {
      return null;
    }

    if (CATEGORY_OPTIONS.some((option) => option.id === value)) {
      return value as WellnessCategory;
    }

    return LEGACY_CATEGORY_MAP[value] ?? null;
  }
}
