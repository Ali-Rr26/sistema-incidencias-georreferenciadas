<?php

use App\Storage\StorageProxyController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json([
    'app' => 'Sistema Incidencias API',
    'version' => '1.0',
]));

/**
 * Storage proxy — sirve archivos desde RustFS con Cache-Control: immutable.
 *
 * Las URLs son estables porque el path contiene un UUID.
 * El key de S3 se codifica con "--" en vez de "/" para la URL.
 * Ej: /storage/images--42--uuid--jpg → key: images/42/uuid.jpg
 */
Route::get('/storage/{path}', [StorageProxyController::class, 'serve'])
    ->where('path', '.*')
    ->withoutMiddleware([
        \Illuminate\Cookie\Middleware\EncryptCookies::class,
        \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
        \Illuminate\Session\Middleware\StartSession::class,
        \Illuminate\View\Middleware\ShareErrorsFromSession::class,
        \Illuminate\Foundation\Http\Middleware\PreventRequestForgery::class,
    ]);
