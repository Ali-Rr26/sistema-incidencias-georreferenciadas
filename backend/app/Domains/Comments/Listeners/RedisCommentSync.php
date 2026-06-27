<?php

declare(strict_types=1);

namespace App\Domains\Comments\Listeners;

use App\Domains\Comments\Models\Comment;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

class RedisCommentSync
{
    private const INCIDENT_HASH_PREFIX = 'incident:';
    private const COMMENT_HASH_PREFIX = 'comment:';

    public function created(Comment $comment): void
    {
        $this->syncComment($comment);
    }

    public function updated(Comment $comment): void
    {
        $this->syncComment($comment);
    }

    public function deleted(Comment $comment): void
    {
        $this->removeComment($comment);
    }

    public function forceDeleted(Comment $comment): void
    {
        $this->removeComment($comment);
    }

    private function syncComment(Comment $comment): void
    {
        try {
            $comment->loadMissing('user');

            $commentSetKey = self::INCIDENT_HASH_PREFIX . $comment->incident_id . ':comments';
            $commentHashKey = self::COMMENT_HASH_PREFIX . $comment->id;
            $incidentHashKey = self::INCIDENT_HASH_PREFIX . $comment->incident_id;

            $data = [
                'id' => (string) $comment->id,
                'incident_id' => (string) $comment->incident_id,
                'user_id' => (string) $comment->user_id,
                'user_name' => ($comment->user?->first_name ?? '') . ' ' . ($comment->user?->last_name ?? ''),
                'message' => $comment->message,
                'created_at' => $comment->created_at?->toIso8601String(),
                'updated_at' => $comment->updated_at?->toIso8601String(),
            ];

            $pipe = Redis::pipeline();
            $pipe->zadd($commentSetKey, (float) $comment->created_at->timestamp, (string) $comment->id);
            $pipe->hmset($commentHashKey, $data);
            $pipe->hincrby($incidentHashKey, 'comment_count', 1);
            $pipe->exec();
        } catch (\Throwable $e) {
            Log::warning('Failed to sync comment to Redis', [
                'comment_id' => $comment->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function removeComment(Comment $comment): void
    {
        try {
            $commentSetKey = self::INCIDENT_HASH_PREFIX . $comment->incident_id . ':comments';
            $commentHashKey = self::COMMENT_HASH_PREFIX . $comment->id;
            $incidentHashKey = self::INCIDENT_HASH_PREFIX . $comment->incident_id;

            $pipe = Redis::pipeline();
            $pipe->zrem($commentSetKey, (string) $comment->id);
            $pipe->del($commentHashKey);
            $pipe->hincrby($incidentHashKey, 'comment_count', -1);
            $pipe->exec();
        } catch (\Throwable $e) {
            Log::warning('Failed to remove comment from Redis', [
                'comment_id' => $comment->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
