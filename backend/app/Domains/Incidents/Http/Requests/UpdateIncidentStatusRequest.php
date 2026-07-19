<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Requests;

use App\Domains\Incidents\Models\Incident;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateIncidentStatusRequest extends FormRequest
{
    /**
     * Authorization (permiso de update + regla de responsable) corre en
     * IncidentPolicy::updateStatus desde el controller, que necesita el
     * status ya validado.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in([Incident::STATUS_PENDING, Incident::STATUS_IN_PROGRESS, Incident::STATUS_RESOLVED])],
        ];
    }

    public function messages(): array
    {
        return [
            'status.in' => 'Status must be: pending, in_progress or resolved.',
        ];
    }
}
