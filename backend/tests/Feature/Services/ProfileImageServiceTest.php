<?php

declare(strict_types=1);

use App\Domains\Users\Models\User;
use App\Domains\Users\Services\ProfileImageService;
use App\Storage\ImageProcessor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    DB::table('roles')->insert(['id' => 1, 'name' => 'admin_sistema']);
    Storage::fake('s3');
    $this->service = new ProfileImageService(new ImageProcessor);
});

it('replaceAvatar deletes old file and stores new one', function (): void {
    $user = User::factory()->create([
        'profile_image_path' => 'users/1/old-uuid.webp',
    ]);
    Storage::disk('s3')->put('users/1/old-uuid.webp', 'old content');

    $filePath = __DIR__.'/../../fixtures/test-image.jpg';
    $file = new UploadedFile($filePath, 'test-image.jpg', 'image/jpeg', null, true);

    $newPath = $this->service->replaceAvatar($user, $file);

    expect($newPath)->toStartWith('users/1/')->toEndWith('.webp');
    expect($user->fresh()->profile_image_path)->toBe($newPath);
    Storage::disk('s3')->assertMissing('users/1/old-uuid.webp');
    Storage::disk('s3')->assertExists($newPath);
});

it('replaceAvatar with null existing path skips delete', function (): void {
    $user = User::factory()->create([
        'profile_image_path' => null,
    ]);

    $filePath = __DIR__.'/../../fixtures/test-image.jpg';
    $file = new UploadedFile($filePath, 'test-image.jpg', 'image/jpeg', null, true);

    $newPath = $this->service->replaceAvatar($user, $file);

    expect($newPath)->toStartWith('users/1/')->toEndWith('.webp');
    Storage::disk('s3')->assertExists($newPath);
});

it('removeAvatar deletes file and clears path', function (): void {
    $user = User::factory()->create([
        'profile_image_path' => 'users/1/to-delete.webp',
    ]);
    Storage::disk('s3')->put('users/1/to-delete.webp', 'content to delete');

    $this->service->removeAvatar($user);

    expect($user->fresh()->profile_image_path)->toBeNull();
    Storage::disk('s3')->assertMissing('users/1/to-delete.webp');
});

it('removeAvatar with null path is no-op', function (): void {
    $user = User::factory()->create([
        'profile_image_path' => null,
    ]);

    $this->service->removeAvatar($user);

    expect($user->fresh()->profile_image_path)->toBeNull();
});
