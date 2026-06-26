<?php

declare(strict_types=1);

namespace App\StatusHistory\Interfaces\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateEstadoRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'estado_id'  => ['required', 'integer', 'in:1,2,3,4'],
            'comentario' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
