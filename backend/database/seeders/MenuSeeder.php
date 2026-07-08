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
     * Rutas alineadas con frontend/app/app.js. Padres de sección tienen
     * `route => null` (no son navegables, solo agrupan hijos).
     *
     * IDs con huecos: 5 era Asignaciones (borrado paso 06),
     *                  9 era Permisos (borrado paso 05-A),
     *                  10 era Menús (sin contraparte, removido),
     *                  15 era Notificaciones (sin ruta todavía, paso 07).
     *                  16/17/18 son entradas ciudadanas añadidas en el change
     *                  menu-server-driven (Inicio/Reportar/Perfil).
     *
     * @var array<int, array{name: string, route: string|null, icon: string|null, parent_id: int|null, permission: array{resource: string, action: string}|null}>
     */
    private const MENUS = [
        1 => ['name' => 'Dashboard',              'route' => '/dashboard',             'icon' => 'gauge-high',       'parent_id' => null, 'permission' => ['resource' => 'dashboard',           'action' => 'view']],
        // Incidencias group (parent header, no navegable)
        2 => ['name' => 'Incidencias',            'route' => null,                     'icon' => 'map-pin',          'parent_id' => null, 'permission' => null],
        3 => ['name' => 'Lista de Incidencias',   'route' => '/incidencias',           'icon' => 'list',             'parent_id' => 2,    'permission' => ['resource' => 'incidents',           'action' => 'view']],
        // id 4 gate: incidents.manage (re-gated from incidents.create in the
        // menu-server-driven change). incidents.create is the citizen /feed/crear
        // policy gate and remains in usuario grants.
        // menu_id 4 (Nueva Incidencia, admin) and menu_id 17 (Reportar, citizen)
        // intentionally live as TWO separate rows even though both mount
        // `incidenciaFormComponent` on the frontend. The frontend component is
        // shared (DRY), but the DB-level separation encodes the security
        // boundary established in commit 43e66378:
        //   - id  4 is gated by `incidents.manage` (back-office permission).
        //   - id 17 is gated by `feed.view`        (citizen feed permission).
        // Collapsing them into a single row with role-based route resolution
        // would re-introduce the leak where `usuario` (citizen) saw the admin
        // /incidencias/crear route in their menu despite lacking back-office
        // permissions. The routes also live in different namespaces by design
        // (/feed/crear is the citizen public funnel — analytics-tracked
        // separately — /incidencias/crear is the back-office create flow).
        // Do NOT refactor this pair without first re-reading commit 43e66378
        // and confirming the security boundary is preserved.
        4 => ['name' => 'Nueva Incidencia',       'route' => '/incidencias/crear',     'icon' => 'circle-plus',      'parent_id' => 2,    'permission' => ['resource' => 'incidents',           'action' => 'manage']],
        6 => ['name' => 'Pendientes',             'route' => '/incidencias/pendientes', 'icon' => 'clock',             'parent_id' => 2,    'permission' => ['resource' => 'incidents',           'action' => 'view']],
        // Gestión group (admin area, parent header)
        7 => ['name' => 'Gestión',                'route' => null,                     'icon' => 'shield-halved',    'parent_id' => null, 'permission' => null],
        8 => ['name' => 'Usuarios',               'route' => '/usuarios',              'icon' => 'user',             'parent_id' => 7,    'permission' => ['resource' => 'users',               'action' => 'view']],
        9 => ['name' => 'Roles',                  'route' => '/roles',                 'icon' => 'shield',           'parent_id' => 7,    'permission' => ['resource' => 'roles',               'action' => 'view']],
        // Catálogos group (parent header)
        10 => ['name' => 'Catálogos',             'route' => null,                     'icon' => 'book-open',        'parent_id' => null, 'permission' => null],
        11 => ['name' => 'Ubicaciones',           'route' => '/localizaciones',        'icon' => 'map',              'parent_id' => 10,   'permission' => ['resource' => 'locations',           'action' => 'view']],
        12 => ['name' => 'Categorías',            'route' => '/categorias',            'icon' => 'tag',              'parent_id' => 10,   'permission' => ['resource' => 'incident-categories', 'action' => 'view']],
        13 => ['name' => 'Organizaciones',        'route' => '/organizaciones',        'icon' => 'building',         'parent_id' => 10,   'permission' => ['resource' => 'organizations',       'action' => 'view']],
        // Standalone
        15 => ['name' => 'Notificaciones',        'route' => '/notificaciones',        'icon' => 'bell',             'parent_id' => null, 'permission' => ['resource' => 'notifications',       'action' => 'view']],
        // Citizen entries (no parent header, flat at the root)
        16 => ['name' => 'Inicio',                'route' => '/feed',                  'icon' => 'house',            'parent_id' => null, 'permission' => ['resource' => 'feed',                'action' => 'view']],
        17 => ['name' => 'Reportar',              'route' => '/feed/crear',            'icon' => 'circle-plus',      'parent_id' => null, 'permission' => ['resource' => 'feed',                'action' => 'view']], // See comment on menu_id 4 above — these two are a security-split pair, not a duplication to clean up.
        18 => ['name' => 'Perfil',                'route' => '/configuracion/perfil',  'icon' => 'user',             'parent_id' => null, 'permission' => ['resource' => 'profile',             'action' => 'view']],
        // Mapa georreferenciado — admin-only incident map view.
        19 => ['name' => 'Mapa',                  'route' => '/mapa',                  'icon' => 'map-location-dot', 'parent_id' => 2,    'permission' => ['resource' => 'incidents',           'action' => 'view']],
    ];

    public function run(): void
    {
        // Idempotent seed:
        //  1. Drop menus que ya no están en el array (data vieja huérfana)
        //  2. Drop menu_permission para esos menus
        //  3. Crear/actualizar cada menu del array
        //  4. Re-asignar menu_permission para los menus activos

        $keepIds = array_keys(self::MENUS);
        $toDelete = Menu::whereNotIn('menu_id', $keepIds)->pluck('menu_id')->all();
        if (! empty($toDelete)) {
            DB::table('menu_permission')->whereIn('menu_id', $toDelete)->delete();
            Menu::whereIn('menu_id', $toDelete)->delete();
        }

        // Clear remaining menu_permission for a clean re-assign
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
