import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

import {
  ShortcutActionId,
  ShortcutDefinition,
} from '../../../../services/shortcut.service';
import { WorkspaceMode, WorkspaceModeId } from '../../../../models/workspace-mode.model';
import { WellnessCategory } from '../../models/wellness-break.model';
import { WellnessCategoryOption } from '../../services/wellness-preferences.service';
import {
  WellnessReminderPreferences,
  WellnessReminderType,
} from '../../services/wellness-reminder-engine.service';
import {
  PomodoroProfile,
  PomodoroProfileId,
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
  workspaceModeId: WorkspaceModeId;
  wellnessCategories: WellnessCategory[];
};

@Component({
  selector: 'app-timer-settings-panel',
  standalone: false,
  templateUrl: './timer-settings-panel.component.html',
})
export class TimerSettingsPanelComponent {
  @Input({ required: true }) settingsDraft!: SettingsDraft;
  @Input({ required: true }) workspaceModes: readonly WorkspaceMode[] = [];
  @Input({ required: true }) wellnessCategoryOptions: readonly WellnessCategoryOption[] = [];
  @Input({ required: true }) pomodoroProfiles: readonly PomodoroProfile[] = [];
  @Input({ required: true }) wellnessReminderPreferences!: WellnessReminderPreferences;
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
  @Output() resetShortcuts = new EventEmitter<void>();
  @Output() shortcutCaptureStarted = new EventEmitter<ShortcutActionId>();
  @Output() shortcutCaptured = new EventEmitter<{
    event: KeyboardEvent;
    action: ShortcutActionId;
  }>();

  @ViewChild('settingsCloseButton') private settingsCloseButton?: ElementRef<HTMLButtonElement>;

  ngAfterViewInit(): void {
    window.setTimeout(() => this.settingsCloseButton?.nativeElement.focus());
  }

  protected showWellnessPreferences(modeId: WorkspaceModeId = this.settingsDraft.workspaceModeId): boolean {
    return modeId === 'wellness' || modeId === 'hybrid';
  }

  protected isWellnessCategorySelected(category: WellnessCategory): boolean {
    return this.settingsDraft.wellnessCategories.includes(category);
  }

  protected formatShortcut(combo: string): string {
    return combo
      .split('+')
      .map((part) => part.replace('Control', 'Ctrl').replace('Meta', 'Cmd').replace('Escape', 'Esc'))
      .join(' + ');
  }
}
