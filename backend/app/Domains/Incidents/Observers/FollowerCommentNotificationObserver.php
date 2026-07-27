<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Observers;

use App\Domains\Comments\Models\Comment;
use App\Domains\Incidents\Models\IncidentFollower;
use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Jobs\SendIncidentNotificationJob;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Pushes Comment notifications to every user following the incident
 * where the comment was posted.
 *
 *   - Skips the comment author (they obviously know they wrote it).
 *   - Honors the existing 60s dedup window inside
 *     {@see \App\Domains\Notifications\Services\NotificationService::notify()}.
 *   - Logs and swallows all exceptions — the comment write is the
 *     primary side-effect, the notification is a courtesy.
 *
 * Dispatched via {@see SendIncidentNotificationJob} so the work happens
 * outside the request. One row per follower; the Job is idempotent on
 * (user, incident, type, 60s window) via the Service-level dedup.
 */
class FollowerCommentNotificationObserver
{
    public function created(Comment $comment): void
    {
        try {
            $this->handleCreated($comment);
        } catch (\Throwable $e) {
            Log::warning('FollowerCommentNotificationObserver failed', [
                'comment_id' => $comment->id,
                'incident_id' => $comment->incident_id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function handleCreated(Comment $comment): void
    {
        $comment->loadMissing('incident');

        $incident = $comment->incident;
        if ($incident === null) {
            return;
        }

        $followerIds = IncidentFollower::query()
            ->where('incident_id', $incident->id)
            ->where('user_id', '!=', (int) $comment->user_id)
            ->pluck('user_id');

        if ($followerIds->isEmpty()) {
            return;
        }

        $title = (string) $incident->title;
        $preview = mb_substr((string) $comment->message, 0, 80);
        $message = "Nuevo comentario en \"{$title}\": {$preview}";
        $type = NotificationType::Comment;
        $data = [
            'incident_id' => (int) $incident->id,
            'incident_title' => $title,
            'comment_id' => (int) $comment->id,
            'actor_user_id' => (int) $comment->user_id,
        ];

        DB::afterCommit(function () use ($followerIds, $incident, $type, $message, $data): void {
            foreach ($followerIds as $userId) {
                try {
                    SendIncidentNotificationJob::dispatch(
                        (int) $userId,
                        (int) $incident->id,
                        $type->value,
                        $message,
                        $data,
                    );
                } catch (\Throwable $e) {
                    Log::warning('Failed to queue follower notification', [
                        'user_id' => (int) $userId,
                        'incident_id' => (int) $incident->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        });
    }
}
