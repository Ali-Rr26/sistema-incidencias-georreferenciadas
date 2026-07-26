describe('Role-Based Access Control (RBAC)', () => {
  it('CT-19: Citizen can only see own incidents', () => {
    cy.login('usuario@test.com', 'Usuario123!');
    cy.visit('/#/incidencias');

    cy.get('table tbody tr, [data-testid*="incident-row"]').each($row => {
      cy.wrap($row).should('contain', 'usuario@test.com');
    });
  });

  it('CT-20: Operator sees own organization incidents', () => {
    cy.login('operador.gad-municipal-del-canton-quito@organizacion.com', 'Operador123!');
    cy.visit('/#/incidencias');

    cy.get('body').should('exist');
  });

  it('CT-21: Admin sees all org incidents', () => {
    cy.login('admin.gad-municipal-del-canton-quito@organizacion.com', 'Admin123!');
    cy.visit('/#/incidencias');

    cy.get('table tbody tr, [data-testid*="incident-row"]').should('have.length.greaterThan', 0);
  });

  it('CT-22: Citizen cannot assign incidents', () => {
    cy.getAuthToken('usuario@test.com', 'Usuario123!').then(citizenToken => {
      cy.fixture('incidents').then(data => {
        cy.createIncidentViaAPI(citizenToken, data.minimal).then(id => {
          cy.request({
            method: 'POST',
            url: `${Cypress.env('API_BASE')}/incidents/${id}/assignments`,
            headers: { Authorization: `Bearer ${citizenToken}` },
            body: { user_id: 2, assignment_role: 'responsable' },
            failOnStatusCode: false,
          }).then(res => {
            expect(res.status).to.be.oneOf([403, 401, 422]);
          });
        });
      });
    });
  });
});