<?php

declare(strict_types=1);

namespace App\Domains\Users\Http\Requests;

use App\Domains\Roles\Enums\UserRole;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if ($user === null) {
            return false;
        }

        if (! $user->can('create', User::class)) {
            return false;
        }

        if ($user->isOrganizationAdmin()) {
            $roleId = $this->input('role_id');
            $orgId = $this->input('organization_id');

            // Cannot assign administrative roles (admin_sistema, operador_sistema)
            if (in_array((int) $roleId, [
                Role::where('name', UserRole::AdminSistema->value)->first()?->id,
                Role::where('name', UserRole::OperadorSistema->value)->first()?->id,
            ], true)) {
                return false;
            }

            // Must match their own organization
            if ((int) $orgId !== $user->organization_id) {
                return false;
            }
        }

        return true;
    }

    public function rules(): array
    {
        return [
            'email' => 'required|email|unique:users,email',
            'password' => 'nullable|string|min:8|regex:/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])/',
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
            'password.regex' => 'La contraseña debe incluir mayúscula, minúscula y dígito',
        ];
    }
}
