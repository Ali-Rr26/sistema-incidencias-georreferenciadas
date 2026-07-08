/**
 * firebase.config.js — PUBLIC Firebase web configuration (R12).
 *
 * =========================================================================
 * WHY PLACEHOLDERS, NOT REAL VALUES
 * =========================================================================
 *
 * This file ships with `'REPLACE_ME_*'` placeholders. The actual values
 * come from the Firebase Console → Project Settings → General → "Your
 * apps" → Web app config:
 *
 *   apiKey, authDomain, projectId, appId  (and optionally measurementId)
 *
 * The values are PUBLIC by Firebase's design — they're handed to the
 * browser as part of every Firebase web app and Firebase explicitly
 * documents them as safe to commit. They identify the project, not the
 * user; the actual security boundary is the OAuth popup + the ID token
 * the SDK hands back (which the backend re-verifies via
 * KreaitFirebaseTokenVerifier, see PR-2).
 *
 * The placeholders MUST be replaced BEFORE any production deployment.
 * The Vitest suite mocks the dynamic `import()` of the Firebase SDK
 * (see firebase-loader.test.js) so the tests pass with the placeholders
 * present and never touch the network. The backend smoke-test (R10,
 * PR-2) does NOT require these frontend values — `kreait/firebase-php`
 * has its own service-account JSON loaded from a file path, completely
 * independent of these frontend values.
 *
 * Where to fill in (pre-merge to main):
 *
 *   1. Open https://console.firebase.google.com/  →  select project
 *   2. Project settings (gear) → General → scroll to "Your apps"
 *   3. If no Web app exists: "Add app" → Web (</>) icon, register
 *   4. Copy apiKey, authDomain, projectId, appId from the SDK setup
 *      snippet into the four fields below.
 *   5. Also enable Google as a sign-in provider under
 *      Authentication → Sign-in method → Google → Enable.
 *
 * SECURITY: do NOT add the service-account JSON here. That belongs
 * SERVER-SIDE only (backend/.env: FIREBASE_CREDENTIALS or
 * FIREBASE_SERVICE_ACCOUNT_JSON).
 */
export const firebaseConfig = Object.freeze({
  apiKey: 'REPLACE_ME_FIREBASE_API_KEY',
  authDomain: 'REPLACE_ME_FIREBASE_AUTH_DOMAIN',
  projectId: 'REPLACE_ME_FIREBASE_PROJECT_ID',
  appId: 'REPLACE_ME_FIREBASE_APP_ID',
});
