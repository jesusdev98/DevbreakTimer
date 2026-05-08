import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  public setTheme = vi.fn();
  public setPomodoroProfile = vi.fn();
  public setCustomPomodoroProfile = vi.fn();
  public acknowledgeCompletionEvent = vi.fn();
}

describe('TimerContainerComponent', () => {
  let component: TimerContainerComponent;
  let fixture: ComponentFixture<TimerContainerComponent>;
  let timerService: MockTimerService;

  beforeEach(async () => {
    timerService = new MockTimerService();

    await TestBed.configureTestingModule({
      declarations: [
        TimerContainerComponent,
        TimerActionToolbarComponent,
        TimerSettingsPanelComponent,
        WellnessBreakCardComponent,
        WellnessInsightsCardComponent,
        WellnessReminderCardComponent,
      ],
      imports: [FormsModule],
      providers: [
        {
          provide: TimerService,
          useValue: timerService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TimerContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
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

  it('renders session information when Pomodoro mode is enabled', () => {
    timerService.pomodoroStateSubject.next({
      enabled: true,
      currentSession: 'short-break',
      completedFocusSessions: 1,
      cycle: 2,
    });
    fixture.detectChanges();

    expect(query('session-title').textContent).toContain('Short Break');
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
});
