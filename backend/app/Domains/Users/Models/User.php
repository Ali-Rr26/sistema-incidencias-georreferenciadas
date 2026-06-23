<?php

declare(strict_types=1);

namespace App\Domains\Users\Models;

use App\Domains\Roles\Models\Role;
use App\Domains\Sessions\Models\Session;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'role_id',
        'email',
        'password',
        'first_name',
        'last_name',
        'phone',
        'avatar'
    ];

    protected $hidden = [
        'passsword'
    ];

    protected function casts(): array
    {
        return [
            'avatar' => 'array',
            'password' => 'hashed'
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(Session::class);
    }

    public function isAdmin(): bool
    {
        return $this->role_id === 1;
    }
    
    public function hasPermissions(string $permission): bool 
    {
        [$resource, $action] = explode('.', $permission);

        return $this->role
            ?->permissions()
            ->where('resource', $resource)
            ->where('action', $action)
            ->exists() ?? false;    
        }


}



