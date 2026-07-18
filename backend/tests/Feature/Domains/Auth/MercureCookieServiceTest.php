<?php

declare(strict_types=1);

use App\Domains\Auth\Mercure\Services\MercureCookieService;
use App\Domains\Roles\Enums\UserRole;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Token\Parser;

uses(RefreshDatabase::class);

/**
 * Pins the MercureCookieService contract — the cookie name, TTL claim
 * shape, and security flags — so the two controllers that delegate to
 * it don't drift over time. Any change to the topic derivation
 * (currently `user:{id}:notifications`), TTL window, or cookie flags
 * must update these tests in lockstep.
 */
beforeEach(function (): void {
    Role::firstOrCreate(['id' => 1, 'name' => UserRole::AdminSistema->value]);
    Role::firstOrCreate(['id' => 2, 'name' => UserRole::OperadorOrganizacion->value]);
    Role::firstOrCreate(['id' => 5, 'name' => UserRole::Usuario->value]);
});

it('builds cookie with mercure.subscribe claim containing exactly the user topic', function (): void {
    $user = User::factory()->create(['role_id' => 2]);

    $cookie = (new MercureCookieService)->build($user);

    expect($cookie->getName())->toBe('mercureAuthorization');

    $parser = new Parser(new JoseEncoder);
    $claims = $parser->parse($cookie->getValue())->claims()->all();
    expect($claims['mercure']['subscribe'])
        ->toBe([sprintf('user:%d:notifications', $user->id)]);
});

it('uses the configured cookie ttl in minutes as expiration', function (): void {
    config(['mercure.cookie.ttl_minutes' => 5]);

    $beforeBuild = time();
    $user = User::factory()->create();
    $cookie = (new MercureCookieService)->build($user);
    $afterBuild = time();

    expect($cookie->getExpiresTime())->toBeGreaterThanOrEqual($beforeBuild + (5 * 60))
        ->and($cookie->getExpiresTime())->toBeLessThanOrEqual($afterBuild + (5 * 60));
});

it('marks the cookie HttpOnly, SameSite=Strict, path=/', function (): void {
    $user = User::factory()->create();
    $cookie = (new MercureCookieService)->build($user);

    expect($cookie->isHttpOnly())->toBeTrue()
        ->and(strtolower($cookie->getSameSite() ?? ''))->toBe('strict')
        ->and($cookie->getPath())->toBe('/');
});

it('expire() returns the same cookie name with an already-past expiration (for logout)', function (): void {
    $cookie = (new MercureCookieService)->expire();

    expect($cookie->getName())->toBe('mercureAuthorization')
        ->and($cookie->getExpiresTime())->toBeLessThanOrEqual(time());
});

it('expire() honors overridden mercure.cookie.name and path so logout can actually delete the cookie', function (): void {
    // Regression: previously expire() hardcoded self::COOKIE_NAME / COOKIE_PATH,
    // so when deploys overrode the cookie name (e.g. per-tenant branding or
    // a path-scoped admin cookie) the browser would not match the
    // Set-Cookie on logout and the original would survive its full TTL.
    config(['mercure.cookie.name' => 'tenant-mercure-auth']);
    config(['mercure.cookie.path' => '/admin']);

    $cookie = (new MercureCookieService)->expire();

    expect($cookie->getName())->toBe('tenant-mercure-auth')
        ->and($cookie->getPath())->toBe('/admin')
        ->and($cookie->getExpiresTime())->toBeLessThanOrEqual(time());
});

it('build() and expire() agree on name and path so logout actually clears the cookie the browser holds', function (): void {
    // The browser deletes a cookie only when the new Set-Cookie matches
    // the original name + path + domain. If build() sets cookie X with
    // path /A and expire() tries to clear cookie X with path /, the
    // browser keeps the original. This test pins that name+path stay
    // in sync no matter what config values are.
    config(['mercure.cookie.name' => 'my-mercure', 'mercure.cookie.path' => '/restricted']);

    $service = new MercureCookieService;
    $built = $service->build(User::factory()->create());
    $expired = $service->expire();

    expect($built->getName())->toBe($expired->getName())
        ->and($built->getPath())->toBe($expired->getPath());
});
