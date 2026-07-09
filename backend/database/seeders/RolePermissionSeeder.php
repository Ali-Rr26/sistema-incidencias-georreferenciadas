<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domains\Permissions\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RolePermissionSeeder extends Seeder
{
    private const OPERADOR_SISTEMA_PERMISSIONS = [
        ['resource' => 'dashboard',           'action' => 'view'],
        ['resource' => 'incidents',           'action' => 'view'],
        ['resource' => 'incidents',           'action' => 'create'],
        ['resource' => 'incidents',           'action' => 'update'],
        ['resource' => 'incidents',           'action' => 'manage'],
        ['resource' => 'comments',            'action' => 'view'],
        ['resource' => 'comments',            'action' => 'create'],
        ['resource' => 'comments',            'action' => 'update'],
        ['resource' => 'status-history',      'action' => 'view'],
        ['resource' => 'assignments',         'action' => 'view'],
        ['resource' => 'notifications',       'action' => 'view'],
        ['resource' => 'notifications',       'action' => 'update'],
        ['resource' => 'locations',           'action' => 'view'],
        ['resource' => 'organizations',       'action' => 'view'],
        ['resource' => 'incident-categories', 'action' => 'view'],
        ['resource' => 'profile',             'action' => 'view'],
    ];

    private const ADMIN_ORGANIZACION_PERMISSIONS = [
        ['resource' => 'dashboard',           'action' => 'view'],
        ['resource' => 'incidents',           'action' => 'view'],
        ['resource' => 'incidents',           'action' => 'create'],
        ['resource' => 'incidents',           'action' => 'update'],
        ['resource' => 'incidents',           'action' => 'delete'],
        ['resource' => 'incidents',           'action' => 'manage'],
        ['resource' => 'comments',            'action' => 'view'],
        ['resource' => 'comments',            'action' => 'create'],
        ['resource' => 'comments',            'action' => 'update'],
        ['resource' => 'comments',            'action' => 'delete'],
        ['resource' => 'status-history',      'action' => 'view'],
        ['resource' => 'assignments',         'action' => 'view'],
        ['resource' => 'assignments',         'action' => 'create'],
        ['resource' => 'assignments',         'action' => 'delete'],
        ['resource' => 'notifications',       'action' => 'view'],
        ['resource' => 'notifications',       'action' => 'update'],
        ['resource' => 'locations',           'action' => 'view'],
        ['resource' => 'organizations',       'action' => 'view'],
        ['resource' => 'organizations',       'action' => 'update'],
        ['resource' => 'roles',               'action' => 'view'],
        ['resource' => 'incident-categories', 'action' => 'view'],
        ['resource' => 'users',               'action' => 'view'],
        ['resource' => 'users',               'action' => 'create'],
        ['resource' => 'users',               'action' => 'update'],
        ['resource' => 'users',               'action' => 'delete'],
        // Spec override (design Decision 1): admin_organizacion receives
        // feed.view in addition to usuario, so org admins can verify the
        // citizen experience in-browser. Overrides the spec rule
        // "No other role SHALL receive feed.view in this change".
        ['resource' => 'feed',                'action' => 'view'],
        ['resource' => 'profile',             'action' => 'view'],
    ];

    private const OPERADOR_ORGANIZACION_PERMISSIONS = [
        ['resource' => 'incidents',           'action' => 'view'],
        ['resource' => 'incidents',           'action' => 'update'],
        // Previously missing: the menu item Notificaciones was gated by
        // notifications.view, which this role never had. Granting it here
        // fixes the leak where the menu was hidden despite the role being
        // able to act on notifications.
        ['resource' => 'notifications',       'action' => 'view'],
        ['resource' => 'notifications',       'action' => 'update'],
        ['resource' => 'comments',            'action' => 'create'],
        ['resource' => 'comments',            'action' => 'update'],
        ['resource' => 'assignments',         'action' => 'view'],
        ['resource' => 'profile',             'action' => 'view'],
    ];

    private const USUARIO_PERMISSIONS = [
        ['resource' => 'incidents',     'action' => 'create'],
        ['resource' => 'comments',      'action' => 'create'],
        ['resource' => 'assignments',   'action' => 'view'],
        ['resource' => 'feed',          'action' => 'view'],
        ['resource' => 'profile',       'action' => 'view'],
    ];

    public function run(): void
    {
        // Limpiar relaciones previas para evitar duplicados
        DB::table('role_permission')->whereIn('role_id', [2, 3, 4, 5])->delete();

        $this->assignPermissions(2, self::OPERADOR_SISTEMA_PERMISSIONS);
        $this->assignPermissions(3, self::ADMIN_ORGANIZACION_PERMISSIONS);
        $this->assignPermissions(4, self::OPERADOR_ORGANIZACION_PERMISSIONS);
        $this->assignPermissions(5, self::USUARIO_PERMISSIONS);

        $this->command?->info('Permisos asignados a todos los roles exitosamente.');
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
                $this->command?->warn("Permiso {$def['resource']}.{$def['action']} no encontrado en la base de datos.");

                continue;
            }

            DB::table('role_permission')->insert([
                'role_id' => $roleId,
                'permission_id' => $permission->permission_id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
