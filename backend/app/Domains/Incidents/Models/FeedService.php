<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Models;

use Illuminate\Support\Facades\Redis;

class FeedService
{
    private const CANDIDATE_LIMIT = 500;

    private const SORTED_SET_KEY = 'feed:incidents';

    private const HASH_PREFIX = 'incident:';

    /**
     * @return array{data: array, meta: array}
     */
    public function getFeed(
        ?string $status = null,
        ?int $organizationId = null,
        ?int $locationId = null,
        int $page = 1,
        int $perPage = 12,
    ): array {
        $candidateIds = Redis::zrevrange(self::SORTED_SET_KEY, 0, self::CANDIDATE_LIMIT - 1);

        if (empty($candidateIds)) {
            return $this->emptyResponse($page, $perPage);
        }

        $incidents = [];
        foreach ($candidateIds as $id) {
            $data = Redis::hgetall(self::HASH_PREFIX.$id);

            if (empty($data)) {
                continue;
            }

            // Filter by status
            if ($status !== null && ($data['status'] ?? '') !== $status) {
                continue;
            }

            // Filter by organization_id
            if ($organizationId !== null && (int) ($data['organization_id'] ?? 0) !== $organizationId) {
                continue;
            }

            // Filter by location_path_ids (descendant match)
            if ($locationId !== null) {
                $pathIds = isset($data['location_path_ids'])
                    ? (array) json_decode($data['location_path_ids'], true)
                    : [];
                if (! in_array($locationId, $pathIds, true)) {
                    continue;
                }
            }

            $incidents[] = $this->buildItem($data);
        }

        // Paginate the filtered set
        $total = count($incidents);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $offset = ($page - 1) * $perPage;
        $items = array_slice($incidents, $offset, $perPage);

        return [
            'data' => $items,
            'meta' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
                'from' => $total > 0 ? $offset + 1 : null,
                'to' => $total > 0 ? min($offset + $perPage, $total) : null,
            ],
        ];
    }

    /**
     * @param  array<string, string|null>  $data
     * @return array<string, mixed>
     */
    private function buildItem(array $data): array
    {
        return [
            'id' => (int) ($data['id'] ?? 0),
            'incident_category_id' => (int) ($data['incident_category_id'] ?? 0),
            'organization_id' => (int) ($data['organization_id'] ?? 0),
            'user_id' => (int) ($data['user_id'] ?? 0),
            'location_id' => (int) ($data['location_id'] ?? 0),
            'status' => $data['status'] ?? '',
            'priority' => $data['priority'] ?? '',
            'resolution_date' => $data['resolution_date'] ?? null,
            'created_at' => $data['created_at'] ?? null,
            'updated_at' => $data['updated_at'] ?? null,
            'geom' => isset($data['geom']) ? json_decode($data['geom']) : null,
            'category' => [
                'id' => (int) ($data['incident_category_id'] ?? 0),
                'name' => $data['category_name'] ?? '',
                'organizations' => isset($data['category_organizations'])
                    ? json_decode($data['category_organizations'], true)
                    : [],
            ],
            'organization' => [
                'id' => (int) ($data['organization_id'] ?? 0),
                'name' => $data['organization_name'] ?? '',
            ],
            'user' => [
                'id' => (int) ($data['user_id'] ?? 0),
                'first_name' => $data['user_first_name'] ?? null,
                'last_name' => $data['user_last_name'] ?? null,
                'avatar' => $data['user_avatar'] ?? null,
            ],
            'location' => [
                'id' => (int) ($data['location_id'] ?? 0),
                'name' => $data['location_name'] ?? '',
            ],
        ];
    }

    /**
     * @return array{data: array, meta: array}
     */
    private function emptyResponse(int $page, int $perPage): array
    {
        return [
            'data' => [],
            'meta' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => 0,
                'last_page' => 1,
                'from' => null,
                'to' => null,
            ],
        ];
    }
}
