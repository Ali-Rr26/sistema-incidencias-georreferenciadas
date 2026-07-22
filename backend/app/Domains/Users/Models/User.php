<?php

declare(strict_types=1);

namespace App\Domains\Users\Models;

use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Enums\UserRole;
use App\Domains\Roles\Models\Role;
use App\Domains\Sessions\Models\Session;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /**
     * Maximum avatar upload size in kilobytes.
     *
     * Single source of truth for the avatar upload cap, used by
     * UpdateProfileRequest and StoreUserAvatarRequest validation rules.
     * The PHP uploads.ini (`upload_max_filesize`/`post_max_size` in
     * `backend/Dockerfile`) and nginx.conf (`client_max_body_size`)
     * MUST be sized to accommodate this value with a small margin.
     */
    public const AVATAR_MAX_KB = 800;

    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, SoftDeletes;

    protected static function newFactory(): UserFactory
    {
        return UserFactory::new();
    }

    protected $fillable = [
        'role_id',
        'organization_id',
        'email',
        'password',
        'first_name',
        'last_name',
        'phone',
        'avatar',
        'profile_image_path',
        'email_verified_at',
        'terms_accepted_at',
        'terms_version',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'avatar' => 'array',
            'password' => 'hashed',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(Session::class);
    }

    public function isAdmin(): bool
    {
        return in_array($this->role?->name, [UserRole::AdminSistema->value, UserRole::AdminLegacy->value], true);
    }

    public function isSystemAdmin(): bool
    {
        return $this->role?->name === UserRole::AdminSistema->value;
    }

    public function isOrganizationAdmin(): bool
    {
        return $this->role?->name === UserRole::AdminOrganizacion->value;
    }

    public function hasPermission(string $permission): bool
    {
        [$resource, $action] = explode('.', $permission);

        return $this->role
            ?->permissions()
            ->where('resource', $resource)
            ->where('action', $action)
            ->exists() ?? false;
    }

    public function belongsToOrganization(Organization $org): bool
    {
        return $this->organization_id === $org->id;
    }

    public function isOrganizationMember(): bool
    {
        return $this->organization_id !== null;
    }

    public function isOperator(): bool
    {
        return $this->role?->name === UserRole::OperadorOrganizacion->value;
    }

    public function isRegularUser(): bool
    {
        return $this->role?->name === UserRole::Usuario->value;
    }
}
