describe('Incident Management (CRUD)', () => {
  it('CT-04: Create incident (form submission)', () => {
    cy.getAuthToken('usuario@test.com', 'Usuario123!').then(token => {
      cy.login('usuario@test.com', 'Usuario123!');
      cy.visit('/#/incidencias/new');

      cy.get('#titulo, [placeholder*="Título"]').type('Bache en Av. Principal');
      cy.get('#descripcion, [placeholder*="Descripción"]').type('Bache grande que causa daño');
      cy.get('#prioridad, select[name*="priority"]').select('high');
      cy.get('#tipo, select[name*="category"]').select('2');
      cy.get('button[type="submit"]').click();

      cy.url().should('match', /#\/incidencias\/\d+/);
    });
  });

  it('CT-05: List incidents (pagination)', () => {
    cy.login('usuario@test.com', 'Usuario123!');
    cy.visit('/#/incidencias');

    cy.get('table tbody tr, [data-testid*="incident-row"]').should('have.length.greaterThan', 0);
  });

  it('CT-06: View incident detail', () => {
    cy.getAuthToken('usuario@test.com', 'Usuario123!').then(token => {
      cy.fixture('incidents').then(data => {
        cy.createIncidentViaAPI(token, data.minimal).then(id => {
          cy.login('usuario@test.com', 'Usuario123!');
          cy.visit(`/#/incidencias/${id}`);

          cy.get('body').should('contain', 'E2E Test Incident');
        });
      });
    });
  });

  it('CT-07: Update incident description', () => {
    cy.getAuthToken('usuario@test.com', 'Usuario123!').then(token => {
      cy.fixture('incidents').then(data => {
        cy.createIncidentViaAPI(token, data.minimal).then(id => {
          cy.login('usuario@test.com', 'Usuario123!');
          cy.visit(`/#/incidencias/${id}`);

          cy.get('#descripcion, textarea').clear().type('Updated E2E description');
          cy.get('button:contains("Guardar"), button[type="submit"]').click();
          cy.get('.alert-success, .toast-success').should('exist');
        });
      });
    });
  });
});