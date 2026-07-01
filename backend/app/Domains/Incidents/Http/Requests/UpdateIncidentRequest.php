<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Requests;

use App\Domains\Incidents\Models\Incident;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $incident = $this->route('incident');
        if (! $incident instanceof Incident) {
            $incident = Incident::find($incident);
        }

        if ($incident === null) {
            return false;
        }

        $user = $this->user();
        if ($user === null) {
            return false;
        }

        if (! $user->can('update', $incident)) {
            return false;
        }

        if ($user->isOperator()) {
            $lockedFields = ['title', 'priority', 'incident_category_id', 'location_id'];
            foreach ($lockedFields as $field) {
                if ($this->has($field)) {
                    return false;
                }
            }
        }

        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|nullable|string',
            'incident_category_id' => 'sometimes|integer|exists:incident_categories,id',
            'location_id' => 'sometimes|integer|exists:locations,id',
            'status' => ['sometimes', Rule::in([Incident::STATUS_PENDING, Incident::STATUS_IN_PROGRESS, Incident::STATUS_RESOLVED])],
            'priority' => ['sometimes', Rule::in([Incident::PRIORITY_LOW, Incident::PRIORITY_MEDIUM, Incident::PRIORITY_HIGH])],
            'resolution_date' => 'nullable|date',
            'geom' => 'nullable|json',

            // Imágenes opcionales (multipart)
            'images' => 'nullable|array',
            'images.*' => 'nullable|image|mimes:jpeg,png,webp|max:10240',
        ];
    }

    public function messages(): array
    {
        return [
            'status.in' => 'Status must be: pending, in_progress or resolved.',
            'priority.in' => 'Priority must be: low, medium or high.',
        ];
    }
}
