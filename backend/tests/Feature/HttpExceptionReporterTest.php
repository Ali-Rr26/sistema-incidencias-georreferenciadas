<?php

declare(strict_types=1);

use App\Domains\Auth\Exceptions\AuthenticationException;
use App\Domains\Users\Models\User;
use App\Exceptions\HttpExceptionReporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Monolog\Handler\StreamHandler;
use Monolog\Handler\TestHandler;
use Monolog\Processor\PsrLogMessageProcessor;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    // User factory references role_id; seed a placeholder role.
    DB::table('roles')->insert(['id' => 1, 'name' => 'admin_sistema']);

    // Ensure the 'exceptions' channel exists in config even if config/logging.php
    // does not yet define it. The reporter must always have a channel to write to.
    config([
        'logging.channels.exceptions' => [
            'driver' => 'monolog',
            'level' => 'debug',
            'handler' => StreamHandler::class,
            'handler_with' => ['stream' => 'php://stderr'],
            'processors' => [PsrLogMessageProcessor::class],
        ],
    ]);

    // Replace the channel's handlers with an in-memory TestHandler so the
    // reporter's Log::channel('exceptions') calls land in the test records.
    $this->testHandler = new TestHandler;
    Log::channel('exceptions')->setHandlers([$this->testHandler]);
});

/**
 * S10.1 — 404 emits a warning log.
 */
it('logs a warning for a 404 from api/*', function (): void {
    $response = $this->getJson('/api/__missing_route_for_test__');

    $response->assertNotFound();

    $records = $this->testHandler->getRecords();
    expect($records)->toHaveCount(1)
        ->and($records[0]['level_name'])->toBe('WARNING')
        ->and($records[0]->context['status'])->toBe(404)
        ->and($records[0]->context['event'])->toBe('http_exception')
        ->and($records[0]->context['level'])->toBe('warning')
        ->and($records[0]->context['exception_class'])->toBe(NotFoundHttpException::class);
});

/**
 * S10.2 — 403 emits a warning log with user_id populated.
 *
 * Triggers an AccessDeniedHttpException from an authenticated request.
 */
it('logs a warning for a 403 with user_id', function (): void {
    Route::get('/api/__access_denied__', function () {
        throw new AccessDeniedHttpException('nope');
    });

    $user = User::factory()->create();

    $response = $this->actingAs($user)->getJson('/api/__access_denied__');

    $response->assertForbidden();

    $records = $this->testHandler->getRecords();
    expect($records)->toHaveCount(1)
        ->and($records[0]['level_name'])->toBe('WARNING')
        ->and($records[0]->context['status'])->toBe(403)
        ->and($records[0]->context['level'])->toBe('warning')
        ->and($records[0]->context['user_id'])->toBe($user->id);
});

/**
 * S10.3 — RuntimeException emits an error log with status 500.
 */
it('logs an error for a RuntimeException', function (): void {
    Route::get('/api/__boom__', fn () => throw new RuntimeException('boom'));

    $response = $this->getJson('/api/__boom__');

    $response->assertStatus(500);

    $records = $this->testHandler->getRecords();
    expect($records)->toHaveCount(1)
        ->and($records[0]['level_name'])->toBe('ERROR')
        ->and($records[0]->context['status'])->toBe(500)
        ->and($records[0]->context['level'])->toBe('error')
        ->and($records[0]->context['message'])->toBe('boom');
});

/**
 * S10.4 — X-Request-ID header is honored when present.
 */
it('honors X-Request-ID header when present', function (): void {
    Route::get('/api/__boom_header__', fn () => throw new RuntimeException('boom'));

    $this->withHeader('X-Request-ID', 'test-header-123')
        ->getJson('/api/__boom_header__');

    $records = $this->testHandler->getRecords();
    expect($records[0]->context['request_id'])->toBe('test-header-123');
});

/**
 * S10.5 — trace_id is always a UUIDv4.
 */
it('emits a UUIDv4 trace_id', function (): void {
    Route::get('/api/__boom_trace__', fn () => throw new RuntimeException('boom'));

    $this->getJson('/api/__boom_trace__');

    $records = $this->testHandler->getRecords();
    $traceId = $records[0]->context['trace_id'];

    expect($traceId)->toMatch('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/');
});

/**
 * S10.6 — dontReport suppresses the log for AuthenticationException.
 *
 * The project's domain AuthenticationException (extends RuntimeException,
 * code=401) must be in dontReport so failed logins are not spammed as warnings.
 */
it('does not log AuthenticationException from the auth domain', function (): void {
    Route::get('/api/__auth_boom__', function () {
        throw new AuthenticationException('unauthorized');
    });

    $response = $this->getJson('/api/__auth_boom__');

    // The render pipeline still produces a 401 — but no log line is emitted.
    $response->assertStatus(401);
    expect($this->testHandler->getRecords())->toBeEmpty();
});

/**
 * S10.7 — Log includes all 12 schema fields.
 */
it('includes all 12 schema fields in the context', function (): void {
    Route::get('/api/__boom_schema__', fn () => throw new RuntimeException('boom'));

    $this->withHeader('X-Request-ID', 'rid-test')
        ->getJson('/api/__boom_schema__');

    $records = $this->testHandler->getRecords();
    $ctx = $records[0]->context;

    foreach (HttpExceptionReporter::CONTEXT_KEYS as $key) {
        expect($ctx)->toHaveKey($key);
    }
});

/**
 * R-001 — `report()` derives the HTTP status from a Throwable exactly once.
 *
 * The original implementation invoked `statusFromThrowable()` twice (once in
 * `report()`, again inside `levelForStatus()`), wasting CPU on every reported
 * exception. This spy subclasses NotFoundHttpException and counts calls to
 * `getStatusCode()`. After the refactor that threads `$status` through helpers,
 * the count must be 1.
 */
it('does not derive status more than once per report call', function (): void {
    $spy = new class extends NotFoundHttpException
    {
        public int $statusCodeCalls = 0;

        public function __construct()
        {
            parent::__construct('not found');
        }

        public function getStatusCode(): int
        {
            $this->statusCodeCalls++;

            return parent::getStatusCode();
        }
    };

    $reporter = app(HttpExceptionReporter::class);
    $reporter->report($spy, request());

    expect($spy->statusCodeCalls)->toBe(1);
});

/**
 * R-001 (S10.7 contract tightening) — every record carries the expected type
 * and shape, not merely the presence of each schema key.
 *
 * The presence-only assertion in S10.7 is necessary but not sufficient: a future
 * regression that swapped `user_id` to the string "0", or turned `message` into
 * `null`, would pass the original test. This test pins the type/contract for
 * every key the schema defines.
 */
it('enforces the S10.7 contract with type and nullability assertions', function (): void {
    Route::get('/api/__boom_contract__', fn () => throw new RuntimeException('boom'));

    $this->withHeader('X-Request-ID', 'rid-contract')
        ->getJson('/api/__boom_contract__');

    $records = $this->testHandler->getRecords();
    $ctx = $records[0]->context;

    // event — string literal, fixed value
    expect($ctx['event'])->toBe('http_exception');

    // request_id — non-empty string (header honored)
    expect($ctx['request_id'])->toBeString()
        ->and($ctx['request_id'])->toBe('rid-contract');

    // trace_id — UUIDv4 regex
    expect($ctx['trace_id'])->toBeString()
        ->and($ctx['trace_id'])->toMatch(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/',
        );

    // user_id — null OR int (anon request has no user)
    expect($ctx['user_id'])->toBeNull();

    // route — non-empty string, path-without-leading-slash (Laravel `$request->path()` contract)
    expect($ctx['route'])->toBeString()
        ->and($ctx['route'])->not->toBe('')
        ->and($ctx['route'])->not->toStartWith('/');

    // method — uppercase HTTP verb string
    expect($ctx['method'])->toBeString()
        ->and($ctx['method'])->toBe(strtoupper($ctx['method']))
        ->and($ctx['method'])->toBeIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);

    // status — int in [100, 599]
    expect($ctx['status'])->toBeInt()
        ->and($ctx['status'])->toBeGreaterThanOrEqual(100)
        ->and($ctx['status'])->toBeLessThan(600);

    // level — string in fixed set
    expect($ctx['level'])->toBeString()
        ->and($ctx['level'])->toBeIn(['error', 'warning']);

    // exception_class — non-empty FQCN OR namespaced class name (PHP `::class` returns without leading backslash).
    expect($ctx['exception_class'])->toBeString()
        ->and($ctx['exception_class'])->not->toBe('');

    // message — string (NOT null), non-empty
    expect($ctx['message'])->toBeString()
        ->and($ctx['message'])->toBe('boom');

    // file — non-empty string (absolute or project-relative path)
    expect($ctx['file'])->toBeString()
        ->and($ctx['file'])->not->toBe('');

    // line — int > 0
    expect($ctx['line'])->toBeInt()
        ->and($ctx['line'])->toBeGreaterThan(0);
});
