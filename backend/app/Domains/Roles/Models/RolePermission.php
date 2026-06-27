<?php

namespace App\Domains\Roles\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class RolePermission extends Pivot
{
    protected $table = 'role_permission';

    protected $primaryKey = 'role_permission_id';

    public $timestamps = true;
}
