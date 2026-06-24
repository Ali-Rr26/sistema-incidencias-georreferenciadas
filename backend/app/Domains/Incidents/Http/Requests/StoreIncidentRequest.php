<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Requests;

use App\Domains\Incidents\Models\Incident;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Incident::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'incident_category_id' => 'required|integer|exists:incident_categories,id',
            'location_id'          => 'required|integer|exists:locations,id',
            'priority'             => ['required', Rule::in([Incident::PRIORITY_LOW, Incident::PRIORITY_MEDIUM, Incident::PRIORITY_HIGH])],
            'geom'                 => 'nullable|json',
        ];
    }

    public function messages(): array
    {
        return [
            'incident_category_id.required' => 'The incident category is required.',
            'incident_category_id.exists'   => 'The selected category does not exist.',
            'location_id.required'          => 'The location is required.',
            'location_id.exists'            => 'The selected location does not exist.',
            'priority.required'             => 'The priority is required.',
            'priority.in'                   => 'Priority must be: low, medium or high.',
        ];
    }
}
