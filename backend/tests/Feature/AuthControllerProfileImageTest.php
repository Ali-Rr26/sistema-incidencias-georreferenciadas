<?php

declare(strict_types=1);

use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    DB::table('roles')->insert(['id' => 1, 'name' => 'admin_sistema']);
    Storage::fake('s3');
    $this->withoutMiddleware(JwtAuthenticate::class);
});

it('PUT /auth/profile multipart with avatar returns 200 and stores path', function (): void {
    $user = User::factory()->create(['profile_image_path' => null]);

    $file = UploadedFile::fake()->image('avatar.jpg', 512, 512);

    $response = $this->actingAs($user)->put('/api/auth/profile', [
        'first_name' => 'Ana',
        'avatar' => $file,
    ]);

    $response->assertStatus(200);
    $response->assertJsonStructure(['id', 'email', 'first_name', 'profile_image_path']);
    $response->assertJsonPath('first_name', 'Ana');
    $path = $response->json('profile_image_path');
    expect($path)->toStartWith('users/')->toEndWith('.webp');
    Storage::disk('s3')->assertExists($path);
});

it('PUT /auth/profile JSON text-only preserves existing avatar (SCEN-7 regression)', function (): void {
    $user = User::factory()->create([
        'profile_image_path' => 'users/1/existing.webp',
        'first_name' => 'Old',
    ]);
    Storage::disk('s3')->put('users/1/existing.webp', 'existing avatar');

    $response = $this->actingAs($user)->putJson('/api/auth/profile', [
        'first_name' => 'Ana',
    ]);

    $response->assertStatus(200);
    $response->assertJsonPath('first_name', 'Ana');
    // profile_image_path must NOT change (SCEN-7.5 regression)
    $response->assertJsonPath('profile_image_path', 'users/1/existing.webp');
});

it('PUT /auth/profile multipart without avatar updates text only', function (): void {
    $user = User::factory()->create([
        'first_name' => 'Old',
        'profile_image_path' => null,
    ]);

    $response = $this->actingAs($user)->put('/api/auth/profile', [
        'first_name' => 'Ana',
    ]);

    $response->assertStatus(200);
    $response->assertJsonPath('first_name', 'Ana');
});

it('PUT /auth/profile without auth returns 403 (Gate denies null user)', function (): void {
    // Note: without middleware, unauthenticated requests reach the controller/form-request
    // but Gate::authorize('update', null) returns 403. This is the correct
    // behavior when middleware auth is disabled.
    $response = $this->putJson('/api/auth/profile', [
        'first_name' => 'Ana',
    ]);

    $response->assertStatus(403);
});

it('PUT /auth/profile with oversized avatar returns 422', function (): void {
    $user = User::factory()->create();

    $file = UploadedFile::fake()->image('avatar.jpg')->size(6000);

    $response = $this->actingAs($user)->put('/api/auth/profile', [
        'first_name' => 'Ana',
        'avatar' => $file,
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['avatar']);
});

it('PUT /auth/profile with GIF avatar returns 422', function (): void {
    $user = User::factory()->create();

    $file = UploadedFile::fake()->create('avatar.gif', 100, 'image/gif');

    $response = $this->actingAs($user)->put('/api/auth/profile', [
        'first_name' => 'Ana',
        'avatar' => $file,
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['avatar']);
});

it('PUT /auth/profile replaces existing avatar when uploading new one', function (): void {
    $user = User::factory()->create([
        'profile_image_path' => 'users/1/old.webp',
    ]);
    Storage::disk('s3')->put('users/1/old.webp', 'old content');

    $file = UploadedFile::fake()->image('new-avatar.jpg', 512, 512);

    $response = $this->actingAs($user)->put('/api/auth/profile', [
        'first_name' => 'Ana',
        'avatar' => $file,
    ]);

    $response->assertStatus(200);
    $newPath = $response->json('profile_image_path');
    expect($newPath)->not->toBe('users/1/old.webp');
    Storage::disk('s3')->assertMissing('users/1/old.webp');
    Storage::disk('s3')->assertExists($newPath);
});
