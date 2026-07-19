<?php

declare(strict_types=1);

use App\Domains\Incidents\Services\IncidentImageService;
use App\Storage\StorageService;
use Illuminate\Http\UploadedFile;

it('returns an empty array for null or empty input', function (): void {
    $storage = Mockery::mock(StorageService::class);
    $storage->shouldNotReceive('uploadImage');

    $service = new IncidentImageService($storage);

    expect($service->upload(null, 1, true))->toBe([]);
    expect($service->upload([], 1, true))->toBe([]);
});

it('uploads each file and marks only the first as thumbnail when requested', function (): void {
    $storage = Mockery::mock(StorageService::class);
    $storage->shouldReceive('uploadImage')
        ->twice()
        ->andReturn('incidents/1/a.jpg', 'incidents/1/b.jpg');

    $service = new IncidentImageService($storage);

    $files = [
        UploadedFile::fake()->image('a.jpg'),
        UploadedFile::fake()->image('b.jpg'),
    ];

    $images = $service->upload($files, 1, true);

    expect($images)->toHaveCount(2);
    expect($images[0]['path'])->toBe('incidents/1/a.jpg');
    expect($images[0]['is_thumbnail'])->toBeTrue();
    expect($images[1]['is_thumbnail'])->toBeFalse();
    expect($images[0])->toHaveKeys(['path', 'original_name', 'mime_type', 'size', 'is_thumbnail']);
});

it('marks no thumbnail when firstIsThumbnail is false', function (): void {
    $storage = Mockery::mock(StorageService::class);
    $storage->shouldReceive('uploadImage')->once()->andReturn('incidents/2/c.jpg');

    $service = new IncidentImageService($storage);

    $images = $service->upload(UploadedFile::fake()->image('c.jpg'), 2, false);

    expect($images[0]['is_thumbnail'])->toBeFalse();
});
