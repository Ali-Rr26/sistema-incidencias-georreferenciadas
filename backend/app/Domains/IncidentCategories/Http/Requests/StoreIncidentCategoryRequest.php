<?php

declare(strict_types=1);

namespace App\Domains\IncidentCategories\Http\Requests;

use App\Domains\IncidentCategories\Models\IncidentCategory;
use Illuminate\Foundation\Http\FormRequest;

class StoreIncidentCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', IncidentCategory::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'name'            => 'required|string|max:100',
            'organization_id' => 'required|integer|exists:organizations,id',
            'parent_id'       => 'nullable|integer|exists:incident_categories,id',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'            => 'The name is required.',
            'organization_id.required' => 'The organization is required.',
            'organization_id.exists'   => 'The selected organization does not exist.',
            'parent_id.exists'         => 'The selected parent category does not exist.',
        ];
    }
}
