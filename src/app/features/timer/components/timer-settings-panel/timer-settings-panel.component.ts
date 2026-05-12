import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

import {
  ShortcutActionId,
  ShortcutDefinition,
} from '../../../../services/shortcut.service';
import { LanguageCode, LanguageOption } from '../../../../services/language.service';
import { WorkspaceMode, WorkspaceModeId } from '../../../../models/workspace-mode.model';
import { WellnessCategory, WellnessExercise } from '../../models/wellness-break.model';
import { WellnessCategoryOption } from '../../services/wellness-preferences.service';
import {
  WellnessReminderPreferences,
  WellnessReminderType,
} from '../../services/wellness-reminder-engine.service';
import {
  CompletionSoundMode,
  PomodoroProfile,
  PomodoroProfileId,
  SoundPresetId,
  ThemeMode,
} from '../../services/timer.service';

export type SettingsDraft = {
  theme: ThemeMode;
  profileId: PomodoroProfileId;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
  soundEnabled: boolean;
  soundPresetId: SoundPresetId;
  soundVolume: number;
  completionSoundMode: CompletionSoundMode;
  language: LanguageCode;
  workspaceModeId: WorkspaceModeId;
  wellnessCategories: WellnessCategory[];
};

@Component({
  selector: 'app-timer-settings-panel',
  standalone: false,
  templateUrl: './timer-settings-panel.component.html',
})
export class TimerSettingsPanelComponent {
  protected readonly soundPresetOptions: readonly { id: SoundPresetId; label: string; description: string }[] = [
    { id: 'soft-bell', label: 'Soft Bell', description: 'Warm and gentle' },
    { id: 'digital', label: 'Digital', description: 'Clean timer chirp' },
    { id: 'minimal', label: 'Minimal', description: 'Subtle single tone' },
    { id: 'retro', label: 'Retro', description: 'Classic arcade pulse' },
    { id: 'alarm', label: 'Alarm', description: 'Most noticeable' },
  ];
  protected readonly completionSoundModeOptions: readonly { id: CompletionSoundMode; label: string }[] = [
    { id: 'once', label: 'Play Once' },
    { id: 'repeat', label: 'Repeat Until Dismissed' },
  ];

  @Input({ required: true }) settingsDraft!: SettingsDraft;
  @Input({ required: true }) workspaceModes: readonly WorkspaceMode[] = [];
  @Input({ required: true }) wellnessCategoryOptions: readonly WellnessCategoryOption[] = [];
  @Input({ required: true }) pomodoroProfiles: readonly PomodoroProfile[] = [];
  @Input({ required: true }) languageOptions: readonly LanguageOption[] = [];
  @Input({ required: true }) wellnessExercises: WellnessExercise[] = [];
  @Input({ required: true }) wellnessReminderPreferences!: WellnessReminderPreferences;
  @Input() sessionSettingsLocked = false;
  @Input() shortcuts: ShortcutDefinition[] = [];
  @Input() editingShortcutAction: ShortcutActionId | null = null;
  @Input() shortcutValidationMessage: string | null = null;

  @Output() closeSettings = new EventEmitter<void>();
  @Output() saveSettings = new EventEmitter<void>();
  @Output() settingsKeydown = new EventEmitter<KeyboardEvent>();
  @Output() profileSelected = new EventEmitter<PomodoroProfileId>();
  @Output() wellnessCategoryToggled = new EventEmitter<WellnessCategory>();
  @Output() wellnessRemindersEnabledChanged = new EventEmitter<boolean>();
  @Output() wellnessReminderTypeEnabledChanged = new EventEmitter<{
    type: WellnessReminderType;
    enabled: boolean;
  }>();
  @Output() soundSettingsChanged = new EventEmitter<void>();
  @Output() languageChanged = new EventEmitter<LanguageCode>();
  @Output() exerciseAdded = new EventEmitter<Pick<WellnessExercise, 'name' | 'category' | 'duration'>>();
  @Output() exerciseUpdated = new EventEmitter<{
    id: string;
    exercise: Pick<WellnessExercise, 'name' | 'category' | 'duration'>;
  }>();
  @Output() exerciseDeleted = new EventEmitter<string>();
  @Output() resetShortcuts = new EventEmitter<void>();
  @Output() shortcutCaptureStarted = new EventEmitter<ShortcutActionId>();
  @Output() shortcutCaptured = new EventEmitter<{
    event: KeyboardEvent;
    action: ShortcutActionId;
  }>();

  @ViewChild('settingsPanel') private settingsPanel?: ElementRef<HTMLElement>;
  @ViewChild('settingsCloseButton') private settingsCloseButton?: ElementRef<HTMLButtonElement>;

  protected readonly wellnessExerciseLimit = 5;
  protected exerciseDraft: Pick<WellnessExercise, 'name' | 'category' | 'duration'> = {
    name: '',
    category: 'stretching',
    duration: 45,
  };
  protected editingExerciseId: string | null = null;

  ngAfterViewInit(): void {
    window.setTimeout(() => this.settingsCloseButton?.nativeElement.focus());
  }

  protected handleDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      this.trapFocus(event);
      return;
    }

    this.settingsKeydown.emit(event);
  }

  protected showWellnessPreferences(modeId: WorkspaceModeId = this.settingsDraft.workspaceModeId): boolean {
    return modeId === 'wellness' || modeId === 'hybrid';
  }

  protected isWellnessCategorySelected(category: WellnessCategory): boolean {
    return this.settingsDraft.wellnessCategories.includes(category);
  }

  protected exercisesForCategory(category: WellnessCategory): WellnessExercise[] {
    return this.wellnessExercises.filter((exercise) => exercise.category === category);
  }

  protected canAddExerciseToDraftCategory(): boolean {
    return this.categoryCount(this.exerciseDraft.category, this.editingExerciseId) < this.wellnessExerciseLimit;
  }

  protected isExerciseDraftValid(): boolean {
    return this.exerciseDraft.name.trim().length > 0 && this.exerciseDraft.duration >= 10 && this.canAddExerciseToDraftCategory();
  }

  protected startExerciseEdit(exercise: WellnessExercise): void {
    this.editingExerciseId = exercise.id;
    this.exerciseDraft = {
      name: this.exerciseName(exercise),
      category: exercise.category,
      duration: exercise.duration,
    };
  }

  protected cancelExerciseEdit(): void {
    this.editingExerciseId = null;
    this.exerciseDraft = {
      name: '',
      category: this.exerciseDraft.category,
      duration: 45,
    };
  }

  protected submitExercise(): void {
    if (!this.isExerciseDraftValid()) {
      return;
    }

    const exercise = {
      name: this.exerciseDraft.name.trim(),
      category: this.exerciseDraft.category,
      duration: Number(this.exerciseDraft.duration),
    };

    if (this.editingExerciseId === null) {
      this.exerciseAdded.emit(exercise);
    } else {
      this.exerciseUpdated.emit({
        id: this.editingExerciseId,
        exercise,
      });
    }

    this.cancelExerciseEdit();
  }

  protected deleteExercise(id: string): void {
    if (this.editingExerciseId === id) {
      this.cancelExerciseEdit();
    }

    this.exerciseDeleted.emit(id);
  }

  protected exerciseName(exercise: WellnessExercise): string {
    return exercise.name;
  }

  protected emitSoundSettingsChanged(): void {
    this.soundSettingsChanged.emit();
  }

  protected formatShortcut(combo: string): string {
    return combo
      .split('+')
      .map((part) => part.replace('Control', 'Ctrl').replace('Meta', 'Cmd').replace('Escape', 'Esc'))
      .join(' + ');
  }

  private categoryCount(category: WellnessCategory, excludingId: string | null = null): number {
    return this.wellnessExercises.filter((exercise) =>
      exercise.category === category && exercise.id !== excludingId
    ).length;
  }

  private trapFocus(event: KeyboardEvent): void {
    const focusableElements = this.getFocusableElements();

    if (!focusableElements.length) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  private getFocusableElements(): HTMLElement[] {
    const panel = this.settingsPanel?.nativeElement;

    if (!panel) {
      return [];
    }

    return Array.from(panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
  }
}
