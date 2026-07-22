<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Prevent clickjacking attacks
        $response->header('X-Frame-Options', 'DENY');

        // Prevent MIME sniffing
        $response->header('X-Content-Type-Options', 'nosniff');

        // Force HTTPS (1 year + subdomains)
        $response->header(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains; preload'
        );

        // Content Security Policy
        $response->header(
            'Content-Security-Policy',
            "default-src 'self'; " .
            "script-src 'self' 'unsafe-inline' https://unpkg.com; " .
            "style-src 'self' 'unsafe-inline' https://unpkg.com; " .
            "img-src 'self' data: https:; " .
            "font-src 'self' data: https://unpkg.com; " .
            "connect-src 'self' http://localhost:8000; " .
            "frame-ancestors 'none';"
        );

        // Referrer-Policy
        $response->header('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Permissions-Policy (formerly Feature-Policy)
        $response->header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

        return $response;
    }
}