const now = 1_700_000_000_000;
const tasksKey = 'devbreak-kanban-tasks';

describe('Persistence restore workflow', () => {
  beforeEach(() => {
    cy.viewport(1200, 800);
  });

  it('restores created tasks after reload', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem(tasksKey, '[]');
      },
    });

    cy.contains('label', 'New Task').find('input').type('Persistent task');
    cy.contains('button', 'Add Task').click();
    cy.reload();

    cy.getByTestId('kanban-column-ideas').should('contain.text', 'Persistent task');
  });

  it('restores running timer state after reload', () => {
    cy.clock(now, ['Date', 'setInterval', 'clearInterval']);
    cy.visit('/');

    cy.getByTestId('preset-5').click();
    cy.getByTestId('start-button').click();
    cy.tick(2_000);
    cy.reload();
    cy.tick(2_000);

    cy.getByTestId('timer-status').should('contain.text', 'running');
    cy.getByTestId('timer-display').should('contain.text', '04:58');
  });

  it('restores density and workspace preferences after reload', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem(tasksKey, JSON.stringify([createTask()]));
      },
    });

    cy.get('.kanban-density').contains('button', 'Focus').click();
    cy.getByTestId('settings-button').click();
    cy.get('.settings-panel').within(() => {
      cy.contains('label', 'Focus').click();
      cy.contains('button', 'Apply').click();
    });
    cy.reload();

    cy.get('.kanban-density')
      .contains('button', 'Focus')
      .should('have.attr', 'aria-pressed', 'true');
    cy.contains('[data-testid="task-card"]', 'Preference restore task').within(() => {
      cy.contains('button', 'Focus').should('be.visible');
    });
  });
});

function createTask() {
  return {
    id: 'task-preferences-e2e',
    title: 'Preference restore task',
    description: 'Validate persisted mode preferences',
    status: 'todo',
    createdAt: now,
    archived: false,
  };
}

export {};
