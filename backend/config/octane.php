<?php

use Laravel\Octane\Contracts\OperationTerminated;
use Laravel\Octane\Events\RequestHandled;
use Laravel\Octane\Events\RequestReceived;
use Laravel\Octane\Events\RequestTerminated;
use Laravel\Octane\Events\TaskReceived;
use Laravel\Octane\Events\TaskTerminated;
use Laravel\Octane\Events\TickReceived;
use Laravel\Octane\Events\TickTerminated;
use Laravel\Octane\Events\WorkerErrorOccurred;
use Laravel\Octane\Events\WorkerStarting;
use Laravel\Octane\Events\WorkerStopping;
use Laravel\Octane\Listeners\CloseMonologHandlers;
use Laravel\Octane\Listeners\EnsureUploadedFilesAreValid;
use Laravel\Octane\Listeners\EnsureUploadedFilesCanBeMoved;
use Laravel\Octane\Listeners\FlushOnce;
use Laravel\Octane\Listeners\FlushTemporaryContainerInstances;
use Laravel\Octane\Listeners\ReportException;
use Laravel\Octane\Listeners\StopWorkerIfNecessary;
use Laravel\Octane\Octane;

return [

    /*
    |--------------------------------------------------------------------------
    | Octane Server
    |--------------------------------------------------------------------------
    |
    | Swoole is the project standard. StreamedResponse works natively under
    | Swoole (vendor/laravel/octane/src/Swoole/SwooleClient.php uses
    | ob_start() + $swooleResponse->write()) without the buffering bug that
    | affected FrankenPHP and the Generator-refactor-only nature of
    | RoadRunner. See Issue #102 for the migration decision log.
    |
    */

    'server' => env('OCTANE_SERVER', 'swoole'),

    /*
    |--------------------------------------------------------------------------
    | Force HTTPS
    |--------------------------------------------------------------------------
    */

    'https' => env('OCTANE_HTTPS', false),

    /*
    |--------------------------------------------------------------------------
    | Octane Listeners
    |--------------------------------------------------------------------------
    */

    'listeners' => [
        WorkerStarting::class => [
            EnsureUploadedFilesAreValid::class,
            EnsureUploadedFilesCanBeMoved::class,
        ],

        RequestReceived::class => [
            ...Octane::prepareApplicationForNextOperation(),
            ...Octane::prepareApplicationForNextRequest(),
        ],

        RequestHandled::class => [],

        RequestTerminated::class => [],

        TaskReceived::class => [
            ...Octane::prepareApplicationForNextOperation(),
        ],

        TaskTerminated::class => [],

        TickReceived::class => [
            ...Octane::prepareApplicationForNextOperation(),
        ],

        TickTerminated::class => [],

        OperationTerminated::class => [
            FlushOnce::class,
            FlushTemporaryContainerInstances::class,
        ],

        WorkerErrorOccurred::class => [
            ReportException::class,
            StopWorkerIfNecessary::class,
        ],

        WorkerStopping::class => [
            CloseMonologHandlers::class,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Warm / Flush Bindings
    |--------------------------------------------------------------------------
    */

    'warm' => [
        ...Octane::defaultServicesToWarm(),
    ],

    'flush' => [
        //
    ],

    /*
    |--------------------------------------------------------------------------
    | Garbage Collection Threshold
    |--------------------------------------------------------------------------
    */

    'garbage' => 50,

    /*
    |--------------------------------------------------------------------------
    | Maximum Execution Time
    |--------------------------------------------------------------------------
    */

    'max_execution_time' => 30,

    /*
    |--------------------------------------------------------------------------
    | Mercure Hub
    |--------------------------------------------------------------------------
    |
    | Real-time notification push (the bell dropdown) is delivered via a
    | standalone Mercure hub (docker-compose service `mercure`) rather than
    | an in-process SSE loop on the PHP server. Trade-off documented in
    | Issue #102: reimplementing Mercure on top of Swoole's native SSE
    | would cost ~2-3 weeks (JWT topic ACL, connection map, history
    | replay, frontend EventSource) for ~5-30 ms of latency improvement.
    | Mercure handles all of that out of the box and stays in the stack.
    |
    | Swoole makes Mercure implementation-agnostic: Laravel talks to the
    | hub via HTTP through Symfony\Component\Mercure\HubInterface; the
    | Octane driver is irrelevant to the publish path. Subscribers are the
    | browser EventSource against config('mercure.hub.url'), independent of
    | the PHP runtime.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Swoole-specific options
    |--------------------------------------------------------------------------
    |
    | Mirroring the Octane defaults. enable_coroutine is required for any
    | future use of \Swoole\Coroutine\HTTP\Client or Octane::concurrently()
    | — the project doesn't currently exploit them, but turning the flag on
    | now keeps the door open without requiring another infra change.
    |
    */

    'swoole' => [
        'options' => [
            'enable_coroutine' => true,
            'open_http2_protocol' => false,
            'open_websocket_protocol' => false,
            'task_worker_num' => 2,
        ],
        'max_request' => 500,
        'task_max_request' => 100,
        'watch' => false,
        'memory' => 256,
    ],

    // Mercure config now lives in config/mercure.php. See
    // docs/Security/secret-rotation.md for rotation guidance.

];
