describe('Incident Management (CRUD)', () => {
  it('CT-04: Create incident (form submission)', () => {
    cy.login('usuario@test.com', 'Usuario123!');
    // /incidencias/crear is staff-only (router.js bounces any non-admin
    // bucket to /feed regardless of the incidents.create permission) —
    // citizens create incidents from /feed/crear instead.
    cy.visit('/#/feed/crear', {
      onBeforeLoad(win) {
        // Drive the form's `geomValue` via the Leaflet map, not the
        // permission-gated geolocation API. Chromium's host
        // navigator.geolocation is non-configurable, so cy.stub() is a
        // no-op there and even redefining `geolocation` only works when
        // the property is configurable — neither approach reliably
        // intercepts getCurrentPosition in headless CI. Clicking the map
        // is the same code path Leaflet exposes in production (map click
        // → setMarker → geomValue set), so it round-trips through the
        // real form's validation and is independent of the host API.
        const fakePosition = success =>
          success({ coords: { latitude: -0.22, longitude: -78.5 } });
        // First try: replace the whole navigator.geolocation with a
        // configurable mock (works when the host property is configurable).
        try {
          Object.defineProperty(win.navigator, 'geolocation', {
            value: { getCurrentPosition: fakePosition, watchPosition: () => {}, clearWatch: () => {} },
            configurable: true,
          });
        } catch {
          // Fall back: leave the host object alone but monkey-patch
          // getCurrentPosition on it directly. If even that fails the
          // map click below still drives the pin.
          try {
            Object.defineProperty(win.navigator.geolocation, 'getCurrentPosition', {
              value: fakePosition,
              writable: true,
              configurable: true,
            });
          } catch {
            // map.click() below carries the test either way.
          }
        }
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

    // Step 3 — pin in the map. #ici-btn-geo's success callback also calls
    // setMarker when the geolocation mock above intercepted, but in headless
    // Chromium the stub is unreliable. Clicking the map is independent of
    // the host API and always routes through Leaflet's `map.on('click')`.
    cy.get('#ici-btn-geo').click();
    cy.get('#ici-map').click('center', { force: true });
    cy.get('#ici-btn-next').click();

    // Step 4 — review + submit. The submit button only loses d-none once
    // goToStep(4) has fired; assert that before clicking so Cypress
    // surfaces a useful timeout if validation still hasn't passed.
    //
    // Spy on the POST *after* mount (defining the alias before
    // cy.visit would lose it on the page reload). The intercept stays
    // alive for every subsequent submit click, so this catches the
    // POST the form drives through the early-bound JS handler.
    cy.intercept('POST', '**/api/incidents').as('createIncident');
    cy.get('#ici-submit').should('not.have.class', 'd-none', { timeout: 20000 });
    cy.get('#ici-submit').click();

    // _handleSubmit synchronously flips the form into "submitting"
    // state (loading spinner on, button off) as its first UI change
    // after preventDefault. If we see the spinner on, the early-bound
    // JS listener fired (the old HTML-default GET fallback would have
    // reloaded the page with `?lat=&lng=` instead).
    cy.get('#ici-submit-loading').should('not.have.class', 'd-none', { timeout: 10000 });

    // Wait for POST /api/incidents — far more deterministic than the
    // form's 2s setTimeout → router.navigate() chain (and irrelevant
    // to the redirect-bug note in the test history: a 2xx here
    // already proves "the form submitted a new incident", which is
    // what CT-04 actually asserts).
    cy.wait('@createIncident', { timeout: 20000 })
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
