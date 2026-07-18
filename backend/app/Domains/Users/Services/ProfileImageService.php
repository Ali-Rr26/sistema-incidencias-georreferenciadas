<?php

declare(strict_types=1);

namespace App\Domains\Users\Services;

use App\Domains\Comments\Services\ImageProcessingService;
use App\Domains\Users\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ProfileImageService
{
    public function __construct(
        private readonly ImageProcessingService $imageService,
    ) {}

    /**
     * Replace the user's avatar: delete old file (if exists), store new one, update DB.
     * S3 delete failures are logged but do not revert the new upload.
     */
    public function replaceAvatar(User $user, UploadedFile $file): string
    {
        $oldPath = $user->profile_image_path;

        // Delete old file if it exists
        if ($oldPath !== null) {
            try {
                Storage::disk($this->storageDisk())->delete($oldPath);
            } catch (\Throwable $e) {
                Log::warning('Failed to delete image file from S3', [
                    'path' => $oldPath,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Process and store new image
        $newPath = $this->imageService->processUserImage($file, $user->id);

        // Update DB
        $user->update(['profile_image_path' => $newPath]);

        return $newPath;
    }

    /**
     * Remove the user's avatar: delete file (if exists) and clear DB column.
     * S3 delete failures are logged but do not block the DB update.
     */
    public function removeAvatar(User $user): void
    {
        $path = $user->profile_image_path;

        if ($path !== null) {
            try {
                Storage::disk($this->storageDisk())->delete($path);
            } catch (\Throwable $e) {
                Log::warning('Failed to delete image file from S3', [
                    'path' => $path,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $user->update(['profile_image_path' => null]);
    }

    private function storageDisk(): string
    {
        return env('FILESYSTEM_STORAGE_DISK', 's3');
    }
}
