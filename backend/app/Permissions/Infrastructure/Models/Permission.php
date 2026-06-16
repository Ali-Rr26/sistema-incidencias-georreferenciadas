<?php

namespace App\Permissions\Infrastructure\Models;

use App\Menus\Infrastructure\Models\Menu;
use App\Menus\Infrastructure\Models\MenuPermission;
use App\Roles\Infrastructure\Models\Role;
use App\Roles\Infrastructure\Models\RolePermission;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Permission extends Model
{
    use SoftDeletes;

    protected $primaryKey = 'permission_id';

    protected $fillable = [
        'name',
        'description',
        'resource',
        'action',
    ];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_permission', 'permission_id', 'role_id')
            ->using(RolePermission::class);
    }

    public function menus(): BelongsToMany
    {
        return $this->belongsToMany(Menu::class, 'menu_permission', 'permission_id', 'menu_id')
            ->using(MenuPermission::class);
    }
}
