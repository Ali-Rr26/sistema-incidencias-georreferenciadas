<?php

declare(strict_types=1);

use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    DB::table('roles')->insert(['id' => 1, 'name' => 'admin_sistema']);
    Storage::fake('s3');
    $this->withoutMiddleware(JwtAuthenticate::class);
});

it('DELETE /api/users/{user}/avatar removes avatar and returns 204', function (): void {
    $user = User::factory()->create([
        'profile_image_path' => 'users/1/to-delete.webp',
    ]);
    Storage::disk('s3')->put('users/1/to-delete.webp', 'content to delete');

    $response = $this->actingAs($user)->deleteJson("/api/users/{$user->id}/avatar");

    $response->assertStatus(204);
    expect($user->fresh()->profile_image_path)->toBeNull();
    Storage::disk('s3')->assertMissing('users/1/to-delete.webp');
});

it('DELETE /api/users/{user}/avatar S3 delete failure still clears DB and logs warning (SCEN-PIU-Delete-002)', function (): void {
    $user = User::factory()->create([
        'profile_image_path' => 'users/1/existing.webp',
    ]);
    Storage::disk('s3')->put('users/1/existing.webp', 'content to delete');

    // Mock S3 disk: delete() throws on the existing path but put()/exists() delegate to fake.
    $fakeDisk = Storage::disk('s3');
    $mockDisk = Mockery::mock($fakeDisk);
    $mockDisk->shouldReceive('delete')
        ->with('users/1/existing.webp')
        ->andThrow(new RuntimeException('S3 delete failed'));
    $mockDisk->shouldReceive('delete')
        ->andReturnUsing(fn ($path) => $fakeDisk->delete($path));
    $mockDisk->shouldReceive('put')->andReturnUsing(fn ($k, $d) => $fakeDisk->put($k, $d));
    $mockDisk->shouldReceive('exists')->andReturnUsing(fn ($k) => $fakeDisk->exists($k));
    $mockDisk->shouldReceive('assertMissing')->andReturnUsing(fn ($k) => $fakeDisk->assertMissing($k));

    Storage::shouldReceive('disk')
        ->with('s3')
        ->andReturn($mockDisk);

    Log::spy();

    $response = $this->actingAs($user)->deleteJson("/api/users/{$user->id}/avatar");

    // Warn-and-continue: DB is cleared, 204 is returned despite S3 failure.
    $response->assertStatus(204);
    expect($user->fresh()->profile_image_path)->toBeNull();

    // Warning must be logged with the failure context.
    Log::shouldHaveReceived('warning')
        ->withArgs(fn ($message, $context) => str_contains($message, 'Failed to delete image file from S3')
            && ($context['path'] ?? null) === 'users/1/existing.webp');
});
