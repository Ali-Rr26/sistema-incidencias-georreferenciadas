<?php

/*
|--------------------------------------------------------------------------
| Mercure
|--------------------------------------------------------------------------
|
| Configuration for the Mercure real-time push integration that powers the
| notification bell in the app shell.
|
| Mercure has its own authentication model independent of Laravel:
|   - The backend uses a "publisher" JWT (HS256, secret from
|     MERCURE_PUBLISHER_JWT_SECRET) when calling HubInterface::publish().
|   - The browser uses a "subscriber" JWT (HS256, secret from
|     MERCURE_SUBSCRIBER_JWT_SECRET) embedded in the `mercureAuthorization`
|     cookie returned by the login endpoints. The JWT carries a
|     `mercure.subscribe` claim authorizing the user's notification topic.
|
| These two secrets MUST be different (different blast radius) and rotated
| on different cadences — see docs/Security/secret-rotation.md for the
| procedure, frequency, and emergency flow.
|
*/

return [

    /*
    |--------------------------------------------------------------------------
    | Subscriber cookie
    |--------------------------------------------------------------------------
    |
    | The `mercureAuthorization` cookie authenticates the browser's SSE
    | connection against the Mercure hub. The app-shell EventSource sends
    | it via `withCredentials: true`; the hub validates the cookie's
    | `mercure.subscribe` claim before streaming updates.
    |
    | The cookie is refreshed on every Laravel token refresh (see
    | `AuthController::refresh`).
    |
    */
    'cookie' => [
        'name' => env('MERCURE_COOKIE_NAME', 'mercureAuthorization'),
        'path' => env('MERCURE_COOKIE_PATH', '/'),
        // 30 days by default — aligned with the refresh_token cookie so the
        // SSE connection survives between sessions. Drop this if you want
        // a tighter idle-disconnect window.
        'ttl_minutes' => (int) env('MERCURE_COOKIE_TTL_MIN', 60 * 24 * 30),
    ],

    /*
    |--------------------------------------------------------------------------
    | Publisher (server-side)
    |--------------------------------------------------------------------------
    |
    | Read by AppServiceProvider::register() to build the LcobucciFactory +
    | FactoryTokenProvider that authenticates HubInterface::publish().
    | The publisher JWT is never sent to clients — it stays server-side.
    |
    | - `jwt`              : HS256 secret. Generate with `openssl rand -hex 32`.
    |                        Keep OUT of version control — store in your
    |                        secret manager or k8s sealed-secrets.
    | - `jwt_ttl_seconds`  : Caps each publish token's `exp` claim (default 1h).
    |                        Without it, a captured token stays valid forever.
    | - `allowed_topics`   : Comma-separated glob patterns the publisher is
    |                        allowed to target. Dev defaults to `*` (no
    |                        restriction). Production should narrow to
    |                        `user:*:notifications`.
    |
    */
    'publisher' => [
        'jwt' => env('MERCURE_PUBLISHER_JWT_SECRET'),
        'jwt_ttl_seconds' => (int) env('MERCURE_PUBLISHER_JWT_TTL', 60 * 60),
        'allowed_topics' => str_contains((string) env('MERCURE_PUBLISHER_ALLOWED_TOPICS', '*'), '*')
            ? ['*']
            : array_map('trim', explode(',', (string) env('MERCURE_PUBLISHER_ALLOWED_TOPICS'))),
    ],

    /*
    |--------------------------------------------------------------------------
    | Subscriber (client-side)
    |--------------------------------------------------------------------------
    |
    | Read by MercureCookieService to sign the JWT embedded in the
    | `mercureAuthorization` cookie returned by the login endpoints. The JWT
    | carries a `mercure.subscribe` claim restricting the client to its own
    | `user:{id}:notifications` topic.
    |
    | Rotate independently from `publisher.jwt` — this secret is embedded
    | in every active cookie until its `exp` passes.
    |
    */
    'subscriber' => [
        'jwt' => env('MERCURE_SUBSCRIBER_JWT_SECRET'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Topics by role
    |--------------------------------------------------------------------------
    |
    | Mapping role_name → list of Mercure topic patterns that role is
    | authorized to subscribe to. Consumed by MercureCookieService when
    | building the `mercure.subscribe` claim (currently the claim is
    | `["user:{id}:notifications"]` regardless of role; this map is the
    | hook for role-aware audiences).
    |
    | Examples for future expansion:
    |   'operador_gravedad_alta' => ['user:*:notifications', 'incidents:high_priority:updates'],
    |
    */
    'topics_by_role' => [
        'admin_sistema' => ['user:*:notifications'],
        'admin_organizacion' => ['user:*:notifications'],
        'operador_organizacion' => ['user:*:notifications'],
        'usuario' => ['user:*:notifications'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Hub
    |--------------------------------------------------------------------------
    |
    | URL of the Mercure hub. The hub runs as a separate docker-compose service
    | (`mercure`) in every environment. Local and production differ only in
    | hostname: in dev the hub is reachable as `http://mercure:3000/.well-known/
    | mercure` (compose-internal DNS); in production point MERCURE_PUBLIC_URL
    | at whatever sidecar hostname your platform exposes.
    |
    */
    'hub' => [
        'url' => env('MERCURE_PUBLIC_URL', 'http://127.0.0.1:8000/.well-known/mercure'),
    ],
];
