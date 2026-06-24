<?php
declare(strict_types=1);

namespace App\Domains\Locations\Http\Resources;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\ResourceCollection;

class LocationCollection extends ResourceCollection
{
    public $collects = LocationResource::class;

    public function toResponse($request): JsonResponse
    {
        $paginated = $this->resource->toArray();

        return response()->json([
            'data' => $this->collection,
            'meta' => $this->paginationInformation($request, $paginated, []),
        ]);
    }

    public function paginationInformation(
        $request,
        array $paginated,
        array $default,
    ): array {
        return[
            'current_page' => $paginated['current_page'],
            'per_page' => $paginated['per_page'],
            'total' => $paginated['total'],
            'last_page' => $paginated['last_page'],
            'from' => $paginated['from'],
            'to' => $paginated['to'],
        ];
    }
}

