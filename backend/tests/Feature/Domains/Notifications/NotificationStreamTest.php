<?php

declare(strict_types=1);

use App\Domains\Users\Models\User;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Incidents\Models\Incident;
use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Auth\Services\JwtService;
use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Sessions\Models\Session;
use App\Domains\Sessions\Repositories\SessionRepository;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Mockery\MockInterface;
use Symfony\Component\HttpFoundation\StreamedResponse;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema'],
    ]);

    $this->user = User::factory()->create(['role_id' => 1]);

    $location = Location::create(['name' => 'HQ', 'level' => 'city']);
    $org = Organization::create([
        'name' => 'Test Org',
        'location_id' => $location->id,
    ]);
    $category = IncidentCategory::create([
        'name' => 'General',
        'organization_id' => $org->id,
    ]);

    $this->incident = Incident::create([
        'title' => 'Test Incident',
        'incident_category_id' => $category->id,
        'user_id' => $this->user->id,
        'location_id' => $location->id,
        'organization_id' => $org->id,
        'status' => 'pending',
        'priority' => 'medium',
    ]);
});

it('returns a streamed response with correct headers for notification stream', function (): void {
    $response = $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->get('/api/notifications/stream');

    $response->assertOk();
    $response->assertHeader('Content-Type', 'text/event-stream; charset=utf-8');
    $response->assertHeader('Cache-Control', 'no-cache, private');
    $response->assertHeader('Connection', 'keep-alive');

    expect($response->baseResponse)->toBeInstanceOf(StreamedResponse::class);
});

it('streams notifications for the authenticated user', function (): void {
    $notification = Notification::create([
        'user_id' => $this->user->id,
        'incident_id' => $this->incident->id,
        'type' => \App\Domains\Notifications\Enums\NotificationType::Legacy,
        'message' => 'A new incident has been created.',
        'read' => false,
    ]);

    expect(Notification::count())->toBe(1);

    $response = $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->get('/api/notifications/stream');

    $response->assertOk();

    $callback = $response->baseResponse->getCallback();
    ob_start();
    $callback();
    $content = ob_get_clean();

    expect($content)->toContain('data:');
    expect($content)->toContain('A new incident has been created.');
});

it('authenticates the stream via the access_token cookie alone (no Authorization header)', function (): void {
    $jwtService = $this->mock(JwtService::class);
    $jwtService->shouldReceive('validateAccessToken')
        ->once()
        ->with('cookie-token')
        ->andReturn([
            'sub' => (string) $this->user->id,
            'sid' => 'session-cookie-1',
            'email' => $this->user->email,
        ]);

    $session = new Session([
        'id' => 'session-cookie-1',
        'user_id' => $this->user->id,
        'refresh_token_hash' => 'hash',
        'ip_address' => null,
        'user_agent' => null,
        'is_revoked' => false,
        'expires_at' => Carbon::now()->addHour(),
    ]);
    $session->exists = true;

    $this->mock(SessionRepository::class, function (MockInterface $mock) use ($session): void {
        $mock->shouldReceive('findById')
            ->once()
            ->with('session-cookie-1')
            ->andReturn($session);
    });

    $response = $this->withUnencryptedCookie('access_token', 'cookie-token')
        ->get('/api/notifications/stream');

    $response->assertOk();
    expect($response->baseResponse)->toBeInstanceOf(StreamedResponse::class);
});
