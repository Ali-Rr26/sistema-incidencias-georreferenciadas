<?php

declare(strict_types=1);

use App\Domains\Auth\Local\Http\Requests\UpdateProfileRequest;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    DB::table('roles')->insert(['id' => 1, 'name' => 'admin_sistema']);
});

it('JSON request with text-only fields validates successfully', function (): void {
    $user = User::factory()->create();
    $request = new UpdateProfileRequest;
    $request->replace(['first_name' => 'Ana', 'last_name' => 'García', 'phone' => '099123456']);

    $validator = validator($request->all(), $request->rules());

    expect($validator->passes())->toBeTrue();
});

it('JSON request does NOT trigger avatar file validation', function (): void {
    $user = User::factory()->create();
    $request = new UpdateProfileRequest;
    // Only text fields present (no avatar key)
    $request->replace([
        'first_name' => 'Ana',
        'last_name' => 'García',
        'phone' => null,
        'password' => null,
    ]);

    $validator = validator($request->all(), $request->rules());

    expect($validator->passes())->toBeTrue();
    expect($validator->errors()->has('avatar'))->toBeFalse();
});

it('multipart request with valid avatar passes file validation', function (): void {
    $user = User::factory()->create();
    $request = new UpdateProfileRequest;

    $file = UploadedFile::fake()->image('avatar.jpg', 512, 512);

    $request->merge([
        'first_name' => 'Ana',
        'last_name' => 'García',
    ]);
    $request->files->set('avatar', $file);

    $validator = validator($request->all(), $request->rules());

    expect($validator->passes())->toBeTrue();
});

it('avatar file over 800KB is rejected', function (): void {
    $user = User::factory()->create();
    $request = new UpdateProfileRequest;

    $file = UploadedFile::fake()->image('avatar.jpg')->size(801); // 801KB

    $request->merge(['first_name' => 'Ana']);
    $request->files->set('avatar', $file);

    $validator = validator($request->all(), $request->rules());

    expect($validator->fails())->toBeTrue();
    expect($validator->errors()->has('avatar'))->toBeTrue();
});

it('avatar file at exactly 800KB is accepted', function (): void {
    $user = User::factory()->create();
    $request = new UpdateProfileRequest;

    $file = UploadedFile::fake()->image('avatar.jpg')->size(800); // 800KB

    $request->merge(['first_name' => 'Ana']);
    $request->files->set('avatar', $file);

    $validator = validator($request->all(), $request->rules());

    expect($validator->passes())->toBeTrue();
});

it('avatar file with wrong MIME is rejected', function (): void {
    $user = User::factory()->create();
    $request = new UpdateProfileRequest;

    $file = UploadedFile::fake()->create('avatar.gif', 100, 'image/gif');

    $request->merge(['first_name' => 'Ana']);
    $request->files->set('avatar', $file);

    $validator = validator($request->all(), $request->rules());

    expect($validator->fails())->toBeTrue();
    expect($validator->errors()->has('avatar'))->toBeTrue();
});

it('authorize returns true when user is authenticated', function (): void {
    $user = User::factory()->create();
    $request = new UpdateProfileRequest;
    $request->setUserResolver(fn () => $user);

    expect($request->authorize())->toBeTrue();
});
