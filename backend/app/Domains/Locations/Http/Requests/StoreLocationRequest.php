<?php

declare(strict_types=1);

namespace App\Domains\Locations\Http\Requests;

use App\Domains\Locations\Models\Location;
use Illuminate\Foundation\Http\FormRequest;

class StoreLocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Location::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'name'      => 'required|string|max:50',
            'code'      => 'required|string|max:20|unique:locations,code',
            'level'     => 'required|string|in:country,province,city,neighborhood',
            'parent_id' => 'nullable|integer|exists:locations,id',
            'geom'      => 'nullable|json',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'      => 'The name is required.',
            'code.required'      => 'The code is required.',
            'code.unique'        => 'This code is already in use.',
            'level.in'           => 'Level must be: country, province, city or neighborhood.',
            'parent_id.exists'   => 'The selected parent location does not exist.',
            'geom.json'          => 'The geometry must be valid JSON.',
        ];
    }
}
