<?php

declare(strict_types=1);

use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    DB::table('roles')->insert(['id' => 1, 'name' => 'admin_sistema']);
});

it('has profile_image_path column as nullable string after migration', function (): void {
    expect(Schema::getColumnListing('users'))->toContain('profile_image_path');

    // Nullable check via PRAGMA (SQLite)
    $columns = DB::select('PRAGMA table_info(users)');
    $col = collect($columns)->firstWhere('name', 'profile_image_path');

    expect($col)->not->toBeNull();
    expect((bool) $col->notnull)->toBeFalse(); // 0 = nullable
});

it('profile_image_path is settable via factory', function (): void {
    $user = User::factory()->create([
        'profile_image_path' => 'users/1/uuid-test.webp',
    ]);

    expect($user->profile_image_path)->toBe('users/1/uuid-test.webp');
    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'profile_image_path' => 'users/1/uuid-test.webp',
    ]);
});

it('profile_image_path can be null', function (): void {
    $user = User::factory()->create([
        'profile_image_path' => null,
    ]);

    expect($user->profile_image_path)->toBeNull();
});
