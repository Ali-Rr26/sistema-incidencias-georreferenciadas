<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json([
    'app' => 'Sistema Incidencias API',
    'version' => '1.0',
]));
