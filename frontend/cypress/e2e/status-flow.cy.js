describe('Incident Status Flow', () => {
  it('CT-12: Pending → In Progress → Resolved', () => {
    cy.getAuthToken('usuario@test.com', 'Usuario123!').then(citizenToken => {
      cy.getAuthToken('operador.gad-municipal-del-canton-quito@organizacion.com', 'Operador123!').then(opToken => {
        cy.getAuthToken('admin.gad-municipal-del-canton-quito@organizacion.com', 'Admin123!').then(adminToken => {
          cy.fixture('incidents').then(data => {
            // Create incident
            cy.createIncidentViaAPI(citizenToken, data.minimal).then(id => {
              // Assign the operator whose token drives the status changes below —
              // updateStatus requires the caller to be the assigned "responsable".
              cy.assignIncident(id, 5, 'responsable', adminToken);

              // Change to in_progress
              cy.changeIncidentStatus(id, 'in_progress', opToken);

              // Change to resolved
              cy.changeIncidentStatus(id, 'resolved', opToken).then(() => {
                cy.login('operador.gad-municipal-del-canton-quito@organizacion.com', 'Operador123!');
                cy.visit(`/#/incidencias/${id}`);
                cy.get('body').should('contain', /resuelto|resolved/i);
              });
            });
          });
        });
      });
    });
  });

  it('CT-13: Resolution date auto-set on resolved', () => {
    cy.getAuthToken('usuario@test.com', 'Usuario123!').then(citizenToken => {
      cy.getAuthToken('operador.gad-municipal-del-canton-quito@organizacion.com', 'Operador123!').then(opToken => {
        cy.getAuthToken('admin.gad-municipal-del-canton-quito@organizacion.com', 'Admin123!').then(adminToken => {
          cy.fixture('incidents').then(data => {
            cy.createIncidentViaAPI(citizenToken, data.minimal).then(id => {
              cy.assignIncident(id, 5, 'responsable', adminToken);

              cy.changeIncidentStatus(id, 'resolved', opToken).then(() => {
                cy.request({
                  url: `${Cypress.env('API_BASE')}/incidents/${id}`,
                  headers: { Authorization: `Bearer ${opToken}` },
                }).then(res => {
                  expect(res.body.data?.resolution_date || res.body.resolution_date).to.not.be.null;
                });
              });
            });
          });
        });
      });
    });
  });

  it('CT-14: Invalid status transition rejected', () => {
    cy.getAuthToken('usuario@test.com', 'Usuario123!').then(citizenToken => {
      cy.getAuthToken('operador.gad-municipal-del-canton-quito@organizacion.com', 'Operador123!').then(opToken => {
        cy.getAuthToken('admin.gad-municipal-del-canton-quito@organizacion.com', 'Admin123!').then(adminToken => {
          cy.fixture('incidents').then(data => {
            cy.createIncidentViaAPI(citizenToken, data.minimal).then(id => {
              cy.assignIncident(id, 5, 'responsable', adminToken);

              cy.request({
                method: 'PUT',
                url: `${Cypress.env('API_BASE')}/incidents/${id}/estado`,
                headers: { Authorization: `Bearer ${opToken}` },
                body: { status: 'invalid_status' },
                failOnStatusCode: false,
              }).then(res => {
                expect(res.status).to.be.oneOf([400, 422]);
              });
            });
          });
        });
      });
    });
  });
});
