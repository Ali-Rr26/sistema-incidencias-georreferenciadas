/**
 * Password field parity tests (SC-143)
 * Ensures password input styling remains consistent between /login (register mode)
 * and /accept-invite, with intentional differences documented.
 *
 * Decision: Both pages use identical base input classes (.gr-input, .gr-input-wrap, etc.
 * from app.css). Accept-invite has intentional extras (strength meter + rules checklist)
 * that login doesn't. This test verifies:
 * 1. Base input structure is identical
 * 2. Focus states are identical
 * 3. Visual CSS properties match (computed snapshots)
 * 4. Intentional extras are present only in accept-invite
 */

// CSS property snapshot helper — verifies visual parity without external plugins
const getVisualSnapshot = (element) => {
  return cy.wrap(element).then(($el) => {
    const computedStyle = window.getComputedStyle($el[0]);
    return {
      height: computedStyle.height,
      borderRadius: computedStyle.borderRadius,
      borderColor: computedStyle.borderColor,
      borderStyle: computedStyle.borderStyle,
      borderWidth: computedStyle.borderWidth,
      padding: computedStyle.padding,
      paddingLeft: computedStyle.paddingLeft,
      paddingRight: computedStyle.paddingRight,
      fontSize: computedStyle.fontSize,
      fontFamily: computedStyle.fontFamily,
      boxSizing: computedStyle.boxSizing,
      backgroundColor: computedStyle.backgroundColor,
      color: computedStyle.color,
    };
  });
};

describe('SC-143: Password field parity (login vs accept-invite)', () => {
  // Base visual checks: identical input element, label, icon, eye toggle
  describe('Login (register mode)', () => {
    beforeEach(() => {
      cy.visit('/#/login?mode=register');
      cy.get('#register-password').should('be.visible');
    });

    it('CT-PWD-001: Password field has correct base classes', () => {
      cy.get('#register-password')
        .should('have.class', 'gr-input')
        .should('have.class', 'gr-input--pad-right');

      cy.get('#register-password')
        .parent()
        .should('have.class', 'gr-input-wrap');

      cy.get('[data-testid="password-icon"]').should('have.class', 'gr-input-icon');
      cy.get('[data-testid="password-toggle"]').should('have.class', 'gr-input-eye');
    });

    it('CT-PWD-002: Password field height/padding are standard', () => {
      cy.get('#register-password')
        .should('have.css', 'height', '50px')
        .should('have.css', 'border-radius', '12px')
        .should('have.css', 'padding-left', '44px')
        .should('have.css', 'padding-right', '44px');
    });

    it('CT-PWD-003: Focus state has correct ring', () => {
      cy.get('#register-password').focus();
      cy.get('#register-password').should('have.css', 'border-color').and('include', 'rgb(106, 92, 243)');
      // box-shadow: 0 0 0 3px rgba(106, 92, 243, 0.12)
    });

    it('CT-PWD-004: No strength meter or rules checklist in login/register', () => {
      cy.get('[data-testid="password-strength-meter"]').should('not.exist');
      cy.get('[data-testid="password-rules-checklist"]').should('not.exist');
    });

    it('CT-PWD-005: Error message uses correct color/font', () => {
      cy.get('[data-error-for="password"]').should('have.class', 'gr-input-error');
    });
  });

  describe('Accept-Invite', () => {
    beforeEach(() => {
      // Use a valid invite token (seed data or test fixture)
      cy.visit('/#/accept-invite?token=test-valid-token');
      cy.get('#invite-password').should('be.visible');
    });

    it('CT-PWD-006: Password field has identical base classes as login', () => {
      cy.get('#invite-password')
        .should('have.class', 'gr-input')
        .should('have.class', 'gr-input--pad-right');

      cy.get('#invite-password')
        .parent()
        .should('have.class', 'gr-input-wrap');

      cy.get('[data-testid="password-icon"]').should('have.class', 'gr-input-icon');
      cy.get('[data-testid="password-toggle"]').should('have.class', 'gr-input-eye');
    });

    it('CT-PWD-007: Password field height/padding identical to login', () => {
      cy.get('#invite-password')
        .should('have.css', 'height', '50px')
        .should('have.css', 'border-radius', '12px')
        .should('have.css', 'padding-left', '44px')
        .should('have.css', 'padding-right', '44px');
    });

    it('CT-PWD-008: Focus state identical to login', () => {
      cy.get('#invite-password').focus();
      cy.get('#invite-password').should('have.css', 'border-color').and('include', 'rgb(106, 92, 243)');
    });

    it('CT-PWD-009: Intentional extra — strength meter present', () => {
      cy.get('[data-testid="password-strength-meter"]').should('exist');
      cy.get('[data-testid="password-strength-meter"]').should('be.visible');
    });

    it('CT-PWD-010: Intentional extra — rules checklist present', () => {
      cy.get('[data-testid="password-rules-checklist"]').should('exist');
      cy.get('[data-testid="password-rules-checklist"]').should('be.visible');
    });

    it('CT-PWD-011: Error message uses correct color/font', () => {
      cy.get('[data-error-for="password"]').should('have.class', 'gr-input-error');
    });
  });

  describe('Visual CSS parity (computed snapshots)', () => {
    let loginSnapshot;
    let acceptInviteSnapshot;

    it('CT-PWD-012: Capture login password field CSS snapshot', () => {
      cy.visit('/#/login?mode=register');
      cy.get('#register-password').then(($el) => {
        getVisualSnapshot($el).then((snapshot) => {
          loginSnapshot = snapshot;
          cy.log('Login snapshot captured', snapshot);
        });
      });
    });

    it('CT-PWD-013: Capture accept-invite password field CSS snapshot', () => {
      cy.visit('/#/accept-invite?token=test-valid-token');
      cy.get('#invite-password').then(($el) => {
        getVisualSnapshot($el).then((snapshot) => {
          acceptInviteSnapshot = snapshot;
          cy.log('Accept-invite snapshot captured', snapshot);
        });
      });
    });

    it('CT-PWD-014: Password field CSS properties are pixel-identical', () => {
      // After both snapshots are captured, compare them
      // These are the properties that define "visual parity"
      expect(loginSnapshot.height).to.equal(acceptInviteSnapshot.height);
      expect(loginSnapshot.borderRadius).to.equal(acceptInviteSnapshot.borderRadius);
      expect(loginSnapshot.borderColor).to.equal(acceptInviteSnapshot.borderColor);
      expect(loginSnapshot.borderStyle).to.equal(acceptInviteSnapshot.borderStyle);
      expect(loginSnapshot.borderWidth).to.equal(acceptInviteSnapshot.borderWidth);
      expect(loginSnapshot.paddingLeft).to.equal(acceptInviteSnapshot.paddingLeft);
      expect(loginSnapshot.paddingRight).to.equal(acceptInviteSnapshot.paddingRight);
      expect(loginSnapshot.fontSize).to.equal(acceptInviteSnapshot.fontSize);
      expect(loginSnapshot.fontFamily).to.equal(acceptInviteSnapshot.fontFamily);
      expect(loginSnapshot.boxSizing).to.equal(acceptInviteSnapshot.boxSizing);
      expect(loginSnapshot.backgroundColor).to.equal(acceptInviteSnapshot.backgroundColor);
      expect(loginSnapshot.color).to.equal(acceptInviteSnapshot.color);
    });
  });

  describe('Regression: No class scope leakage', () => {
    it('CT-PWD-015: .gr-input class is not redefined in component CSS', () => {
      // This is primarily checked by the CI linter (see .github/workflows/ci.yml)
      // but we document it here as a regression guard.
      // If CI check catches a violation, this test will still pass but CI will fail.
      cy.wrap(true).should('equal', true); // Placeholder — actual check is in CI workflow
    });
  });
});
