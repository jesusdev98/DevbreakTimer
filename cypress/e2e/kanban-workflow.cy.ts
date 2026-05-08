const tasksKey = 'devbreak-kanban-tasks';

describe('Kanban core workflow', () => {
  beforeEach(() => {
    cy.viewport(1200, 800);
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem(tasksKey, '[]');
      },
    });
  });

  it('creates, edits, moves, archives, and restores a task', () => {
    cy.contains('label', 'New Task').find('input').type('Draft release notes');
    cy.contains('label', 'Description').find('textarea').type('Capture launch details');
    cy.contains('button', 'Add Task').click();

    taskCard('Draft release notes').within(() => {
      cy.contains('button', 'Edit').click();
    });
    cy.get('input[name="draftTitle"]').clear().type('Finalize release notes');
    cy.contains('button', 'Save').click();

    moveStoredTaskToColumn('Finalize release notes', 'todo');
    cy.reload();
    cy.getByTestId('kanban-column-todo').should('contain.text', 'Finalize release notes');

    taskCard('Finalize release notes').within(() => {
      cy.contains('button', 'Archive').click();
    });

    cy.contains('summary', 'Archived Tasks').click();
    cy.get('.kanban-archive').within(() => {
      cy.contains('Finalize release notes').should('be.visible');
      cy.contains('button', 'Restore').click();
    });

    cy.getByTestId('kanban-column-todo').should('contain.text', 'Finalize release notes');
  });
});

function taskCard(title: string): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.contains('[data-testid="task-card"]', title);
}

function moveStoredTaskToColumn(title: string, status: 'ideas' | 'todo' | 'in-progress' | 'done'): void {
  cy.window().then((win) => {
    const storedTasks = JSON.parse(win.localStorage.getItem(tasksKey) ?? '[]') as Array<{
      title: string;
      status: string;
    }>;
    const nextTasks = storedTasks.map((task) =>
      task.title === title ? { ...task, status } : task
    );

    win.localStorage.setItem(tasksKey, JSON.stringify(nextTasks));
  });
}

export {};
