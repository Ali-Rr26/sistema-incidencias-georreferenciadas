describe('Authentication', () => {
  it('CT-01: Citizen login → dashboard', () => {
    cy.login('usuario@test.com', 'Usuario123!');
    cy.get('body').should('exist');
    cy.url().should('include', '/#/dashboard');
  });

  it('CT-02: Login failure (wrong password)', () => {
    cy.visit('/#/login');
    cy.get('#email').type('usuario@test.com');
    cy.get('#password').type('WrongPassword123!');
    cy.get('button[type="submit"]').click();
    cy.get('.alert-danger, .text-danger').should('exist');
  });

  it('CT-03: Logout → redirect to login', () => {
    cy.login('usuario@test.com', 'Usuario123!');
    cy.get('nav a, button').contains(/logout|salir/i).click({ force: true });
    cy.url().should('include', '/#/login');
  });
});