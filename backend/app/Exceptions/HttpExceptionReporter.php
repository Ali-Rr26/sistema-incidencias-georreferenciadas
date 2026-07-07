<?php

declare(strict_types=1);

namespace App\Exceptions;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Global HTTP exception reporter.
 *
 * Translates a Throwable plus its Request into a single structured log record
 * pushed through the dedicated `exceptions` Monolog channel.
 */
final class HttpExceptionReporter
{
    /** Schema keys, in order, exactly as logged. */
    public const CONTEXT_KEYS = [
        'event',
        'request_id',
        'trace_id',
        'user_id',
        'route',
        'method',
        'status',
        'level',
        'exception_class',
        'message',
        'file',
        'line',
    ];

    /** Maximum length of an upstream-provided X-Request-ID header. */
    public const REQUEST_ID_MAX_LENGTH = 128;

    public function report(Throwable $e, Request $request): void
    {
        $status = $this->statusFromThrowable($e);
        $level = $this->levelForStatus($e);
        $context = $this->contextFor($e, $request);

        $channel = Log::channel('exceptions');

        if ($level === 'warning') {
            $channel->warning('http_exception', $context);
        } else {
            $channel->error('http_exception', $context);
        }
    }

    /**
     * Map a Throwable to a Monolog level name.
     *
     * - 5xx or non-HTTP exceptions → 'error'
     * - 4xx → 'warning'
     * - anything else (incl. status 0) → 'error'
     */
    private function levelForStatus(Throwable $e): string
    {
        $status = $this->statusFromThrowable($e);

        if ($status >= 400 && $status < 500) {
            return 'warning';
        }

        return 'error';
    }

    /**
     * Resolve the HTTP status code for a Throwable.
     *
     * Returns the HttpExceptionInterface status code when available,
     * otherwise defaults to 500.
     */
    private function statusFromThrowable(Throwable $e): int
    {
        if ($e instanceof HttpExceptionInterface) {
            $code = $e->getStatusCode();

            return ($code >= 100 && $code < 600) ? $code : 500;
        }

        return 500;
    }

    private function requestId(Request $request): string
    {
        $header = $request->header('X-Request-ID');

        if ($header === null) {
            return (string) Str::uuid();
        }

        $trimmed = trim((string) $header);

        if ($trimmed === '' || mb_strlen($trimmed) > self::REQUEST_ID_MAX_LENGTH) {
            return (string) Str::uuid();
        }

        return $trimmed;
    }

    private function traceId(): string
    {
        return (string) Str::uuid();
    }

    /**
     * Build the 12-key structured context array.
     *
     * @return array<string,mixed>
     */
    private function contextFor(Throwable $e, Request $request): array
    {
        $user = $request->user();

        return [
            'event' => 'http_exception',
            'request_id' => $this->requestId($request),
            'trace_id' => $this->traceId(),
            'user_id' => $user !== null ? $user->getAuthIdentifier() : null,
            'route' => $request->path(),
            'method' => $request->method(),
            'status' => $this->statusFromThrowable($e),
            'level' => $this->levelForStatus($e),
            'exception_class' => $e::class,
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ];
    }
}