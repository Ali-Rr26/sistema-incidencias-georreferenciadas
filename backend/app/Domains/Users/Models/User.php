<?php

declare(strict_types=1);

namespace App\Domains\Users\Models;

use App\Domains\Auth\Local\Notifications\PasswordResetMail;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Enums\UserRole;
use App\Domains\Roles\Models\Role;
use App\Domains\Sessions\Models\Session;
use App\Storage\Models\Image;
use Database\Factories\UserFactory;
use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /**
     * Maximum avatar upload size in kilobytes, used ONLY by
     * `GenerateAvatarConstantsCommand` to emit the frontend's
     * `avatar.constants.js` file-picker hint (a stricter, decorative
     * client-side hint — not a validation source).
     *
     * As of image-persistence-polymorphic WU7, actual server-side avatar
     * validation (`UpdateProfileRequest`, `UpdateUserRequest`) uses
     * `App\Storage\ImageRules::avatarFileRules()` (5120 KB / jpeg,png,webp,gif
     * — the same D10 limits every other image-upload endpoint enforces),
     * NOT this constant. Left at its pre-cutover value deliberately: this
     * constant also implies PHP uploads.ini/nginx.conf sizing (see below),
     * and bumping it to match `ImageRules::MAX_SIZE_KB` requires verifying
     * those infra limits first — flagged as a follow-up, not done here.
     * The PHP uploads.ini (`upload_max_filesize`/`post_max_size` in
     * `backend/Dockerfile`) and nginx.conf (`client_max_body_size`)
     * MUST be sized to accommodate this value with a small margin.
     */
    public const AVATAR_MAX_KB = 800;

    /** @use HasFactory<UserFactory> */
    use CanResetPassword, HasFactory, Notifiable, SoftDeletes;

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

    /**
     * Polymorphic `images` table row holding this user's avatar
     * (image-persistence-polymorphic, WU7 cutover). `UserResource`'s
     * `profile_image_path` key now sources from this relation instead of
     * the legacy `profile_image_path` column (D6 — same bare string key,
     * same shape).
     *
     * Named `avatarImage()`, NOT `avatar()`: `User` already has a real
     * `avatar` database column (legacy JSON `{urls: [...]}`, see the
     * `avatar` cast below and `$fillable` above, used by
     * `UpdateProfileRequest`'s JSON-mode avatar handling). Eloquent's
     * attribute resolution always wins over a same-named relation
     * method for magic property access (`$user->avatar` would silently
     * return the JSON column's value — always `null` for a real user —
     * and NEVER reach a relation method also named `avatar`, with no
     * error). Confirmed empirically while wiring WU7: `$user->avatar()->first()`
     * (explicit call) returns the correct row, but `$user->avatar`
     * (magic property) always returns `null`. A distinct name is the
     * only fix; `whenLoaded()`-based access wouldn't help since it must
     * always be present per D6 (never a MissingValue), and eager-loading
     * discipline can't be guaranteed at every `UserResource` call site.
     */
    public function avatarImage(): MorphOne
    {
        return $this->morphOne(Image::class, 'imageable');
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

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new PasswordResetMail($token));
    }
}
