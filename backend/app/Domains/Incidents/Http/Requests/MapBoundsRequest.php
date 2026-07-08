<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the optional query parameters used by the map viewport endpoint
 * (`GET /api/incidents?bbox=...&zoom=...`).
 *
 * The standard filters (status, priority, location_id, incident_category_id,
 * user_id, title, per_page, relations) are accepted here so that
 * `validated()` returns a complete payload that the controller can hand to
 * the repository unchanged.
 *
 * Authorization is intentionally permissive: the route is already protected
 * by the `jwt` middleware and the controller binds `authorizeResource()` to
 * the Incident model, so per-request authorization is enforced there.
 */
class MapBoundsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // bbox=minLng,minLat,maxLng,maxLat — 4 floats, comma separated.
            'bbox' => [
                'nullable',
                'string',
                'regex:/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/',
            ],
            // Map zoom level (1 = world, 22 = building). Used by clients to
            // decide clustering density; the API itself only validates it.
            'zoom' => ['nullable', 'integer', 'min:1', 'max:22'],

            // Existing index filters — declared so `validated()` returns them.
            'status' => ['nullable', 'string'],
            'priority' => ['nullable', 'string'],
            'location_id' => ['nullable', 'integer'],
            'incident_category_id' => ['nullable', 'integer'],
            'user_id' => ['nullable', 'integer'],
            'title' => ['nullable', 'string', 'max:200'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],

            // Caller may pass `relations[]=...`, but the controller always
            // overrides with its own INDEX_RELATIONS set, so this is purely
            // for parity with the previous `$request->only(...)` behaviour.
            'relations' => ['nullable', 'array'],
            'relations.*' => ['string'],
        ];
    }

    public function messages(): array
    {
        return [
            'bbox.regex' => 'El formato de bbox debe ser minLng,minLat,maxLng,maxLat (4 números separados por coma).',
            'zoom.min' => 'El zoom debe ser un entero entre 1 y 22.',
            'zoom.max' => 'El zoom debe ser un entero entre 1 y 22.',
            'zoom.integer' => 'El zoom debe ser un entero entre 1 y 22.',
            'per_page.max' => 'per_page no puede ser mayor que 500.',
        ];
    }
}
