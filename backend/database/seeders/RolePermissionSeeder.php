<?php

namespace Database\Seeders;

use App\Domains\Permissions\Models\Permission;
use App\Domains\Roles\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RolePermissionSeeder extends Seeder
{
    private const OPERADOR_PERMISSIONS = [
        ['resource' => 'dashboard',           'action' => 'view'],
        ['resource' => 'incidents',           'action' => 'view'],
        ['resource' => 'incidents',           'action' => 'create'],
        ['resource' => 'incidents',           'action' => 'update'],
        ['resource' => 'comments',            'action' => 'view'],
        ['resource' => 'comments',            'action' => 'create'],
        ['resource' => 'comments',            'action' => 'update'],
        ['resource' => 'assignments',         'action' => 'view'],
        ['resource' => 'assignments',         'action' => 'create'],
        ['resource' => 'assignments',         'action' => 'update'],
        ['resource' => 'status-history',      'action' => 'view'],
        ['resource' => 'notifications',       'action' => 'view'],
        ['resource' => 'notifications',       'action' => 'update'],
        ['resource' => 'locations',           'action' => 'view'],
        ['resource' => 'organizations',       'action' => 'view'],
        ['resource' => 'incident-categories', 'action' => 'view'],
    ];

    private const USUARIO_PERMISSIONS = [
        ['resource' => 'dashboard',     'action' => 'view'],
        ['resource' => 'incidents',     'action' => 'view'],
        ['resource' => 'incidents',     'action' => 'create'],
        ['resource' => 'comments',      'action' => 'view'],
        ['resource' => 'comments',      'action' => 'create'],
        ['resource' => 'notifications', 'action' => 'view'],
        ['resource' => 'notifications', 'action' => 'update'],
    ];

    public function run(): void
    {
        // Hard-delete existing role_permission for roles 2 and 3 (idempotent)
        DB::table('role_permission')->whereIn('role_id', [2, 3])->delete();

        $this->assignPermissions(2, self::OPERADOR_PERMISSIONS);
        $this->assignPermissions(3, self::USUARIO_PERMISSIONS);

        $this->command?->info('Permisos asignados a Operador y Usuario.');
    }

    /** @param array<array{resource: string, action: string}> $definitions */
    private function assignPermissions(int $roleId, array $definitions): void
    {
        $now = now();

        foreach ($definitions as $def) {
            $permission = Permission::where('resource', $def['resource'])
                ->where('action', $def['action'])
                ->first();

            if ($permission === null) {
                $this->command?->warn("Permission {$def['resource']}.{$def['action']} not found — skipping.");
                continue;
            }

            DB::table('role_permission')->insert([
                'role_id'       => $roleId,
                'permission_id' => $permission->permission_id,
                'created_at'    => $now,
                'updated_at'    => $now,
            ]);
        }
    }
}
