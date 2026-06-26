<?php

declare(strict_types=1);

namespace App\Domains\Users\Http\Requests;

use App\Domains\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        $targetUser = User::find($this->route('user'));

        if ($targetUser === null) {
            return false;
        }

        return $this->user()?->can('update', $targetUser) ?? false;
    }

    public function rules(): array
    {
        $userId = $this->route('user');

        return [
            'email' => "sometimes|email|unique:users,email,{$userId}",
            'password' => 'sometimes|string|min:8',
            'role_id' => 'sometimes|integer|exists:roles,id',
            'first_name' => 'sometimes|string|max:100',
            'last_name' => 'sometimes|string|max:100',
            'phone' => 'nullable|string|max:50',
            'avatar' => 'nullable|array',
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Este correo electrónico ya está registrado.',
            'role_id.exists' => 'El rol seleccionado no existe',
            'password.min' => 'La contraseña debe tener al menos 8 caracteres',
        ];
    }
}
