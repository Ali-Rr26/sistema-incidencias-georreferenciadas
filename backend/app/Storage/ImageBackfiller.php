<?php

declare(strict_types=1);

namespace App\Storage;

use App\Domains\Comments\Models\Comment;
use App\Domains\Comments\Models\CommentImage;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Users\Models\User;
use App\Storage\Models\Image;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

/**
 * Backfills the polymorphic `images` table (WU2) from the three legacy
 * per-domain image storage locations (image-persistence-polymorphic, WU3).
 *
 * Additive only: the legacy `incidents.images` JSON column, `comment_images`
 * table, and `users.profile_image_path` column are left untouched — dropping
 * them is WU8, after the read/write cutover (WU5-WU7) lands.
 *
 * Idempotent: dedupe key is `(imageable_type, imageable_id, storage_path)`.
 * Running any `backfill*` method again for a source that was already
 * backfilled skips already-migrated rows instead of duplicating them.
 */
class ImageBackfiller
{
    /**
     * Backfill `images` rows from `incidents.images` (JSON column).
     *
     * D5: `is_thumbnail` is derived from array position (index 0), NOT the
     * stored JSON flag — `IncidentResource` displays `$images[0]` as the
     * thumbnail today regardless of the flag, so deriving from index is
     * what preserves each incident's currently-visible thumbnail.
     *
     * @return array{source_count:int, created_count:int, legacy_url_rows:array<int,array{imageable_id:int,storage_path:string}>}
     */
    public function backfillIncidents(): array
    {
        $sourceCount = 0;
        $createdCount = 0;
        $legacyUrlRows = [];

        Incident::query()
            ->whereNotNull('images')
            ->chunkById(100, function ($incidents) use (&$sourceCount, &$createdCount, &$legacyUrlRows): void {
                foreach ($incidents as $incident) {
                    $images = array_values($incident->images ?? []);

                    foreach ($images as $index => $img) {
                        $path = $img['path'] ?? null;

                        if ($path === null) {
                            continue;
                        }

                        $sourceCount++;

                        if ($this->alreadyBackfilled($incident, $path)) {
                            continue;
                        }

                        // Incident paths are always server-generated bare keys
                        // (StorageService::uploadImage never returns an
                        // absolute URL), but the check is still run for
                        // defense-in-depth/consistency with the other sources.
                        $this->flagLegacyAbsoluteUrl('incident', $incident->id, $path, $legacyUrlRows);

                        $size = $img['size'] ?? null;

                        $incident->images()->create([
                            'storage_path' => $path,
                            'original_name' => $img['original_name'] ?? null,
                            'mime_type' => $img['mime_type'] ?? null,
                            'size' => is_int($size) ? $size : null,
                            'is_thumbnail' => $index === 0,
                            'sort_order' => $index,
                        ]);

                        $createdCount++;
                    }
                }
            });

        return [
            'source_count' => $sourceCount,
            'created_count' => $createdCount,
            'legacy_url_rows' => $legacyUrlRows,
        ];
    }

    /**
     * Backfill `images` rows from `comment_images`.
     *
     * `comment_images.url` already holds a bare storage key for
     * current-format rows (e.g. `comments/42/uuid.webp`) — this is a
     * verbatim column rename for the bulk of rows. Any row whose value
     * starts with `http://`/`https://` is a legacy absolute URL: it is
     * copied verbatim into `storage_path` (never guessed into a bare key)
     * and reported via `legacy_url_rows` (D9).
     *
     * @return array{source_count:int, created_count:int, legacy_url_rows:array<int,array{imageable_id:int,storage_path:string}>}
     */
    public function backfillComments(): array
    {
        $sourceCount = 0;
        $createdCount = 0;
        $legacyUrlRows = [];

        CommentImage::query()->chunkById(100, function ($commentImages) use (&$sourceCount, &$createdCount, &$legacyUrlRows): void {
            foreach ($commentImages as $commentImage) {
                $sourceCount++;

                $comment = $commentImage->comment;

                if ($comment === null) {
                    continue;
                }

                if ($this->alreadyBackfilled($comment, $commentImage->url)) {
                    continue;
                }

                $this->flagLegacyAbsoluteUrl('comment', $comment->id, $commentImage->url, $legacyUrlRows);

                $comment->polymorphicImages()->create([
                    'storage_path' => $commentImage->url,
                    'caption' => $commentImage->caption,
                    'sort_order' => $commentImage->sort_order,
                ]);

                $createdCount++;
            }
        });

        return [
            'source_count' => $sourceCount,
            'created_count' => $createdCount,
            'legacy_url_rows' => $legacyUrlRows,
        ];
    }

    /**
     * Backfill at most one `images` row per user from
     * `users.profile_image_path`. An avatar is definitionally its own
     * thumbnail, so `is_thumbnail` is always `true`.
     *
     * @return array{source_count:int, created_count:int, legacy_url_rows:array<int,array{imageable_id:int,storage_path:string}>}
     */
    public function backfillUsers(): array
    {
        $sourceCount = 0;
        $createdCount = 0;

        User::query()
            ->whereNotNull('profile_image_path')
            ->chunkById(100, function ($users) use (&$sourceCount, &$createdCount): void {
                foreach ($users as $user) {
                    $sourceCount++;

                    if ($this->alreadyBackfilled($user, $user->profile_image_path)) {
                        continue;
                    }

                    $user->avatar()->create([
                        'storage_path' => $user->profile_image_path,
                        'is_thumbnail' => true,
                        'sort_order' => 0,
                    ]);

                    $createdCount++;
                }
            });

        return [
            'source_count' => $sourceCount,
            'created_count' => $createdCount,
            'legacy_url_rows' => [],
        ];
    }

    /**
     * Counts source rows vs already-backfilled `images` rows for one
     * source, WITHOUT writing anything. Backs `images:backfill --verify`.
     *
     * @return array{source_count:int, target_count:int}
     */
    public function verify(string $source): array
    {
        return match ($source) {
            'incidents' => $this->verifyIncidents(),
            'comments' => $this->verifyComments(),
            'users' => $this->verifyUsers(),
            default => throw new \InvalidArgumentException("Unknown backfill source: {$source}"),
        };
    }

    /**
     * @return array{source_count:int, target_count:int}
     */
    private function verifyIncidents(): array
    {
        $sourceCount = Incident::query()
            ->whereNotNull('images')
            ->get(['images'])
            ->sum(fn (Incident $incident) => count(array_filter(
                $incident->images ?? [],
                fn (array $img) => ($img['path'] ?? null) !== null
            )));

        $targetCount = Image::query()
            ->where('imageable_type', (new Incident)->getMorphClass())
            ->count();

        return ['source_count' => $sourceCount, 'target_count' => $targetCount];
    }

    /**
     * @return array{source_count:int, target_count:int}
     */
    private function verifyComments(): array
    {
        $sourceCount = CommentImage::query()->count();

        $targetCount = Image::query()
            ->where('imageable_type', (new Comment)->getMorphClass())
            ->count();

        return ['source_count' => $sourceCount, 'target_count' => $targetCount];
    }

    /**
     * @return array{source_count:int, target_count:int}
     */
    private function verifyUsers(): array
    {
        $sourceCount = User::query()->whereNotNull('profile_image_path')->count();

        $targetCount = Image::query()
            ->where('imageable_type', (new User)->getMorphClass())
            ->count();

        return ['source_count' => $sourceCount, 'target_count' => $targetCount];
    }

    private function alreadyBackfilled(Model $owner, string $storagePath): bool
    {
        return Image::query()
            ->where('imageable_type', $owner->getMorphClass())
            ->where('imageable_id', $owner->getKey())
            ->where('storage_path', $storagePath)
            ->exists();
    }

    /**
     * @param  array<int,array{imageable_id:int,storage_path:string}>  $legacyUrlRows
     */
    private function flagLegacyAbsoluteUrl(string $source, int $imageableId, string $value, array &$legacyUrlRows): void
    {
        if (! str_starts_with($value, 'http://') && ! str_starts_with($value, 'https://')) {
            return;
        }

        $legacyUrlRows[] = ['imageable_id' => $imageableId, 'storage_path' => $value];

        Log::warning('[ImageBackfiller] Legacy absolute URL copied verbatim', [
            'source' => $source,
            'imageable_id' => $imageableId,
            'storage_path' => $value,
        ]);
    }
}
