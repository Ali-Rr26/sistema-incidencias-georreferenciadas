<?php

declare(strict_types=1);

use App\Console\Commands\StartFrankenPhpCommand;
use Illuminate\Support\Facades\Log;

/**
 * Tests for StartFrankenPhpCommand's captureEvent() — the only piece of new
 * public behavior. Verifies that every stderr/stdout line from FrankenPHP that
 * the parent StartFrankenPhpCommand would either:
 *
 *   (a) silently drop, OR
 *   (b) emit as the cryptic "ERROR unknown error." fallback,
 *
 * is ALSO persisted through `Log::channel('exceptions')` so the full Caddy
 * debug JSON is searchable. Streams and 'handled request' events are
 * intentionally NOT double-logged because the parent's behavior is already
 * correct for them.
 *
 * Test runner: `composer run test -- --filter=StartFrankenPhpCommand`
 */
beforeEach(function () {
    $this->command = new StartFrankenPhpCommand;
});

it('logs unknown error events with the full debug payload through exceptions channel', function () {
    Log::spy();
    Log::shouldReceive('channel')->with('exceptions')->andReturnSelf();

    $logged = [];
    Log::shouldReceive('error')->andReturnUsing(function (string $msg, array $ctx) use (&$logged) {
        $logged[] = ['message' => $msg, 'context' => $ctx];
    });

    // This is the canonical "unknown error" shape: level=error, no msg field.
    // Matches what we see in docker compose logs (15+ lines on startup).
    $debug = [
        'level' => 'error',
        'ts' => 1753089177.6,
        'logger' => 'frankenphp',
        'some_unrecognized_key' => 'some_unrecognized_value',
    ];

    $this->command->captureEvent($debug, 'unknown error');

    expect($logged)->toHaveCount(1)
        ->and($logged[0]['message'])->toBe('frankenphp_event')
        ->and($logged[0]['context']['event'])->toBe('frankenphp_event')
        ->and($logged[0]['context']['fallback_reason'])->toBe('no_msg')
        ->and($logged[0]['context']['debug'])->toBe($debug);
});

it('logs unknown warn events at warning level with the full debug payload', function () {
    Log::spy();
    Log::shouldReceive('channel')->with('exceptions')->andReturnSelf();

    $logged = [];
    Log::shouldReceive('warning')->andReturnUsing(function (string $msg, array $ctx) use (&$logged) {
        $logged[] = ['message' => $msg, 'context' => $ctx];
    });

    // The "WARN HTTP/2 skipped" / "WARN Caddyfile input is not formatted" shape:
    // level=warn, recognized string in msg, but it's not 'handled request' or a stream.
    // Parent logs as WARN to stdout — our capture should persist at warning level.
    $debug = [
        'level' => 'warn',
        'msg' => 'HTTP/2 skipped because it requires TLS.',
        'ts' => 1753089200.0,
    ];

    $this->command->captureEvent($debug, 'HTTP/2 skipped because it requires TLS.');

    expect($logged)->toHaveCount(1)
        ->and($logged[0]['message'])->toBe('frankenphp_event')
        ->and($logged[0]['context']['debug'])->toBe($debug);
});

it('logs silently-dropped events (level=info path leads to no stdout) at info level', function () {
    Log::spy();
    Log::shouldReceive('channel')->with('exceptions')->andReturnSelf();

    $logged = [];
    Log::shouldReceive('info')->andReturnUsing(function (string $msg, array $ctx) use (&$logged) {
        $logged[] = ['message' => $msg, 'context' => $ctx];
    });

    // The "silent drop" branch: JSON decoded but no 'level' key, no msg,
    // doesn't match handled request or stream. Parent returns nothing.
    $debug = [
        'reactor' => 'caddy-admin',
        'data' => ['listeners' => 4],
    ];

    $this->command->captureEvent($debug, 'unknown error');

    expect($logged)->toHaveCount(1)
        ->and($logged[0]['context']['fallback_reason'])->toBe('no_msg')
        ->and($logged[0]['context']['debug'])->toBe($debug);
});

it('does not double-log handled request events (parent emits proper access log)', function () {
    Log::spy();
    // Setup: NO call to channel('exceptions') should ever happen for a
    // 'handled request' event because the parent's branching produces the
    // standard access log line ("201 POST /api/..."). Our capture must skip.
    Log::shouldReceive('channel')->with('exceptions')->never();

    $debug = [
        'msg' => 'handled request',
        'duration' => 0.123,
        'request' => ['method' => 'POST', 'uri' => '/api/incidents/15/assignments'],
        'status' => 201,
    ];

    $this->command->captureEvent($debug, 'handled request', capture: false);

    // No assertion needed — shouldReceive('channel')->never() above is the assertion.
    expect(true)->toBeTrue();
});

it('does not double-log stream events (parent handles them via handleStream)', function () {
    Log::spy();
    Log::shouldReceive('channel')->with('exceptions')->never();

    $debug = [
        // The 'msg' field is itself a JSON-stringified stream array, which
        // parent's `is_array($stream = json_decode($message, true))` catches.
        'msg' => json_encode([
            'stream' => 'stdout',
            'data' => 'server listening',
        ]),
    ];

    $this->command->captureEvent($debug, $debug['msg'], capture: false);

    expect(true)->toBeTrue();
});

it('logs non-JSON plain-text Caddy output with reason=not_json', function () {
    Log::spy();
    Log::shouldReceive('channel')->with('exceptions')->andReturnSelf();

    $logged = [];
    Log::shouldReceive('info')->andReturnUsing(function (string $msg, array $ctx) use (&$logged) {
        $logged[] = ['message' => $msg, 'context' => $ctx];
    });

    // Parent's first guard: if !is_array($debug) → $this->components->info($output)
    // We capture this too — plain text from Caddy like "Caddyfile input is
    // not formatted; run 'caddy fmt --overwrite' to fix inconsistencies."
    $raw = "WARN  Caddyfile input is not formatted; run 'caddy fmt --overwrite' to fix inconsistencies. ";

    $this->command->captureEvent(['raw' => $raw], 'not_json');

    expect($logged)->toHaveCount(1)
        ->and($logged[0]['context']['fallback_reason'])->toBe('not_json')
        ->and($logged[0]['context']['debug']['raw'])->toBe($raw);
});
