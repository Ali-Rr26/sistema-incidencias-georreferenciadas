describe('Dashboard + Filters', () => {
  beforeEach(() => {
    cy.login('admin.gad-municipal-del-canton-quito@organizacion.com', 'Admin123!');
    cy.visit('/#/dashboard');
  });

  it('CT-08: Dashboard loads (stat cards + charts)', () => {
    cy.get('body').should('exist');
    cy.get('[class*="stat"], [class*="card"]').should('have.length.greaterThan', 0);
    cy.get('[id*="chart"], svg').should('exist');
  });

  it('CT-09: Filter by date range applies', () => {
    cy.get('input[type="date"], [placeholder*="fecha"]').first().type('2026-07-01');
    cy.get('input[type="date"], [placeholder*="fecha"]').last().type('2026-07-31');
    cy.get('button:contains("Aplicar"), button[type="submit"]').click();

    cy.get('[class*="stat"], [class*="card"]').should('exist');
  });

  it('CT-10: Filter by type + location', () => {
    cy.get('select[name*="type"], select[name*="category"]').select('2', { force: true });
    cy.get('select[name*="location"], select[name*="city"]').select('284', { force: true });
    cy.get('button:contains("Aplicar"), button[type="submit"]').click();

    cy.get('[id*="chart"], svg').should('exist');
  });

  it('CT-11: Weekly performance chart visible', () => {
    cy.get('[id*="chart"], svg').should('have.length.greaterThan', 0);
    cy.get('body').should('contain', /recibidas|resueltas|semanal/i);
  });
});