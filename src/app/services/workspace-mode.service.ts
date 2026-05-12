import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { WorkspaceMode, WorkspaceModeId } from '../models/workspace-mode.model';

const STORAGE_KEY = 'devbreak-workspace-mode';
const DEFAULT_MODE_ID: WorkspaceModeId = 'hybrid';

const WORKSPACE_MODES: readonly WorkspaceMode[] = [
  {
    id: 'focus',
    label: 'Focus',
    description: 'Deep work with fewer interruptions and task-first flow.',
    focusDurationStrategy: 'Longer uninterrupted sessions',
    breakBehavior: 'Quiet recovery breaks',
    wellnessIntensity: 'low',
    interruptionFrequency: 'minimal',
    breakPromptBehavior: 'none',
    timerCue: 'Deep work with minimal interruptions.',
  },
  {
    id: 'pomodoro',
    label: 'Pomodoro',
    description: 'Classic structured work and break cycles.',
    focusDurationStrategy: 'Standard Pomodoro cadence',
    breakBehavior: 'Predictable short and long breaks',
    wellnessIntensity: 'medium',
    interruptionFrequency: 'structured',
    breakPromptBehavior: 'reminder',
    timerCue: 'Structured work/break rhythm.',
  },
  {
    id: 'wellness',
    label: 'Wellness',
    description: 'Movement-forward sessions for healthier desk work.',
    focusDurationStrategy: 'Sustainable focus blocks',
    breakBehavior: 'More active posture and mobility prompts',
    wellnessIntensity: 'high',
    interruptionFrequency: 'active',
    breakPromptBehavior: 'exercise',
    timerCue: 'Movement and recovery stay visible.',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    description: 'Balanced productivity with active wellness breaks.',
    focusDurationStrategy: 'Focused work with wellness support',
    breakBehavior: 'Active breaks without overwhelming flow',
    wellnessIntensity: 'medium',
    interruptionFrequency: 'balanced',
    breakPromptBehavior: 'exercise',
    timerCue: 'Focus plus active breaks, the FocusFlow rhythm.',
  },
];

@Injectable({
  providedIn: 'root',
})
export class WorkspaceModeService {
  readonly modes = WORKSPACE_MODES;

  private selectedMode = this.resolveMode(this.restoreModeId());
  private readonly selectedModeSubject = new BehaviorSubject<WorkspaceMode>(this.selectedMode);

  readonly selectedMode$: Observable<WorkspaceMode> = this.selectedModeSubject.asObservable();

  getSelectedMode(): WorkspaceMode {
    return this.selectedMode;
  }

  setMode(modeId: WorkspaceModeId): void {
    this.selectedMode = this.resolveMode(modeId);
    this.persistModeId(this.selectedMode.id);
    this.selectedModeSubject.next(this.selectedMode);
  }

  private resolveMode(modeId: string | null): WorkspaceMode {
    return WORKSPACE_MODES.find((mode) => mode.id === modeId) ?? WORKSPACE_MODES[3];
  }

  private restoreModeId(): string | null {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return DEFAULT_MODE_ID;
    }
  }

  private persistModeId(modeId: WorkspaceModeId): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, modeId);
    } catch {
      // Mode selection remains available in memory if storage is unavailable.
    }
  }
}
