<?php

namespace App\Menus\Infrastructure\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Database\Eloquent\SoftDeletes;

class MenuPermission extends Pivot
{
    use SoftDeletes;

    protected $table = 'menu_permission';

    protected $primaryKey = 'menu_permission_id';

    public $timestamps = true;
}
