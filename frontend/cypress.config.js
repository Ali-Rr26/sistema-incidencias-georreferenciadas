export default {
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    fixturesFolder: 'cypress/fixtures',
    requestTimeout: 10000,
    responseTimeout: 10000,
    defaultCommandTimeout: 8000,
    env: {
      API_BASE: 'http://localhost:8000/api',
    },
  },
};
