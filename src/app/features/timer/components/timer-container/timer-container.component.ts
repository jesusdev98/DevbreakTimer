import { Component, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TimerService, TimerStatus } from '../../services/timer.service';

@Component({
  selector: 'app-timer-container',
  standalone: false,
  templateUrl: './timer-container.component.html',
  styleUrls: ['./timer-container.component.scss'],
})
export class TimerContainerComponent implements OnDestroy {
  public readonly remainingTime$: Observable<number>;
  public readonly status$: Observable<TimerStatus>;
  public currentStatus: TimerStatus = 'idle';
  public durationInMinutes = 5;
  public currentExercise: string | null = null;
  public progress = 0;

  private readonly destroy$ = new Subject<void>();
  private lastStatus: TimerStatus | null = null;
  private initialDuration = 0;
  private exercises: string[] = [
    '10 burpees',
    '15 squats',
    '30s plank',
    '20 jumping jacks',
    'stretch your back',
    'walk for 1 minute'
  ];

  public constructor(private readonly timerService: TimerService) {
    this.remainingTime$ = this.timerService.remainingTime$;
    this.status$ = this.timerService.status$;

    this.remainingTime$
      .pipe(
        takeUntil(this.destroy$),
      )
      .subscribe((remainingTime: number): void => {
        if (this.initialDuration === 0 && remainingTime > 0) {
          this.initialDuration = remainingTime;
        }

        const nextProgress = this.initialDuration > 0
          ? (remainingTime / this.initialDuration) * 100
          : 0;

        this.progress = Math.min(100, Math.max(0, nextProgress));
        this.progress = Math.max(0, Math.min(100, this.progress));
      });

    this.status$
      .pipe(
        takeUntil(this.destroy$),
      )
      .subscribe((status: TimerStatus): void => {
        this.currentStatus = status;

        if (status === 'completed' && this.lastStatus !== 'completed') {
          this.currentExercise = this.getRandomExercise();
          this.triggerCompletionEffects();
        }

        this.lastStatus = status;
      });
  }

  public start(): void {
    if (this.currentStatus === 'running') {
      return;
    }

    if (this.currentStatus === 'paused') {
      this.timerService.start();
      return;
    }

    const durationInSeconds = Math.max(0, Math.floor(this.durationInMinutes * 60));
    this.initialDuration = durationInSeconds;
    this.durationInMinutes = this.initialDuration / 60;

    this.timerService.start(durationInSeconds);
  }

  public pause(): void {
    this.timerService.pause();
  }

  public reset(): void {
    this.timerService.reset();
    this.currentExercise = null;
    this.durationInMinutes = this.initialDuration / 60;
  }

  public formatTime(seconds: number | null): string {
    const safeSeconds = Math.max(0, seconds ?? 0);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;

    if (safeSeconds < 3600) {
      const totalMinutes = Math.floor(safeSeconds / 60);

      return `${totalMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private triggerCompletionEffects(): void {
    this.sendNotification();
    this.playSound();
  }

  private getRandomExercise(): string {
    const index = Math.floor(Math.random() * this.exercises.length);
    return this.exercises[index];
  }

  private sendNotification(): void {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      this.createNotification();
      return;
    }

    if (Notification.permission !== 'denied') {
      Notification.requestPermission()
        .then((permission: NotificationPermission): void => {
          if (permission === 'granted') {
            this.createNotification();
          }
        })
        .catch((): void => {
          return;
        });
    }
  }

  private createNotification(): void {
    new Notification("Time's up!", {
      body: "Take a break \uD83D\uDCAA",
    });
  }

  private playSound(): void {
    const audio = new Audio('assets/beep.mp3');

    void audio.play().catch((): void => {
      return;
    });
  }
}
