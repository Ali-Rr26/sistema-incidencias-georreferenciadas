Cypress.Commands.add('login', (email, password) => {
  cy.visit('/#/login');
  cy.get('#email').type(email);
  cy.get('#password').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('include', '/#/dashboard');
});

Cypress.Commands.add('createIncidentViaAPI', (token, payload) => {
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('API_BASE')}/incidents`,
    headers: { Authorization: `Bearer ${token}` },
    body: payload,
  }).then(res => res.body.data?.id ?? res.body.id);
});

Cypress.Commands.add('getAuthToken', (email, password) => {
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('API_BASE')}/login`,
    body: { email, password },
  }).then(res => res.body.access_token);
});

Cypress.Commands.add('assignIncident', (incidentId, userId, role, token) => {
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('API_BASE')}/incidents/${incidentId}/assignments`,
    headers: { Authorization: `Bearer ${token}` },
    body: { user_id: userId, assignment_role: role },
  });
});

Cypress.Commands.add('changeIncidentStatus', (incidentId, newStatus, token) => {
  return cy.request({
    method: 'PUT',
    url: `${Cypress.env('API_BASE')}/incidents/${incidentId}/status`,
    headers: { Authorization: `Bearer ${token}` },
    body: { status: newStatus },
  });
});

Cypress.Commands.add('addComment', (incidentId, message, token) => {
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('API_BASE')}/incidents/${incidentId}/comments`,
    headers: { Authorization: `Bearer ${token}` },
    body: { message },
  });
});