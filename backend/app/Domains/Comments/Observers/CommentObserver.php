<?php

declare(strict_types=1);

namespace App\Domains\Comments\Observers;

use App\Domains\Comments\Models\Comment;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class CommentObserver
{
    public function deleting(Comment $comment): void
    {
        $comment->loadMissing('images');

        foreach ($comment->images as $image) {
            try {
                Storage::disk($this->storageDisk())->delete($image->url);
            } catch (\Throwable $e) {
                Log::warning('Failed to delete comment image from storage', [
                    'comment_id' => $comment->id,
                    'image_url' => $image->url,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    private function storageDisk(): string
    {
        return env('FILESYSTEM_STORAGE_DISK', 's3');
    }
}
