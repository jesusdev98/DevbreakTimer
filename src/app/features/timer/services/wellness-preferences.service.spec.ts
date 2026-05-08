import { afterEach, describe, expect, it } from 'vitest';

import { WellnessPreferencesService } from './wellness-preferences.service';

describe('WellnessPreferencesService', () => {
  const storageKey = 'devbreak-wellness-categories';

  afterEach(() => {
    localStorage.clear();
  });

  it('exposes the refined wellness category options', () => {
    const service = new WellnessPreferencesService();

    expect(service.categoryOptions.map((option) => option.label)).toEqual([
      'Stretching',
      'Mobility',
      'Cardio',
      'Strength',
      'Pilates',
    ]);
  });

  it('normalizes legacy recovery and posture preferences into current categories', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify(['stretching', 'recovery', 'posture', 'strength'])
    );

    const service = new WellnessPreferencesService();

    expect(service.getEnabledCategories()).toEqual(['stretching', 'pilates', 'mobility', 'strength']);
  });
});
