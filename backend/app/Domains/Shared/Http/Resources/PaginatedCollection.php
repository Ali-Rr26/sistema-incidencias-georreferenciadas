<?php

declare(strict_types=1);

namespace App\Domains\Shared\Http\Resources;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\ResourceCollection;

abstract class PaginatedCollection extends ResourceCollection
{
    public function toResponse($request): JsonResponse
    {
        $paginated = $this->resource->toArray();

        return response()->json([
            'data' => $this->collection,
            'meta' => [
                'current_page' => $paginated['current_page'],
                'per_page' => $paginated['per_page'],
                'total' => $paginated['total'],
                'last_page' => $paginated['last_page'],
                'from' => $paginated['from'],
                'to' => $paginated['to'],
            ],
        ]);
    }
}
