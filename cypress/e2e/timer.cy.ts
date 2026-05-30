const storageKey = 'devbreak-timer-state';
const now = 1_700_000_000_000;

describe('DevBreak Timer', () => {
  beforeEach(() => {
    cy.clock(now, ['Date', 'setInterval', 'clearInterval']);
  });

  it('starts the countdown without real-time waits', () => {
    cy.visit('/');

    cy.getByTestId('start-button').click();
    cy.tick(1_000);

    cy.getByTestId('timer-status').should('contain.text', 'Running');
    cy.getByTestId('timer-display').should('contain.text', '24:59');
  });

  it('restores persisted timer state after reload', () => {
    cy.visit('/');

    cy.getByTestId('preset-5').click();
    cy.getByTestId('start-button').click();
    cy.tick(2_000);
    cy.reload();
    cy.tick(2_000);

    cy.getByTestId('timer-status').should('contain.text', 'Running');
    cy.getByTestId('timer-display').should('contain.text', '04:58');
  });

  it('advances a restored Pomodoro focus session into a short break', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        installNotificationMock(win);
        win.localStorage.setItem(storageKey, JSON.stringify(createPomodoroState(now + 1_000)));
      },
    });

    cy.tick(1_000);
    cy.window().then((win) => win.dispatchEvent(new Event('focus')));

    cy.getByTestId('pomodoro-session-panel')
      .should('contain.text', 'Current')
      .and('contain.text', 'Short Break');
    cy.getByTestId('session-meta').should('contain.text', 'Cycle 2 / 4');
    cy.getByTestId('timer-status').should('contain.text', 'Running');
    cy.get('@notification').should('have.been.calledOnce');
  });

  it('keeps controls usable at narrow mobile widths without horizontal scrolling', () => {
    cy.viewport(320, 568);
    cy.visit('/');

    cy.getByTestId('pomodoro-toggle').click({ force: true });
    cy.getByTestId('pomodoro-session-panel')
      .should('contain.text', 'Current')
      .and('contain.text', 'Focus Session');
    cy.document().its('documentElement.scrollWidth').should('be.lte', 320);
  });

  it('handles denied notification permission without blocking completion', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        installNotificationMock(win, 'denied');
        win.localStorage.setItem(storageKey, JSON.stringify(createManualTimerState(now + 1_000)));
      },
    });

    cy.tick(1_000);
    cy.window().then((win) => win.dispatchEvent(new Event('focus')));

    cy.getByTestId('timer-status').should('contain.text', 'Done');
    cy.get('@notification').should('not.have.been.called');
  });
});

function createManualTimerState(targetEndTimestamp: number) {
  return {
    targetEndTimestamp,
    remainingTime: 1,
    initialDuration: 1,
    status: 'running',
    settings: {
      selectedDuration: 25 * 60,
      durations: {
        focus: 25 * 60,
        'short-break': 5 * 60,
        'long-break': 15 * 60,
      },
      soundEnabled: false,
    },
    pomodoro: {
      enabled: false,
      currentSession: 'focus',
      completedFocusSessions: 0,
      cycle: 1,
    },
    lastCompletionEvent: null,
  };
}

function createPomodoroState(targetEndTimestamp: number) {
  return {
    ...createManualTimerState(targetEndTimestamp),
    settings: {
      selectedDuration: 25 * 60,
      durations: {
        focus: 1,
        'short-break': 1,
        'long-break': 1,
      },
      soundEnabled: false,
    },
    pomodoro: {
      enabled: true,
      currentSession: 'focus',
      completedFocusSessions: 0,
      cycle: 1,
    },
  };
}

function installNotificationMock(win: Window, permission: NotificationPermission = 'granted'): void {
  const notification = cy.stub().as('notification');
  Object.defineProperty(win, 'Notification', {
    configurable: true,
    value: Object.assign(notification, {
      permission,
      requestPermission: cy.stub().resolves(permission),
    }),
  });
}

export {};
