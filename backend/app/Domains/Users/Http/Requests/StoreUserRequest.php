<?php

declare(strict_types=1);

namespace App\Domains\Users\Http\Requests;

use App\Domains\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', User::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'email' => 'required|email|unique:users,email',
            'password' => 'nullable|string|min:8',
            'role_id' => 'required|integer|exists:roles,id',
            'organization_id' => 'nullable|integer|exists:organizations,id',
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'phone' => 'nullable|string|max:50',
            'avatar' => 'nullable|array',
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Este correo electrónico ya está registrado',
            'role_id.exists' => 'El rol selecionnado no existe',
            'password.min' => 'La contraseña debe tener al menos 8 caracteres',
        ];
    }
}
