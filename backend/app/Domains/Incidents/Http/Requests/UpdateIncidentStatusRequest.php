<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Requests;

use App\Domains\Incidents\Models\Incident;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateIncidentStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        $incident = $this->route('incident');

        if (! $incident instanceof Incident) {
            $incident = Incident::find($incident);
        }

        return $incident !== null && ($this->user()?->can('update', $incident) ?? false);
    }

    public function rules(): array
    {
        return [
            'status'  => ['required', Rule::in(['pending', 'pending_operator', 'in_progress', 'resolved'])],
            'comment' => 'nullable|string|max:1000',
        ];
    }

    public function messages(): array
    {
        return [
            'status.required' => 'El campo status es obligatorio.',
            'status.in'       => 'Status inválido. Valores permitidos: pending, pending_operator, in_progress, resolved.',
        ];
    }
}
