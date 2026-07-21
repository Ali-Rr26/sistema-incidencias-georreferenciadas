<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Octane\Commands\StartFrankenPhpCommand as BaseStartFrankenPhpCommand;
use Tests\Feature\Console\StartFrankenPhpCommandTest;

/**
 * Drops the Octane `octane:frankenphp` command into the same exposed name
 * (PHP's `AsCommand` attribute is inherited) but routes every
 * unhandled-by-parent stderr/stdout line from FrankenPHP/Caddy through
 * `Log::channel('exceptions')` with the FULL Caddy debug payload.
 *
 * ## Why
 *
 * `vendor/laravel/octane/src/Commands/StartFrankenPhpCommand.php:318`
 * contains the fallback `$message = $debug['msg'] ?? 'unknown error';`. When
 * Caddy emits a JSON event without a `msg` field (admin events, file-watcher
 * reloads, TLS warnings, Mercure subscriber reconnects, etc.) the parent
 * command either silently drops the line or emits the bare string
 * `ERROR  unknown error.` — both useless for post-mortem debugging.
 *
 * This subclass preserves every existing branch (handled-request access log,
 * stream forwarding, explicit `components->warn`/`error`) but ADDS a parallel
 * `Log::channel('exceptions')` write for the branches that lose context:
 * the "unknown error" fallback, the silent-drop tail (`level=info` or no
 * `level` key), and the request-timeout `exit_status=255` swallow.
 *
 * Net effect in `docker compose logs backend`:
 *
 *   Before (Octane default):
 *     ERROR  unknown error.
 *     ERROR  unknown error.
 *     ERROR  unknown error.
 *
 *   After (this command):
 *     ERROR  unknown error.
 *     {"message":"frankenphp_event","context":{"event":"frankenphp_event",
 *       "fallback_reason":"no_msg","debug":<full caddy json>}, ...}
 *     ERROR  unknown error.
 *     {"message":"frankenphp_event","context":{...}, ...}
 *
 * — same stdout noise (no behavior regression) but the original Caddy event
 * is now grep-able by event name, level, or any debug field. Filter:
 *
 *     docker compose logs backend 2>&1 | grep '"event":"frankenphp_event"'
 *
 * Class name kept as `StartFrankenPhpCommand` so `app/Console/Commands`
 * auto-discovery (Laravel 11+) finds it. Signature and `#[AsCommand]` are
 * inherited unchanged from the parent — this replaces Octane's command in
 * place rather than registering a new one.
 *
 * entrypoint.sh must call `php artisan octane:frankenphp ...` instead of
 * `php artisan octane:start --server=frankenphp ...`.
 */
class StartFrankenPhpCommand extends BaseStartFrankenPhpCommand
{
    /**
     * Capture one parsed FrankenPHP/Caddy event line into the structured
     * `exceptions` log channel before the parent either silently drops it or
     * emits the cryptic "ERROR unknown error." string.
     *
     * Public for testability — tested directly in
     * {@see StartFrankenPhpCommandTest}.
     *
     * @param  array<string,mixed>  $debug  The decoded JSON, or `['raw' => $output]`
     *                                      for non-JSON lines. Caller responsibility.
     * @param  string  $message  The `msg` Caddy field if present, else 'unknown error'.
     *                           Pass a sentinel like 'not_json' for the non-JSON branch.
     * @param  bool  $capture  When false, skip persistence entirely. Used by
     *                         branches where parent already produces correct,
     *                         structured output (handled-request access log,
     *                         handleStream forwarder) and a parallel log would
     *                         double the noise.
     */
    public function captureEvent(array $debug, string $message, bool $capture = true): void
    {
        if (! $capture) {
            return;
        }

        $fallbackReason = match (true) {
            $message === 'not_json' => 'not_json',
            $message === 'unknown error' => 'no_msg',
            default => null,
        };

        $level = $this->resolveLogLevel($debug);

        $channel = Log::channel('exceptions');
        $payload = [
            'event' => 'frankenphp_event',
            'fallback_reason' => $fallbackReason,
            'msg' => $message,
            'debug' => $debug,
        ];

        match ($level) {
            'warning' => $channel->warning('frankenphp_event', $payload),
            'error' => $channel->error('frankenphp_event', $payload),
            default => $channel->info('frankenphp_event', $payload),
        };
    }

    /**
     * Mirror Octane's level-routing: level=warn → warning, level !== info
     * (and not warn) → error, level=info or no level → silent (info in our
     * channel so the data still lands somewhere searchable).
     *
     * @param  array<string,mixed>  $debug
     */
    private function resolveLogLevel(array $debug): string
    {
        if (! isset($debug['level'])) {
            return $this->isTimeout($debug) ? 'error' : 'info';
        }

        return match ($debug['level']) {
            'warn' => 'warning',
            'info' => 'info',
            default => 'error',
        };
    }

    /**
     * @param  array<string,mixed>  $debug
     */
    private function isTimeout(array $debug): bool
    {
        return isset($debug['exit_status']) && $debug['exit_status'] === 255;
    }

    /**
     * Override the parent's writeServerOutput to capture-then-defer every
     * processed line. The output channels (`components->info/warn/error`,
     * `requestInfo`, `handleStream`) are kept identical to the parent so
     * nothing in deploy-time observability (stdout access log, error stream)
     * changes — we only ADD structured persistence.
     */
    protected function writeServerOutput($server): void
    {
        [$_, $errorOutput] = $this->getServerOutput($server);

        $errorOutput = Str::of($errorOutput)
            ->explode("\n")
            ->filter()
            ->values();

        if ($this->option('log-level') !== null) {
            // User explicitly asked for raw — don't double-log, they want the noise.
            $errorOutput->each(fn ($output) => $this->raw($output));

            return;
        }

        $errorOutput->each(function ($output): void {
            $debug = json_decode($output, true);

            // Branch 1: non-JSON plain text from Caddy (e.g. "Caddyfile input
            // is not formatted"). Parent emits via components->info(); we
            // additionally persist the raw line so it's searchable.
            if (! is_array($debug)) {
                $this->captureEvent(['raw' => $output], 'not_json');
                $this->components->info($output);

                return;
            }

            $message = $debug['msg'] ?? 'unknown error';

            // Branch 2: msg is a JSON-stringified stream array. Parent's
            // `handleStream()` already produces structured output — skip our
            // capture to avoid duplicating.
            if (is_array($stream = json_decode($message, true))) {
                $this->captureEvent($debug, $message, false);
                $this->handleStream($stream);

                return;
            }

            // Branch 3: handled-request event. Parent's `requestInfo()`
            // already produces the standard access log line.
            if ($message === 'handled request') {
                $this->captureEvent($debug, $message, false);
                $this->emitHandledRequestAccessLog($debug);

                return;
            }

            // Branch 4: level=warn event. Parent emits components->warn with
            // $message (often the literal "unknown error" if msg was absent).
            // We persist the full payload at warning level.
            if (isset($debug['level']) && $debug['level'] === 'warn') {
                $this->captureEvent($debug, $message);
                $this->components->warn($message);

                return;
            }

            // Branch 5: level is set to something not-warn and not-info
            // (typically 'error' / 'panic' / 'debug'). Parent either
            // silently drops (exit_status=255 timeout) or emits
            // components->error.
            if (isset($debug['level']) && $debug['level'] !== 'info') {
                if ($this->isTimeout($debug)) {
                    $this->captureEvent($debug, $message);

                    return;
                }
                $this->captureEvent($debug, $message);
                $this->components->error($message);

                return;
            }

            // Branch 6 (silent drop): JSON decoded but no `level` key, or
            // level=info. Parent emits nothing. Capture at info so the data
            // still lives somewhere.
            $this->captureEvent($debug, $message);
        });
    }

    /**
     * Replicates the parent's access-log branch (octane:start lines 324-348)
     * unchanged so `docker compose logs backend` keeps its access-log format
     * ("201    POST /api/..."). Extracted only so writeServerOutput doesn't
     * drift from the parent's subtle destructuring (which has a known
     * `'request' => $request` overwrite of the earlier `'request' => [...]`
     * key — left intact here as it's an upstream bug, not our concern).
     *
     * @param  array<string,mixed>  $debug
     */
    private function emitHandledRequestAccessLog(array $debug): void
    {
        if (! $this->laravel->isLocal()) {
            return;
        }

        [
            'duration' => $duration,
            'request' => [
                'method' => $method,
                'uri' => $url,
            ],
            'status' => $statusCode,
            'request' => $request,
        ] = $debug;

        if (str_starts_with((string) $url, '/.well-known/mercure')) {
            return;
        }

        $this->requestInfo([
            'method' => $method,
            'url' => $url,
            'statusCode' => $statusCode,
            'duration' => (float) $duration * 1000,
        ]);
    }
}
