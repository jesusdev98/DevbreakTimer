import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceMode } from '../../../models/workspace-mode.model';
import { WellnessExerciseService } from './wellness-exercise.service';
import { WellnessBreakService } from './wellness-break.service';

describe('WellnessBreakService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('does not suggest exercises for focus or pomodoro reminder modes', () => {
    const service = createService();

    expect(service.getSuggestion('short-break', mode('focus', 'none'), ['stretching'])).toBeNull();
    expect(service.getSuggestion('short-break', mode('pomodoro', 'reminder'), ['stretching'])).toBeNull();
  });

  it('uses only enabled wellness categories for exercise suggestions', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const service = createService();

    const suggestion = service.getSuggestion('short-break', mode('wellness', 'exercise'), ['cardio']);

    expect(suggestion).toEqual(expect.objectContaining({
      category: 'cardio',
      duration: expect.any(Number),
    }));
  });

  it('can include custom exercises in enabled categories', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const exerciseService = new WellnessExerciseService();
    ['neck-stretch', 'shoulder-stretch', 'back-stretch', 'leg-stretch', 'wrist-stretch']
      .forEach((id) => exerciseService.deleteExercise(id));
    const customExercise = exerciseService.addExercise({
      name: 'Desk flow',
      category: 'stretching',
      duration: 35,
    });
    const service = new WellnessBreakService(exerciseService);

    const suggestion = service.getSuggestion('short-break', mode('hybrid', 'exercise'), ['stretching']);

    expect(customExercise).not.toBeNull();
    expect(suggestion).toEqual(expect.objectContaining({
      id: customExercise?.id,
      title: 'Desk flow',
      duration: 35,
      custom: true,
    }));
  });

  it('fails gracefully when no wellness categories are enabled', () => {
    const service = createService();

    expect(service.getSuggestion('short-break', mode('wellness', 'exercise'), [])).toBeNull();
  });

  function createService(): WellnessBreakService {
    return new WellnessBreakService(new WellnessExerciseService());
  }

  function mode(id: WorkspaceMode['id'], breakPromptBehavior: WorkspaceMode['breakPromptBehavior']): WorkspaceMode {
    return {
      id,
      label: id,
      description: '',
      focusDurationStrategy: '',
      breakBehavior: '',
      wellnessIntensity: 'medium',
      interruptionFrequency: 'balanced',
      breakPromptBehavior,
      timerCue: '',
    };
  }
});
