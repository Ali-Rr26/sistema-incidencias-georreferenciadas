<?php

declare(strict_types=1);

namespace App\Domains\Users\Http\Requests;

use App\Domains\Roles\Enums\UserRole;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if ($user === null) {
            return false;
        }

        $targetUser = $this->route('user');
        if (! $targetUser instanceof User) {
            $targetUser = User::find($targetUser);
        }

        if ($targetUser === null) {
            return false;
        }

        if (! $user->can('update', $targetUser)) {
            return false;
        }

        if ($user->isOrganizationAdmin()) {
            // Cannot assign administrative roles (admin_sistema, operador_sistema)
            if ($this->has('role_id')) {
                $roleId = $this->input('role_id');
                if (in_array((int) $roleId, [
                    Role::where('name', UserRole::AdminSistema->value)->first()?->id,
                    Role::where('name', UserRole::OperadorSistema->value)->first()?->id,
                ], true)) {
                    return false;
                }
            }

            // Must match their own organization
            if ($this->has('organization_id')) {
                $orgId = $this->input('organization_id');
                if ((int) $orgId !== $user->organization_id) {
                    return false;
                }
            }
        }

        return true;
    }

    public function rules(): array
    {
        $userId = $this->route('user');

        return [
            'email' => "sometimes|email|unique:users,email,{$userId}",
            'password' => 'nullable|string|min:8',
            'role_id' => 'sometimes|integer|exists:roles,id',
            'organization_id' => 'nullable|integer|exists:organizations,id',
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
