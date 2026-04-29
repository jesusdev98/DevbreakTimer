import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, interval } from 'rxjs';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

type TimerState = {
  remainingTime: number;
  initialDuration: number;
  status: TimerStatus;
};

@Injectable({
  providedIn: 'root',
})
export class TimerService implements OnDestroy {
  private static readonly STORAGE_KEY = 'devbreak-timer-state';

  private readonly remainingTimeSubject = new BehaviorSubject<number>(0);
  private readonly statusSubject = new BehaviorSubject<TimerStatus>('idle');
  private readonly completedSubject = new BehaviorSubject<boolean>(false);

  private timerSubscription: Subscription | null = null;
  private remainingTime = 0;
  private initialDuration = 0;
  private status: TimerStatus = 'idle';

  public readonly remainingTime$: Observable<number> = this.remainingTimeSubject.asObservable();
  public readonly status$: Observable<TimerStatus> = this.statusSubject.asObservable();
  public readonly completed$: Observable<boolean> = this.completedSubject.asObservable();

  public constructor() {
    this.loadState();
  }

  public start(duration?: number): void {
    if (duration !== undefined) {
      this.assertValidDuration(duration);
      this.clearTimerSubscription();
      this.initialDuration = duration;
      this.remainingTime = duration;
      this.remainingTimeSubject.next(this.remainingTime);
    } else {
      if (this.status === 'running') {
        return;
      }

      if (this.status !== 'paused') {
        return;
      }

      if (this.remainingTime <= 0) {
        return;
      }
    }

    if (this.remainingTime <= 0) {
      return;
    }

    if (this.timerSubscription !== null) {
      return;
    }

    this.setStatus('running');
    this.saveState();

    this.timerSubscription = interval(1000).subscribe((): void => {
      this.remainingTime -= 1;

      if (this.remainingTime <= 0) {
        this.remainingTime = 0;
        this.remainingTimeSubject.next(this.remainingTime);
        this.setStatus('completed');
        this.saveState();
        this.clearTimerSubscription();
        return;
      }

      this.remainingTimeSubject.next(this.remainingTime);
    });
  }

  public pause(): void {
    if (this.remainingTime <= 0 || this.status === 'paused') {
      return;
    }

    this.clearTimerSubscription();
    this.setStatus('paused');
    this.saveState();
  }

  public reset(): void {
    this.clearTimerSubscription();
    this.remainingTime = this.initialDuration;
    this.remainingTimeSubject.next(this.remainingTime);
    this.setStatus('idle');
    this.saveState();
  }

  public ngOnDestroy(): void {
    this.clearTimerSubscription();
    this.remainingTimeSubject.complete();
    this.statusSubject.complete();
    this.completedSubject.complete();
  }

  private clearTimerSubscription(): void {
    if (this.timerSubscription === null) {
      return;
    }

    this.timerSubscription.unsubscribe();
    this.timerSubscription = null;
  }

  private assertValidDuration(duration: number): void {
    if (!Number.isInteger(duration) || duration <= 0) {
      throw new Error('Timer duration must be a positive integer.');
    }
  }

  private saveState(): void {
    const state: TimerState = {
      remainingTime: this.remainingTime,
      initialDuration: this.initialDuration,
      status: this.status,
    };

    try {
      localStorage.setItem(TimerService.STORAGE_KEY, JSON.stringify(state));
    } catch {
      return;
    }
  }

  private loadState(): void {
    let rawState: string | null = null;

    try {
      rawState = localStorage.getItem(TimerService.STORAGE_KEY);
    } catch {
      this.applyInitialState();
      return;
    }

    if (rawState === null) {
      return;
    }

    try {
      const parsedState: unknown = JSON.parse(rawState);

      if (!this.isValidState(parsedState)) {
        this.applyInitialState();
        return;
      }

      this.applyInitialState();
    } catch {
      this.applyInitialState();
    }
  }

  private applyInitialState(): void {
    this.clearTimerSubscription();
    this.initialDuration = 0;
    this.remainingTime = 0;
    this.remainingTimeSubject.next(0);
    this.setStatus('idle');
    this.saveState();
  }

  private isValidState(value: unknown): value is TimerState {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<TimerState>;

     if (
      typeof candidate.remainingTime !== 'number' ||
      typeof candidate.initialDuration !== 'number'
    ) {
      return false;
    }

    if (!this.isValidStatus(candidate.status)) {
      return false;
    }

    return (
      Number.isInteger(candidate.remainingTime) &&
      candidate.remainingTime >= 0 &&
      Number.isInteger(candidate.initialDuration) &&
      candidate.initialDuration >= 0 &&
      candidate.remainingTime <= candidate.initialDuration &&
      this.isConsistentState(candidate.remainingTime, candidate.initialDuration, candidate.status)
    );
  }

  private isValidStatus(status: unknown): status is TimerStatus {
    return status === 'idle' || status === 'running' || status === 'paused' || status === 'completed';
  }

  private isConsistentState(
    remainingTime: number,
    initialDuration: number,
    status: TimerStatus,
  ): boolean {
    if (status === 'idle') {
      return remainingTime === 0 && initialDuration === 0;
    }

    if (status === 'completed') {
      return initialDuration > 0 && remainingTime === 0;
    }

    return initialDuration > 0 && remainingTime > 0;
  }

  private setStatus(status: TimerStatus): void {
    this.status = status;
    this.completedSubject.next(status === 'completed');
    this.statusSubject.next(status);
  }
}
