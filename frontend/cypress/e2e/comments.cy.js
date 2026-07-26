describe('Incident Comments', () => {
  it('CT-17: Add comment to incident (UI)', () => {
    cy.getAuthToken('usuario@test.com', 'Usuario123!').then(token => {
      cy.fixture('incidents').then(data => {
        cy.createIncidentViaAPI(token, data.minimal).then(id => {
          cy.login('usuario@test.com', 'Usuario123!');
          cy.visit(`/#/incidencias/${id}`);

          cy.get('textarea[name*="comment"], #detalle-comment-input, [placeholder*="comentario"]').type('Este es mi comentario E2E');
          cy.get('button:contains("Enviar"), button:contains("Comentar"), #detalle-comment-submit').click();

          cy.get('.alert-success, .toast-success, [class*="comment"]').should('exist');
        });
      });
    });
  });

  it('CT-18: Comment appears in API list', () => {
    cy.getAuthToken('usuario@test.com', 'Usuario123!').then(token => {
      cy.fixture('incidents').then(data => {
        cy.createIncidentViaAPI(token, data.minimal).then(id => {
          cy.addComment(id, 'Test comment E2E', token).then(() => {
            cy.request({
              url: `${Cypress.env('API_BASE')}/incidents/${id}/comments`,
              headers: { Authorization: `Bearer ${token}` },
            }).then(res => {
              const comments = res.body.data || res.body;
              expect(Array.isArray(comments)).to.be.true;
              expect(comments.length).to.be.greaterThan(0);
              const hasComment = comments.some(c => (c.message || c.content || '').includes('Test comment E2E'));
              expect(hasComment).to.be.true;
            });
          });
        });
      });
    });
  });
});