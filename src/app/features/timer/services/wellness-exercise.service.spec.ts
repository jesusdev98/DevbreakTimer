import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WellnessExerciseService } from './wellness-exercise.service';

describe('WellnessExerciseService', () => {
  const storageKey = 'devbreak-wellness-exercises';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('loads five preset exercises per category', () => {
    const service = new WellnessExerciseService();

    expect(service.getExercises().filter((exercise) => exercise.category === 'stretching')).toHaveLength(5);
    expect(service.getExercises().filter((exercise) => exercise.category === 'mobility')).toHaveLength(5);
    expect(service.getExercises().filter((exercise) => exercise.category === 'cardio')).toHaveLength(5);
    expect(service.getExercises().filter((exercise) => exercise.category === 'strength')).toHaveLength(5);
    expect(service.getExercises().filter((exercise) => exercise.category === 'pilates')).toHaveLength(5);
  });

  it('enforces the five exercise category limit', () => {
    const service = new WellnessExerciseService();

    expect(service.addExercise({
      name: 'Desk reset',
      category: 'stretching',
      duration: 30,
    })).toBeNull();

    service.deleteExercise('neck-stretch');

    expect(service.addExercise({
      name: 'Desk reset',
      category: 'stretching',
      duration: 30,
    })).not.toBeNull();
  });

  it('persists custom edits and deletions', () => {
    const service = new WellnessExerciseService();

    service.deleteExercise('neck-stretch');
    const customExercise = service.addExercise({
      name: 'Desk reset',
      category: 'stretching',
      duration: 30,
    });

    expect(customExercise).not.toBeNull();

    service.updateExercise(customExercise?.id ?? '', {
      name: 'Desk reset plus',
      category: 'stretching',
      duration: 45,
    });

    const restored = new WellnessExerciseService();

    expect(restored.getExercises().some((exercise) => exercise.id === 'neck-stretch')).toBe(false);
    expect(restored.getExercises()).toContainEqual(expect.objectContaining({
      name: 'Desk reset plus',
      category: 'stretching',
      duration: 45,
      custom: true,
    }));
  });

  it('falls back to presets when stored data is invalid', () => {
    localStorage.setItem(storageKey, '{bad json');

    const service = new WellnessExerciseService();

    expect(service.getExercises()).toHaveLength(25);
  });
});
