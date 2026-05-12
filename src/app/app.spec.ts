import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { App } from './app';
import { AppModule } from './app.module';
import { describe, beforeEach, expect, it } from 'vitest';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppModule
      ],
      providers: [
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    flushTranslations();
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the timer container', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushTranslations();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-timer-container')).not.toBeNull();
  });

  function flushTranslations(): void {
    const http = TestBed.inject(HttpTestingController);
    const requests = http.match('assets/i18n/en.json');

    requests.forEach((request) => request.flush({}));
  }
});
