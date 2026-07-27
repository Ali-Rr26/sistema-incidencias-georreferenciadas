describe('Incident Management (CRUD)', () => {
  it('CT-04: Create incident (form submission)', () => {
    cy.login('usuario@test.com', 'Usuario123!');
    cy.visit('/#/incidencias/crear', {
      onBeforeLoad(win) {
        cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake(success => {
          success({ coords: { latitude: -0.22, longitude: -78.5 } });
        });
      },
    });

    // Step 1 — basic info
    cy.get('#ici-title').type('Bache en Av. Principal');
    cy.get('#ici-priority').select('high');
    cy.get('#ici-description').type('Bache grande que causa daño');
    cy.get('#ici-btn-next').click();

    // Step 2 — category (only required field of this step)
    cy.get('#ici-category').select(1, { force: true });
    cy.get('#ici-btn-next').click();

    // Step 3 — geolocation (stubbed above)
    cy.get('#ici-btn-geo').click();
    cy.get('#ici-btn-next').click();

    // Step 4 — review + submit
    cy.get('#ici-submit').click();

    cy.url().should('match', /#\/incidencias\/\d+/);
  });

  it('CT-05: List incidents (pagination)', () => {
    // /incidencias is the staff list (requires incidents.view) — citizens
    // browse via /feed instead, see CT-19 in rbac.cy.js.
    cy.login('admin.gad-municipal-del-canton-quito@organizacion.com', 'Admin123!');
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
});
