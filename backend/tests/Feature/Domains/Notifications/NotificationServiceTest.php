<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Jobs\SendIncidentNotificationJob;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Notifications\Services\NotificationService;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Mockery\MockInterface;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema'],
    ]);

    $this->user = User::factory()->create(['role_id' => 1]);

    $location = Location::create(['name' => 'HQ', 'level' => 'city']);
    $org = Organization::create(['name' => 'Test Org', 'location_id' => $location->id]);
    $category = IncidentCategory::create(['name' => 'General', 'organization_id' => $org->id]);

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

it('publishes a private update to the user\'s Mercure topic when a notification is created', function (): void {
    $this->mock(HubInterface::class, function (MockInterface $mock): void {
        $mock->shouldReceive('publish')
            ->once()
            ->withArgs(function (Update $update): bool {
                expect($update->getTopics())->toBe([NotificationService::topicFor($this->user->id)]);
                expect($update->isPrivate())->toBeTrue();
                expect($update->getData())->toContain('Nueva notificación de prueba');

                return true;
            });
    });

    $service = app(NotificationService::class);
    $notification = $service->notify(
        $this->user,
        NotificationType::Legacy,
        'Nueva notificación de prueba',
        $this->incident->id,
    );

    expect($notification)->not->toBeNull();
    expect(Notification::count())->toBe(1);
});

it('still creates the notification even if the Mercure hub is unreachable', function (): void {
    $this->mock(HubInterface::class, function (MockInterface $mock): void {
        $mock->shouldReceive('publish')
            ->once()
            ->andThrow(new RuntimeException('hub unreachable'));
    });

    $service = app(NotificationService::class);
    $notification = $service->notify(
        $this->user,
        NotificationType::Legacy,
        'No debe perderse aunque falle el hub',
        $this->incident->id,
    );

    expect($notification)->not->toBeNull();
    expect(Notification::count())->toBe(1);
});

it('does not publish a second update for a deduplicated notification', function (): void {
    $this->mock(HubInterface::class, function (MockInterface $mock): void {
        $mock->shouldReceive('publish')->once();
    });

    $service = app(NotificationService::class);
    $service->notify($this->user, NotificationType::Legacy, 'Original', $this->incident->id);
    $second = $service->notify($this->user, NotificationType::Legacy, 'Original', $this->incident->id);

    expect($second)->toBeNull();
    expect(Notification::count())->toBe(1);
});

it('creates at most one notification when the queued job is retried', function (): void {
    $this->mock(HubInterface::class, function (MockInterface $mock): void {
        $mock->shouldReceive('publish')->once();
    });

    $job = new SendIncidentNotificationJob(
        $this->user->id,
        $this->incident->id,
        NotificationType::Claim->value,
        'Tu incidencia fue reclamada.',
        ['claimed_by' => 15],
    );

    $job->handle(app(NotificationService::class));
    $job->handle(app(NotificationService::class));

    expect(Notification::query()->where('type', NotificationType::Claim->value)->count())->toBe(1);
});
