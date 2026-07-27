describe('Incident Management (CRUD)', () => {
  it('CT-04: Create incident (form submission)', () => {
    cy.login('usuario@test.com', 'Usuario123!');
    // /incidencias/crear is staff-only (router.js bounces any non-admin
    // bucket to /feed regardless of the incidents.create permission) —
    // citizens create incidents from /feed/crear instead.
    cy.visit('/#/feed/crear');

    // Step 1 — basic info
    cy.get('#ici-title').type('Bache en Av. Principal');
    cy.get('#ici-priority').select('high');
    cy.get('#ici-description').type('Bache grande que causa daño');
    cy.get('#ici-btn-next').click();

    // Step 2 — category (only required field of this step)
    cy.get('#ici-category').select(1, { force: true });
    cy.get('#ici-btn-next').click();

    // Step 3 — drop a pin via the map (the geo stub is unreliable in
    // headless Chromium because getCurrentPosition is a non-configurable
    // host method — clicking the map directly is the same code path
    // Leaflet's "click" fires).
    cy.get('#ici-map').click('center', { force: true });
    cy.get('#ici-btn-next').click();

    // Step 4 — review + submit. The submit button only loses d-none once
    // goToStep(4) has fired; assert that before clicking so Cypress
    // surfaces a useful timeout if validation still hasn't passed.
    cy.get('#ici-submit').should('not.have.class', 'd-none', { timeout: 20000 });

    // The form's submit handler POSTs /api/incidents then navigates
    // 2s later. Asserting on URL change has been flaky across Cypress
    // versions because the navigation goes through a role-bucket
    // short-circuit on top of a setTimeout race. Spy on the POST
    // *after* mount (defining the alias before cy.visit loses it on
    // the page reload) and wait for a 2xx — that IS what CT-04
    // actually asserts ("the form successfully submits a new incident")
    // and it's deterministic.
    cy.intercept('POST', '**/api/incidents').as('createIncident');
    cy.get('#ici-submit').click();
    cy.wait('@createIncident', { timeout: 30000 })
      .its('response.statusCode')
      .should('be.oneOf', [200, 201]);
  });

  it('CT-05: List incidents (pagination)', () => {
    // /incidencias is the staff list (requires incidents.view) — citizens
    // browse via /feed instead, see CT-19 in rbac.cy.js.
    cy.login('admin.gad-municipal-del-canton-quito@organizacion.com', 'Admin123!');
    cy.visit('/#/incidencias');

    cy.get('#contenedor-tabla').should('not.have.class', 'd-none');
    cy.get('table tbody tr, [data-testid*="incident-row"]').should('have.length.greaterThan', 0);
  });

  it('CT-06: View incident detail', () => {
    cy.getAuthToken('usuario@test.com', 'Usuario123!').then(token => {
      cy.fixture('incidents').then(data => {
        cy.createIncidentViaAPI(token, data.minimal).then(id => {
          cy.login('usuario@test.com', 'Usuario123!');
          // Citizens view incidents via /feed/:id, not the staff /incidencias/:id.
          cy.visit(`/#/feed/${id}`);

          cy.get('body').should('contain', 'E2E Test Incident');
        });
      });
    });
  });
});
