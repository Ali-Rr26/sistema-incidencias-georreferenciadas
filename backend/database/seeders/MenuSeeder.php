<?php

namespace Database\Seeders;

use App\Domains\Menus\Models\Menu;
use App\Domains\Permissions\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MenuSeeder extends Seeder
{
    /**
     * parent_id = null  → root menu
     * permission        → the permission that gates visibility (null = parent pulled in automatically)
     *
     * @var array<int, array{name: string, route: string, icon: string|null, parent_id: int|null, permission: array{resource: string, action: string}|null}>
     */
    private const MENUS = [
        1 => ['name' => 'Dashboard',              'route' => '/dashboard',            'icon' => 'layout-dashboard', 'parent_id' => null, 'permission' => ['resource' => 'dashboard',           'action' => 'view']],
        // Incidencias group
        2 => ['name' => 'Incidencias',            'route' => '/incidents',             'icon' => 'map-pin',          'parent_id' => null, 'permission' => null],
        3 => ['name' => 'Lista de Incidencias',   'route' => '/incidents',             'icon' => 'list',             'parent_id' => 2,    'permission' => ['resource' => 'incidents',           'action' => 'view']],
        4 => ['name' => 'Nueva Incidencia',       'route' => '/incidents/create',      'icon' => 'circle-plus',      'parent_id' => 2,    'permission' => ['resource' => 'incidents',           'action' => 'create']],
        5 => ['name' => 'Asignaciones',           'route' => '/assignments',           'icon' => 'users',            'parent_id' => 2,    'permission' => ['resource' => 'assignments',         'action' => 'view']],
        // Gestión group (admin area)
        6 => ['name' => 'Gestión',                'route' => '/management',            'icon' => 'shield-check',     'parent_id' => null, 'permission' => null],
        7 => ['name' => 'Usuarios',               'route' => '/users',                 'icon' => 'user',             'parent_id' => 6,    'permission' => ['resource' => 'users',               'action' => 'view']],
        8 => ['name' => 'Roles',                  'route' => '/roles',                 'icon' => 'shield',           'parent_id' => 6,    'permission' => ['resource' => 'roles',               'action' => 'view']],
        9 => ['name' => 'Permisos',               'route' => '/permissions',           'icon' => 'key-round',        'parent_id' => 6,    'permission' => ['resource' => 'permissions',         'action' => 'view']],
        10 => ['name' => 'Menús',                  'route' => '/menus',                 'icon' => 'menu',             'parent_id' => 6,    'permission' => ['resource' => 'menus',               'action' => 'view']],
        // Catálogos group
        11 => ['name' => 'Catálogos',              'route' => '/catalogs',              'icon' => 'book-open',        'parent_id' => null, 'permission' => null],
        12 => ['name' => 'Ubicaciones',            'route' => '/locations',             'icon' => 'map',              'parent_id' => 11,   'permission' => ['resource' => 'locations',           'action' => 'view']],
        13 => ['name' => 'Categorías',             'route' => '/incident-categories',   'icon' => 'tag',              'parent_id' => 11,   'permission' => ['resource' => 'incident-categories', 'action' => 'view']],
        14 => ['name' => 'Organizaciones',         'route' => '/organizations',         'icon' => 'building',         'parent_id' => 11,   'permission' => ['resource' => 'organizations',       'action' => 'view']],
        // Standalone
        15 => ['name' => 'Notificaciones',         'route' => '/notifications',         'icon' => 'bell',             'parent_id' => null, 'permission' => ['resource' => 'notifications',       'action' => 'view']],
    ];

    public function run(): void
    {
        // Clear menu_permission first (FK constraint)
        DB::table('menu_permission')->delete();

        foreach (self::MENUS as $menuId => $data) {
            Menu::updateOrCreate(
                ['menu_id' => $menuId],
                [
                    'name' => $data['name'],
                    'route' => $data['route'],
                    'icon' => $data['icon'],
                    'parent_id' => $data['parent_id'],
                    'active' => true,
                ],
            );
        }

        $this->command?->info('Menús creados/actualizados.');

        $now = now();

        foreach (self::MENUS as $menuId => $data) {
            if ($data['permission'] === null) {
                continue;
            }

            $permission = Permission::where('resource', $data['permission']['resource'])
                ->where('action', $data['permission']['action'])
                ->first();

            if ($permission === null) {
                $this->command?->warn("Permission {$data['permission']['resource']}.{$data['permission']['action']} not found — skipping menu {$menuId}.");

                continue;
            }

            DB::table('menu_permission')->insert([
                'menu_id' => $menuId,
                'permission_id' => $permission->permission_id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $this->command?->info('Permisos de menú asignados.');
    }
}
