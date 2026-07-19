<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Services;

use App\Storage\StorageService;
use Illuminate\Http\UploadedFile;

/**
 * Sube las imágenes de una incidencia y arma la metadata que se persiste
 * en la columna JSON `images`. Antes vivía como método privado de
 * IncidentController — extraído para que el controller solo orqueste.
 */
class IncidentImageService
{
    public function __construct(
        private readonly StorageService $storage,
    ) {}

    /**
     * @return array<int, array{path: string, original_name: string|null, mime_type: string|null, size: int|false, is_thumbnail: bool}>
     */
    public function upload(array|UploadedFile|null $files, int $incidentId, bool $firstIsThumbnail): array
    {
        $files = is_array($files) ? $files : ($files ? [$files] : []);
        $files = array_filter($files);

        if (empty($files)) {
            return [];
        }

        $images = [];

        foreach ($files as $i => $file) {
            $key = $this->storage->uploadImage($file, $incidentId);

            $images[] = [
                'path' => $key,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
                'is_thumbnail' => $firstIsThumbnail && $i === 0,
            ];
        }

        return $images;
    }
}
