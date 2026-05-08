export type WorkspaceModeId = 'focus' | 'pomodoro' | 'wellness' | 'hybrid';

export type WellnessIntensity = 'low' | 'medium' | 'high';
export type InterruptionFrequency = 'minimal' | 'structured' | 'active' | 'balanced';
export type BreakPromptBehavior = 'none' | 'reminder' | 'exercise';

export interface WorkspaceMode {
  id: WorkspaceModeId;
  label: string;
  description: string;
  focusDurationStrategy: string;
  breakBehavior: string;
  wellnessIntensity: WellnessIntensity;
  interruptionFrequency: InterruptionFrequency;
  breakPromptBehavior: BreakPromptBehavior;
  timerCue: string;
}
