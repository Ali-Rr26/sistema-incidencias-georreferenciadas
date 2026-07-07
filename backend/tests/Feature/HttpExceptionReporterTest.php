<?php

declare(strict_types=1);

use App\Domains\Auth\Exceptions\AuthenticationException;
use App\Exceptions\HttpExceptionReporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Monolog\Handler\TestHandler;
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
            'handler' => Monolog\Handler\StreamHandler::class,
            'handler_with' => ['stream' => 'php://stderr'],
            'processors' => [Monolog\Processor\PsrLogMessageProcessor::class],
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

    $user = App\Domains\Users\Models\User::factory()->create();

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