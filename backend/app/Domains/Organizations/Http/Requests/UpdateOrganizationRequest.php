<?php

declare(strict_types=1);

namespace App\Domains\Organizations\Http\Requests;

use App\Domains\Organizations\Models\Organization;
use Illuminate\Foundation\Http\FormRequest;

class UpdateOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $organization = Organization::find($this->route('organization'));
        if ($organization === null) {
            return false;
        }

        return $this->user()?->can('update', $organization) ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => 'sometimes|string|max:100',
            'location_id' => 'sometimes|integer|exists:locations,id',
            'parent_id' => 'nullable|integer|exists:organizations,id',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer|exists:incident_categories,id',
        ];
    }

    public function messages(): array
    {
        return [
            'location_id.exists' => 'The selected location does not exist.',
            'parent_id.exists' => 'The selected parent organization does not exist.',
            'category_ids.*.exists' => 'One or more selected categories do not exist.',
        ];
    }
}
