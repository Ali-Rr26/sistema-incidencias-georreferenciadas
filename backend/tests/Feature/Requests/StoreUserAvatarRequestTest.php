<?php

declare(strict_types=1);

use App\Domains\Users\Http\Requests\StoreUserAvatarRequest;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    DB::table('roles')->insert(['id' => 1, 'name' => 'admin_sistema']);
    DB::table('roles')->insert(['id' => 2, 'name' => 'usuario']);
});

it('validates avatar as required image file', function (): void {
    $user = User::factory()->create(['role_id' => 1]);
    $request = new StoreUserAvatarRequest;

    $file = UploadedFile::fake()->image('avatar.jpg', 512, 512);
    $request->files->set('avatar', $file);
    $request->merge([]);

    $validator = validator($request->all(), $request->rules());

    expect($validator->passes())->toBeTrue();
});

it('rejects missing avatar file', function (): void {
    $user = User::factory()->create(['role_id' => 1]);
    $request = new StoreUserAvatarRequest;
    $request->merge([]);

    $validator = validator($request->all(), $request->rules());

    expect($validator->fails())->toBeTrue();
    expect($validator->errors()->has('avatar'))->toBeTrue();
});

it('rejects oversized avatar file', function (): void {
    $user = User::factory()->create(['role_id' => 1]);
    $request = new StoreUserAvatarRequest;

    $file = UploadedFile::fake()->image('avatar.jpg')->size(801); // 801 KB (over 800 KB cap)
    $request->files->set('avatar', $file);
    $request->merge([]);

    $validator = validator($request->all(), $request->rules());

    expect($validator->fails())->toBeTrue();
    expect($validator->errors()->has('avatar'))->toBeTrue();
});

it('accepts avatar file at exactly 800KB', function (): void {
    $user = User::factory()->create(['role_id' => 1]);
    $request = new StoreUserAvatarRequest;

    $file = UploadedFile::fake()->image('avatar.jpg')->size(800); // 800 KB (at cap)
    $request->files->set('avatar', $file);
    $request->merge([]);

    $validator = validator($request->all(), $request->rules());

    expect($validator->passes())->toBeTrue();
});

it('rejects wrong MIME type avatar', function (): void {
    $user = User::factory()->create(['role_id' => 1]);
    $request = new StoreUserAvatarRequest;

    $file = UploadedFile::fake()->create('avatar.gif', 100, 'image/gif');
    $request->files->set('avatar', $file);
    $request->merge([]);

    $validator = validator($request->all(), $request->rules());

    expect($validator->fails())->toBeTrue();
    expect($validator->errors()->has('avatar'))->toBeTrue();
});

it('accepts valid PNG avatar', function (): void {
    $user = User::factory()->create(['role_id' => 1]);
    $request = new StoreUserAvatarRequest;

    $file = UploadedFile::fake()->image('avatar.png', 512, 512);
    $request->files->set('avatar', $file);
    $request->merge([]);

    $validator = validator($request->all(), $request->rules());

    expect($validator->passes())->toBeTrue();
});
