<?php

declare(strict_types=1);

namespace App\Domains\Users\Models;

use App\Domains\Auth\Local\Notifications\PasswordResetMail;
use App\Domains\Auth\Local\Notifications\VerifyEmailMail;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Enums\UserRole;
use App\Domains\Roles\Models\Role;
use App\Domains\Sessions\Models\Session;
use App\Storage\Models\Image;
use Database\Factories\UserFactory;
use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable implements MustVerifyEmail
{
    use CanResetPassword;
    use HasFactory;
    use Notifiable;
    use SoftDeletes;

    /**
     * Maximum avatar upload size in kilobytes, used ONLY by
     * `GenerateAvatarConstantsCommand` to emit the frontend's
     * single-source-of-truth constants.
     */
    public const AVATAR_MAX_KB = 5120;

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'password',
        'role_id',
        'organization_id',
        'email_verified_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
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

    /**
     * Shared polymorphic image relationship (image-persistence-polymorphic, WU6).
     */
    public function image(): MorphOne
    {
        return $this->morphOne(Image::class, 'imageable');
    }

    /**
     * Virtual avatar attribute: returns storage_path if custom avatar uploaded,
     * null otherwise (frontend generates initials fallback).
     */
    public function getAvatarAttribute(): ?string
    {
        return $this->image?->storage_path;
    }

    protected static function newFactory(): UserFactory
    {
        return UserFactory::new();
    }

    public function hasPermission(string $permissionName): bool
    {
        if ($this->relationLoaded('role') && $this->role) {
            if ($this->role->relationLoaded('permissions')) {
                return $this->role->permissions
                    ->contains(function ($p) use ($permissionName) {
                        return "{$p->resource}.{$p->action}" === $permissionName;
                    });
            }
        }

        [$resource, $action] = explode('.', $permissionName);

        return $this->role()
            ->whereHas('permissions', function ($query) use ($resource, $action) {
                $query->where('resource', $resource)
                    ->where('action', $action);
            })
            ->exists();
    }

    public function hasPermissionTo(string $resource, string $action): bool
    {
        if ($this->relationLoaded('role') && $this->role) {
            if ($this->role->relationLoaded('permissions')) {
                return $this->role->permissions
                    ->contains(function ($p) use ($resource, $action) {
                        return $p->resource === $resource && $p->action === $action;
                    });
            }
        }

        return $this->role?->permissions()
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

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new PasswordResetMail($token));
    }

    /**
     * Send the email verification notification — story sc-117 / R8 del
     * registro local.
     */
    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmailMail);
    }
}
