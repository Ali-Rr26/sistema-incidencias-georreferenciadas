<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domains\Comments\Models\Comment;
use App\Domains\Incidents\Models\Incident;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Redis;

class FeedRebuildCommand extends Command
{
    private const V2_ITEMS_KEY = 'feed:v2:items';

    private const V2_INDEX_KEY = 'feed:v2:index';

    private const FEED_TTL = 604800; // 7 days

    protected $signature = 'feed:rebuild';

    protected $description = 'Rebuild Redis feed v2 data from PostgreSQL';

    public function handle(): int
    {
        $this->info('Rebuilding Redis feed v2 from PostgreSQL...');

        // Rebuild must be authoritative: wipe first so incidents deleted
        // from PostgreSQL since the last rebuild don't linger as ghosts in
        // the hash/sorted-set (upsert-only never prunes stale members).
        Redis::del(self::V2_ITEMS_KEY, self::V2_INDEX_KEY);

        $incidentCount = 0;

        Incident::with(['category', 'location', 'user'])
            ->chunk(100, function ($incidents) use (&$incidentCount): void {
                $pipe = Redis::pipeline();

                foreach ($incidents as $incident) {
                    $locationPathIds = $incident->location?->ancestorsAndSelf()
                        ->orderBy('depth', 'desc')
                        ->pluck('id')
                        ->toArray() ?? [];

                    $data = [
                        'id' => (string) $incident->id,
                        'incident_category_id' => (string) $incident->incident_category_id,
                        'organization_id' => (string) $incident->organization_id,
                        'user_id' => (string) $incident->user_id,
                        'location_id' => (string) $incident->location_id,
                        'title' => $incident->title,
                        'status' => $incident->status,
                        'priority' => $incident->priority,
                        'resolution_date' => $incident->resolution_date?->toIso8601String(),
                        'created_at' => $incident->created_at?->toIso8601String(),
                        'updated_at' => $incident->updated_at?->toIso8601String(),
                        'geom' => $incident->geom ? $incident->geom->toJson() : null,
                        'category_name' => $incident->category?->name ?? '',
                        'organization_name' => $incident->organization?->name ?? '',
                        'location_name' => $incident->location?->name ?? '',
                        'location_path_ids' => json_encode($locationPathIds),
                        'user_first_name' => $incident->user?->first_name,
                        'user_last_name' => $incident->user?->last_name,
                        'user_avatar' => $incident->user?->avatar,
                    ];

                    $pipe->hset(self::V2_ITEMS_KEY, (string) $incident->id, json_encode($data));
                    $pipe->zadd(self::V2_INDEX_KEY, (float) $incident->created_at->timestamp, (string) $incident->id);

                    $incidentCount++;
                }

                $pipe->exec();
            });

        // Set TTL on v2 keys once after all inserts
        Redis::expire(self::V2_ITEMS_KEY, self::FEED_TTL);
        Redis::expire(self::V2_INDEX_KEY, self::FEED_TTL);

        $this->info("Synced {$incidentCount} incidents to Redis feed v2.");

        // Sync comments to Redis (unchanged — uses incident: and comment: keys)
        $commentCount = 0;

        Comment::with('user')
            ->chunk(100, function ($comments) use (&$commentCount): void {
                $pipe = Redis::pipeline();

                foreach ($comments as $comment) {
                    $commentSetKey = 'incident:'.$comment->incident_id.':comments';
                    $commentHashKey = 'comment:'.$comment->id;

                    $data = [
                        'id' => (string) $comment->id,
                        'incident_id' => (string) $comment->incident_id,
                        'user_id' => (string) $comment->user_id,
                        'user_name' => ($comment->user?->first_name ?? '').' '.($comment->user?->last_name ?? ''),
                        'message' => $comment->message,
                        'created_at' => $comment->created_at?->toIso8601String(),
                        'updated_at' => $comment->updated_at?->toIso8601String(),
                    ];

                    $pipe->zadd($commentSetKey, (float) $comment->created_at->timestamp, (string) $comment->id);
                    $pipe->hmset($commentHashKey, $data);

                    $commentCount++;
                }

                $pipe->exec();
            });

        // Rebuild comment_count for each incident that has comments
        $incidentIds = Comment::distinct()->pluck('incident_id');
        foreach ($incidentIds as $incidentId) {
            $count = Comment::where('incident_id', $incidentId)->count();
            Redis::hincrby('incident:'.$incidentId, 'comment_count', $count);
        }

        $this->info("Synced {$commentCount} comments to Redis.");

        return self::SUCCESS;
    }
}
