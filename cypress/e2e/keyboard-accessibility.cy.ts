const now = 1_700_000_000_000;
const tasksKey = 'devbreak-kanban-tasks';
const timerKey = 'devbreak-timer-state';
const workspaceModeKey = 'devbreak-workspace-mode';

describe('Keyboard and accessibility workflows', () => {
  beforeEach(() => {
    cy.viewport(1200, 800);
  });

  it('keeps primary controls keyboard reachable with Enter and Space activation', () => {
    cy.clock(now, ['Date', 'setInterval', 'clearInterval']);
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem(tasksKey, '[]');
        win.localStorage.setItem(timerKey, JSON.stringify(createIdleTimerState()));
      },
    });

    cy.press(Cypress.Keyboard.Keys.TAB);
    cy.focused().should('have.attr', 'type', 'search');
    cy.press(Cypress.Keyboard.Keys.TAB);
    cy.focused().should('contain.text', 'Active');

    cy.contains('label', 'New Task').find('input').focus().type('Keyboard task');
    cy.contains('button', 'Add Task').focus();
    cy.focused().type('{enter}');
    cy.getByTestId('kanban-column-ideas').should('contain.text', 'Keyboard task');

    cy.get('.kanban-density').contains('button', 'Focus').focus();
    cy.press(Cypress.Keyboard.Keys.SPACE);
    cy.get('.kanban-density')
      .contains('button', 'Focus')
      .should('have.attr', 'aria-pressed', 'true');

    cy.getByTestId('start-button').focus();
    cy.focused().type('{enter}');
    cy.getByTestId('timer-status').should('contain.text', 'running');
  });

  it('restores focus after settings, quick-add, and task edit cancellation', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem(tasksKey, JSON.stringify([createTask()]));
      },
    });

    cy.getByTestId('settings-button').click();
    cy.get('body').type('{esc}');
    cy.focused().should('have.attr', 'data-testid', 'settings-button');

    cy.getByTestId('kanban-column-todo').within(() => {
      cy.contains('button', '+ Add task').click();
      cy.get('input[name="quickAddTitle"]').should('be.focused').type('Canceled task');
      cy.focused().type('{esc}');
      cy.focused().should('contain.text', '+ Add task');
    });

    cy.contains('[data-testid="task-card"]', 'Keyboard audit task').within(() => {
      cy.contains('button', 'Edit').click();
    });
    cy.get('input[name="draftTitle"]').should('be.focused');
    cy.focused().type('{esc}');
    cy.focused().should('contain.text', 'Edit');
  });

  it('handles Escape consistently for settings and shortcut capture', () => {
    cy.visit('/');

    cy.getByTestId('settings-button').click();
    cy.get('[aria-label="Edit shortcut for Search"]').click();
    cy.get('[aria-label="Edit shortcut for Search"]').should('contain.text', 'Press keys');

    cy.focused().type('{esc}');
    cy.get('[aria-label="Edit shortcut for Search"]').should('not.contain.text', 'Press keys');
    cy.get('.settings-panel').should('be.visible');

    cy.get('body').type('{esc}');
    cy.get('.settings-panel').should('not.exist');
    cy.focused().should('have.attr', 'data-testid', 'settings-button');
  });

  it('keeps workflows usable with reduced motion enabled', () => {
    cy.clock(now, ['Date', 'setInterval', 'clearInterval']);
    cy.visit('/', {
      onBeforeLoad(win) {
        stubReducedMotion(win);
        win.localStorage.setItem(tasksKey, '[]');
        win.localStorage.setItem(timerKey, JSON.stringify(createIdleTimerState()));
      },
    });

    cy.contains('label', 'New Task').find('input').type('Reduced motion task');
    cy.contains('button', 'Add Task').click();
    cy.getByTestId('kanban-column-ideas').should('contain.text', 'Reduced motion task');

    cy.get('.kanban-density').contains('button', 'Compact').click();
    cy.get('.kanban-density')
      .contains('button', 'Compact')
      .should('have.attr', 'aria-pressed', 'true');

    cy.getByTestId('start-button').click();
    cy.tick(1_000);
    cy.getByTestId('timer-status').should('contain.text', 'running');
  });
});

function createTask() {
  return {
    id: 'task-keyboard-e2e',
    title: 'Keyboard audit task',
    description: 'Validate focus restoration',
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

function stubReducedMotion(win: Window): void {
  cy.stub(win, 'matchMedia')
    .callsFake((query: string): MediaQueryList => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: cy.stub(),
      removeListener: cy.stub(),
      addEventListener: cy.stub(),
      removeEventListener: cy.stub(),
      dispatchEvent: cy.stub(),
    }));
}

export {};
