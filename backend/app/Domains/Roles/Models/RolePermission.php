<?php

namespace App\Domains\Roles\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Database\Eloquent\SoftDeletes;

class RolePermission extends Pivot
{
    use SoftDeletes;

    protected $table = 'role_permission';

    protected $primaryKey = 'role_permission_id';

    public $timestamps = true;
}
