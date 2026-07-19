<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Requests;

use App\Domains\Incidents\Http\Rules\LocationGeomConsistentRule;
use App\Domains\Incidents\Models\Incident;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if ($user === null) {
            return false;
        }

        if (! $user->can('create', Incident::class)) {
            return false;
        }

        if ($user->isRegularUser() && $this->has('organization_id')) {
            return false;
        }

        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'incident_category_id' => 'required|integer|exists:incident_categories,id',
            'location_id' => ['nullable', 'integer', 'exists:locations,id', app(LocationGeomConsistentRule::class)],
            'priority' => ['required', Rule::in([Incident::PRIORITY_LOW, Incident::PRIORITY_MEDIUM, Incident::PRIORITY_HIGH])],
            'geom' => 'nullable|json',
            'organization_id' => 'nullable|integer|exists:organizations,id',

            // Imágenes opcionales (multipart)
            'images' => 'nullable|array',
            'images.*' => 'nullable|image|mimes:jpeg,png,webp|max:10240',
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'The title is required.',
            'title.max' => 'The title may not be greater than 255 characters.',
            'incident_category_id.required' => 'The incident category is required.',
            'incident_category_id.exists' => 'The selected category does not exist.',
            'location_id.exists' => 'The selected location does not exist.',
            'priority.required' => 'The priority is required.',
            'priority.in' => 'Priority must be: low, medium or high.',
            'images.*.image' => 'Each file must be an image.',
            'images.*.mimes' => 'Only JPEG, PNG or WEBP images are allowed.',
            'images.*.max' => 'Each image must not exceed 10 MB.',
        ];
    }
}
