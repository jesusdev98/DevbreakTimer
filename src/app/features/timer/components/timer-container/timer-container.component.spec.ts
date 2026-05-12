import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PomodoroState,
  TimerCompletionEvent,
  TimerService,
  TimerSettings,
  TimerStatus,
} from '../../services/timer.service';
import { TimerActionToolbarComponent } from '../timer-action-toolbar/timer-action-toolbar.component';
import { TimerSettingsPanelComponent } from '../timer-settings-panel/timer-settings-panel.component';
import { WellnessBreakCardComponent } from '../wellness-break-card/wellness-break-card.component';
import { WellnessInsightsCardComponent } from '../wellness-insights-card/wellness-insights-card.component';
import { WellnessReminderCardComponent } from '../wellness-reminder-card/wellness-reminder-card.component';
import { TimerContainerComponent } from './timer-container.component';
import { LanguageService } from '../../../../services/language.service';
import { WorkspaceModeService } from '../../../../services/workspace-mode.service';

class MockTimerService {
  public readonly remainingTimeSubject = new BehaviorSubject<number>(25 * 60);
  public readonly durationSubject = new BehaviorSubject<number>(25 * 60);
  public readonly statusSubject = new BehaviorSubject<TimerStatus>('idle');
  public readonly settingsSubject = new BehaviorSubject<TimerSettings>({
    selectedDuration: 25 * 60,
    durations: {
      focus: 25 * 60,
      'short-break': 5 * 60,
      'long-break': 15 * 60,
    },
    cyclesBeforeLongBreak: 4,
    soundEnabled: true,
    soundPresetId: 'soft-bell',
    soundVolume: 70,
    completionSoundMode: 'once',
    theme: 'dark',
    pomodoroProfileId: 'classic',
    customPomodoroProfile: {
      id: 'custom',
      name: 'Custom',
      description: 'Your durations',
      durations: {
        focus: 25 * 60,
        'short-break': 5 * 60,
        'long-break': 15 * 60,
      },
      cyclesBeforeLongBreak: 4,
    },
  });
  public readonly pomodoroStateSubject = new BehaviorSubject<PomodoroState>({
    enabled: false,
    currentSession: 'focus',
    completedFocusSessions: 0,
    cycle: 1,
  });
  public readonly completionEventSubject = new BehaviorSubject<TimerCompletionEvent | null>(null);

  public readonly remainingTime$ = this.remainingTimeSubject.asObservable();
  public readonly duration$ = this.durationSubject.asObservable();
  public readonly status$ = this.statusSubject.asObservable();
  public readonly settings$ = this.settingsSubject.asObservable();
  public readonly pomodoroState$ = this.pomodoroStateSubject.asObservable();
  public readonly completionEvent$ = this.completionEventSubject.asObservable();

  public start = vi.fn();
  public pause = vi.fn();
  public reset = vi.fn();
  public setSelectedDuration = vi.fn();
  public setPomodoroEnabled = vi.fn();
  public setSoundEnabled = vi.fn();
  public setSoundPreset = vi.fn();
  public setSoundVolume = vi.fn();
  public setCompletionSoundMode = vi.fn();
  public setTheme = vi.fn();
  public setPomodoroProfile = vi.fn();
  public setCustomPomodoroProfile = vi.fn();
  public acknowledgeCompletionEvent = vi.fn();
}

describe('TimerContainerComponent', () => {
  let component: TimerContainerComponent;
  let fixture: ComponentFixture<TimerContainerComponent>;
  let timerService: MockTimerService;
  let workspaceModeService: WorkspaceModeService;

  beforeEach(async () => {
    localStorage.clear();
    timerService = new MockTimerService();
    const languageService = {
      languages: [
        { code: 'en', label: 'English' },
        { code: 'es', label: 'Español' },
      ],
      getCurrentLanguage: vi.fn(() => 'en'),
      setLanguage: vi.fn(),
      instant: vi.fn((key: string, params?: Record<string, unknown>) => {
        if (key === 'timer.sessions.focus') {
          return 'Focus Session';
        }

        if (key === 'timer.sessions.short-break') {
          return 'Short Break';
        }

        if (key === 'timer.sessions.long-break') {
          return 'Long Break';
        }

        if (key === 'timer.duration.lockedRunning') {
          return 'Locked while the timer is running. Pause or reset to change duration.';
        }

        if (key === 'timer.duration.lockedPomodoro') {
          return 'Pomodoro uses fixed focus and break lengths, so custom duration controls are locked.';
        }

        return params ? `${key} ${JSON.stringify(params)}` : key;
      }),
    };

    await TestBed.configureTestingModule({
      declarations: [
        TimerContainerComponent,
        TimerActionToolbarComponent,
        TimerSettingsPanelComponent,
        WellnessBreakCardComponent,
        WellnessInsightsCardComponent,
        WellnessReminderCardComponent,
      ],
      imports: [FormsModule, TranslateModule.forRoot()],
      providers: [
        {
          provide: TimerService,
          useValue: timerService,
        },
        {
          provide: LanguageService,
          useValue: languageService,
        },
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      timer: {
        cycleMeta: 'Cycle {{ cycle }} / {{ total }} - {{ completed }} focus completed',
      },
      settings: {
        sessionLocked: 'Finish or reset the current session to change mode.',
      },
    }, true);
    translate.use('en');

    fixture = TestBed.createComponent(TimerContainerComponent);
    component = fixture.componentInstance;
    workspaceModeService = TestBed.inject(WorkspaceModeService);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('creates the timer container', () => {
    expect(component).toBeTruthy();
  });

  it('selects quick presets with one click', () => {
    query<HTMLButtonElement>('preset-15').click();
    fixture.detectChanges();

    expect(component.durationInMinutes).toBe(15);
    expect(timerService.setSelectedDuration).toHaveBeenCalledWith(15 * 60);
  });

  it('updates manual duration through the service', async () => {
    const input = query<HTMLInputElement>('duration-input');
    input.value = '45';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(timerService.setSelectedDuration).toHaveBeenCalledWith(45 * 60);
  });

  it('toggles Pomodoro mode through the service', () => {
    query<HTMLInputElement>('pomodoro-toggle').click();
    fixture.detectChanges();

    expect(timerService.setPomodoroEnabled).toHaveBeenCalledWith(true);
  });

  it('toggles sound through the service', () => {
    query<HTMLInputElement>('sound-toggle').click();
    fixture.detectChanges();

    expect(timerService.setSoundEnabled).toHaveBeenCalledWith(false);
  });

  it('applies sound settings immediately from settings', async () => {
    query<HTMLButtonElement>('settings-button').click();
    fixture.detectChanges();
    await fixture.whenStable();

    const volume = fixture.nativeElement.querySelector('input[name="soundVolume"]') as HTMLInputElement;
    volume.value = '35';
    volume.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(timerService.setSoundVolume).toHaveBeenCalledWith(35);
  });

  it('renders session information when Pomodoro mode is enabled', () => {
    timerService.pomodoroStateSubject.next({
      enabled: true,
      currentSession: 'short-break',
      completedFocusSessions: 1,
      cycle: 2,
    });
    fixture.detectChanges();

    expect(query('pomodoro-session-panel').textContent).toContain('Short Break');
    expect(query('session-meta').textContent).toContain('Cycle 2 / 4');
    expect(query('session-meta').textContent).toContain('1 focus completed');
  });

  it('disables duration controls while running', async () => {
    timerService.statusSubject.next('running');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query<HTMLInputElement>('duration-input').disabled).toBe(true);
    expect(query<HTMLInputElement>('pomodoro-toggle').disabled).toBe(true);
    expect(query<HTMLButtonElement>('preset-5').disabled).toBe(true);
    expect(query<HTMLButtonElement>('start-button').disabled).toBe(true);
    expect(query<HTMLButtonElement>('pause-button').disabled).toBe(false);
  });

  it('disables custom duration controls when Pomodoro is enabled', async () => {
    timerService.pomodoroStateSubject.next({
      enabled: true,
      currentSession: 'focus',
      completedFocusSessions: 0,
      cycle: 1,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query<HTMLInputElement>('duration-input').disabled).toBe(true);
    expect(query<HTMLButtonElement>('preset-25').disabled).toBe(true);
  });

  it('locks session-critical settings only while the timer is running or paused', async () => {
    query<HTMLButtonElement>('settings-button').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expectSessionCriticalSettingsLocked(false);

    timerService.statusSubject.next('running');
    fixture.detectChanges();
    await fixture.whenStable();

    expectSessionCriticalSettingsLocked(true);

    timerService.statusSubject.next('paused');
    fixture.detectChanges();
    await fixture.whenStable();

    expectSessionCriticalSettingsLocked(true);

    timerService.statusSubject.next('completed');
    fixture.detectChanges();
    await fixture.whenStable();

    expectSessionCriticalSettingsLocked(false);
  });

  it('shows wellness exercise suggestions after completed wellness and hybrid sessions', () => {
    workspaceModeService.setMode('wellness');
    emitFocusCompletion(1);

    expect(component.wellnessSuggestion).toEqual(expect.objectContaining({
      duration: expect.any(Number),
    }));

    component.wellnessSuggestion = null;
    workspaceModeService.setMode('hybrid');
    emitFocusCompletion(2);

    expect(component.wellnessSuggestion).toEqual(expect.objectContaining({
      duration: expect.any(Number),
    }));
  });

  it('does not show wellness exercise suggestions after focus or pomodoro sessions', () => {
    workspaceModeService.setMode('focus');
    emitFocusCompletion(3);

    expect(component.wellnessSuggestion).toBeNull();

    workspaceModeService.setMode('pomodoro');
    emitFocusCompletion(4);

    expect(component.wellnessSuggestion).toBeNull();
  });

  it('syncs reset skipped sessions into recovery rhythm metrics once', () => {
    component.start();
    component.reset();
    component.reset();

    let metrics = {
      completedActions: -1,
      dismissedReminders: -1,
      recoveryCompletionPercentage: -1,
      recoveryStreakDays: -1,
      weeklyConsistencyDays: -1,
      totalInteractions: -1,
    };

    component.wellnessMetrics$.subscribe((nextMetrics) => {
      metrics = nextMetrics;
    }).unsubscribe();

    expect(metrics.completedActions).toBe(0);
    expect(metrics.dismissedReminders).toBe(1);
    expect(metrics.totalInteractions).toBe(1);
  });

  function query<T extends HTMLElement = HTMLElement>(testId: string): T {
    const element = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as T | null;

    if (element === null) {
      throw new Error(`Missing test element: ${testId}`);
    }

    return element;
  }

  function expectSessionCriticalSettingsLocked(locked: boolean): void {
    const workspaceMode = fixture.nativeElement.querySelector(
      'input[name="workspaceMode"]',
    ) as HTMLInputElement;
    const profile = fixture.nativeElement.querySelector(
      'select[name="pomodoroProfile"]',
    ) as HTMLSelectElement;
    const theme = fixture.nativeElement.querySelector('input[name="theme"]') as HTMLInputElement;
    const sound = fixture.nativeElement.querySelector(
      'input[name="settingsSound"]',
    ) as HTMLInputElement;

    expect(workspaceMode.disabled).toBe(locked);
    expect(profile.disabled).toBe(locked);
    expect(theme.disabled).toBe(false);
    expect(sound.disabled).toBe(false);

    if (locked) {
      expect(fixture.nativeElement.textContent).toContain(
        'Finish or reset the current session to change mode.',
      );
      return;
    }

    expect(fixture.nativeElement.textContent).not.toContain(
      'Finish or reset the current session to change mode.',
    );
  }

  function emitFocusCompletion(id: number): void {
    timerService.completionEventSubject.next({
      id,
      completedAt: Date.now(),
      sessionType: 'focus',
      nextSessionType: null,
      pomodoroEnabled: false,
    });
  }
});
