const now = 1_700_000_000_000;
const tasksKey = 'devbreak-kanban-tasks';
const timerKey = 'devbreak-timer-state';
const workspaceModeKey = 'devbreak-workspace-mode';

describe('Focus workflow', () => {
  beforeEach(() => {
    cy.clock(now, ['Date', 'setInterval', 'clearInterval']);
    cy.viewport(1200, 800);
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem(workspaceModeKey, 'focus');
        win.localStorage.setItem(tasksKey, JSON.stringify([createTask()]));
        win.localStorage.setItem(timerKey, JSON.stringify(createIdleTimerState()));
      },
    });
  });

  it('selects a focus task and supports start, pause, resume, reset, and completion', () => {
    cy.contains('[data-testid="task-card"]', 'Focus reliability pass').within(() => {
      cy.contains('button', 'Focus').click();
    });

    cy.contains('.focus-panel', 'Focus reliability pass').should('be.visible');

    cy.getByTestId('start-button').click();
    cy.tick(1_000);
    cy.getByTestId('timer-status').should('contain.text', 'running');
    cy.getByTestId('timer-display').should('contain.text', '00:59');

    cy.getByTestId('pause-button').click();
    cy.getByTestId('timer-status').should('contain.text', 'paused');

    cy.getByTestId('start-button').click();
    cy.getByTestId('timer-status').should('contain.text', 'running');

    cy.getByTestId('reset-button').click();
    cy.getByTestId('timer-status').should('contain.text', 'idle');
    cy.getByTestId('timer-display').should('contain.text', '01:00');

    cy.getByTestId('start-button').click();
    cy.tick(60_000);

    cy.getByTestId('timer-status').should('contain.text', 'completed');
    cy.contains('.focus-completion', 'Focus Session Completed').should('be.visible');
    cy.contains('.focus-completion', 'Focus reliability pass').should('be.visible');
  });
});

function createTask() {
  return {
    id: 'task-focus-e2e',
    title: 'Focus reliability pass',
    description: 'Validate focus ownership flow',
    status: 'todo',
    createdAt: now,
    archived: false,
  };
}

function createIdleTimerState() {
  return {
    targetEndTimestamp: null,
    remainingTime: 60,
    initialDuration: 60,
    status: 'idle',
    settings: {
      selectedDuration: 60,
      durations: {
        focus: 60,
        'short-break': 300,
        'long-break': 900,
      },
      cyclesBeforeLongBreak: 4,
      soundEnabled: false,
      theme: 'dark',
      pomodoroProfileId: 'custom',
      customPomodoroProfile: {
        id: 'custom',
        name: 'Custom',
        description: 'E2E durations',
        durations: {
          focus: 60,
          'short-break': 300,
          'long-break': 900,
        },
        cyclesBeforeLongBreak: 4,
      },
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

export {};
