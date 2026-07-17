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
        // Use load() instead of loadMissing() to ensure a fresh query.
        // loadMissing() skips re-loading if the relationship was already
        // accessed (e.g., by RedisCommentSync on the 'created' event),
        // caching an empty collection before images exist.
        $comment->load('images');

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
            $image->delete();
        }
    }

    private function storageDisk(): string
    {
        return env('FILESYSTEM_DISK', 's3');
    }
}
