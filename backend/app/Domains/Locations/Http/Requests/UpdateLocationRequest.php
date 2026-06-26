<?php

declare(strict_types=1);

namespace App\Domains\Locations\Http\Requests;

use App\Domains\Locations\Models\Location;
use Illuminate\Foundation\Http\FormRequest;

class UpdateLocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $location = Location::find($this->route('location'));
        if ($location === null) {
            return false;
        }

        return $this->user()?->can('update', $location) ?? false;
    }

    public function rules(): array
    {
        $id = $this->route('location');

        return [
            'name' => 'sometimes|string|max:50',
            'code' => "sometimes|string|max:20|unique:locations,code,{$id}",
            'level' => 'sometimes|string|in:country,province,city,neighborhood',
            'parent_id' => 'nullable|integer|exists:locations,id',
            'geom' => 'nullable|json',
        ];
    }

    public function messages(): array
    {
        return [
            'code.unique' => 'This code is already in use.',
            'level.in' => 'Level must be: country, province, city or neighborhood.',
            'parent_id.exists' => 'The selected parent location does not exist.',
            'geom.json' => 'The geometry must be valid JSON.',
        ];
    }
}
