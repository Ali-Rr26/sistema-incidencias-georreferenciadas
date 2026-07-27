<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReviewIncidentDuplicateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string', 'in:confirmed,rejected'],
        ];
    }

    public function messages(): array
    {
        return [
            'status.required' => 'El estado de revisión es obligatorio.',
            'status.in' => 'El estado debe ser "confirmed" o "rejected".',
        ];
    }
}
