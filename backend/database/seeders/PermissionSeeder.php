<?php

namespace Database\Seeders;

use App\Domains\Permissions\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    private const PERMISSIONS = [
        // Dashboard
        ['resource' => 'dashboard',           'action' => 'view',   'name' => 'Ver Dashboard',                'description' => 'Acceso al dashboard principal'],
        // Incidents
        ['resource' => 'incidents',           'action' => 'view',   'name' => 'Ver Incidencias',             'description' => 'Listar y ver detalle de incidencias'],
        ['resource' => 'incidents',           'action' => 'create', 'name' => 'Crear Incidencias',           'description' => 'Registrar nuevas incidencias'],
        ['resource' => 'incidents',           'action' => 'update', 'name' => 'Actualizar Incidencias',      'description' => 'Modificar incidencias existentes'],
        ['resource' => 'incidents',           'action' => 'delete', 'name' => 'Eliminar Incidencias',        'description' => 'Eliminar incidencias'],
        // Comments
        ['resource' => 'comments',            'action' => 'view',   'name' => 'Ver Comentarios',             'description' => 'Ver comentarios de incidencias'],
        ['resource' => 'comments',            'action' => 'create', 'name' => 'Agregar Comentarios',         'description' => 'Comentar en incidencias'],
        ['resource' => 'comments',            'action' => 'update', 'name' => 'Editar Comentarios',          'description' => 'Editar comentarios propios'],
        ['resource' => 'comments',            'action' => 'delete', 'name' => 'Eliminar Comentarios',        'description' => 'Eliminar comentarios'],
// Status history
        ['resource' => 'status-history',      'action' => 'view',   'name' => 'Ver Historial de Estados',    'description' => 'Ver historial de cambios de estado'],
        // Notifications
        ['resource' => 'notifications',       'action' => 'view',   'name' => 'Ver Notificaciones',          'description' => 'Ver notificaciones propias'],
        ['resource' => 'notifications',       'action' => 'update', 'name' => 'Gestionar Notificaciones',    'description' => 'Marcar notificaciones como leídas'],
        // Locations
        ['resource' => 'locations',           'action' => 'view',   'name' => 'Ver Ubicaciones',             'description' => 'Listar ubicaciones'],
        ['resource' => 'locations',           'action' => 'create', 'name' => 'Crear Ubicaciones',           'description' => 'Agregar ubicaciones'],
        ['resource' => 'locations',           'action' => 'update', 'name' => 'Actualizar Ubicaciones',      'description' => 'Modificar ubicaciones'],
        ['resource' => 'locations',           'action' => 'delete', 'name' => 'Eliminar Ubicaciones',        'description' => 'Eliminar ubicaciones'],
        // Organizations
        ['resource' => 'organizations',       'action' => 'view',   'name' => 'Ver Organizaciones',          'description' => 'Listar organizaciones'],
        ['resource' => 'organizations',       'action' => 'create', 'name' => 'Crear Organizaciones',        'description' => 'Agregar organizaciones'],
        ['resource' => 'organizations',       'action' => 'update', 'name' => 'Actualizar Organizaciones',   'description' => 'Modificar organizaciones'],
        ['resource' => 'organizations',       'action' => 'delete', 'name' => 'Eliminar Organizaciones',     'description' => 'Eliminar organizaciones'],
        // Incident categories
        ['resource' => 'incident-categories', 'action' => 'view',   'name' => 'Ver Categorías',              'description' => 'Listar categorías de incidencias'],
        ['resource' => 'incident-categories', 'action' => 'create', 'name' => 'Crear Categorías',            'description' => 'Agregar categorías de incidencias'],
        ['resource' => 'incident-categories', 'action' => 'update', 'name' => 'Actualizar Categorías',       'description' => 'Modificar categorías de incidencias'],
        ['resource' => 'incident-categories', 'action' => 'delete', 'name' => 'Eliminar Categorías',         'description' => 'Eliminar categorías de incidencias'],
        // Users
        ['resource' => 'users',               'action' => 'view',   'name' => 'Ver Usuarios',                'description' => 'Listar usuarios del sistema'],
        ['resource' => 'users',               'action' => 'create', 'name' => 'Crear Usuarios',              'description' => 'Registrar nuevos usuarios'],
        ['resource' => 'users',               'action' => 'update', 'name' => 'Actualizar Usuarios',         'description' => 'Modificar datos de usuarios'],
        ['resource' => 'users',               'action' => 'delete', 'name' => 'Eliminar Usuarios',           'description' => 'Eliminar usuarios'],
        // Roles
        ['resource' => 'roles',               'action' => 'view',   'name' => 'Ver Roles',                   'description' => 'Listar roles del sistema'],
        ['resource' => 'roles',               'action' => 'create', 'name' => 'Crear Roles',                 'description' => 'Agregar nuevos roles'],
        ['resource' => 'roles',               'action' => 'update', 'name' => 'Actualizar Roles',            'description' => 'Modificar roles existentes'],
        ['resource' => 'roles',               'action' => 'delete', 'name' => 'Eliminar Roles',              'description' => 'Eliminar roles'],
        // Permissions
        ['resource' => 'permissions',         'action' => 'view',   'name' => 'Ver Permisos',                'description' => 'Listar permisos del sistema'],
        ['resource' => 'permissions',         'action' => 'create', 'name' => 'Crear Permisos',              'description' => 'Agregar nuevos permisos'],
        ['resource' => 'permissions',         'action' => 'update', 'name' => 'Actualizar Permisos',         'description' => 'Modificar permisos existentes'],
        ['resource' => 'permissions',         'action' => 'delete', 'name' => 'Eliminar Permisos',           'description' => 'Eliminar permisos'],
        // Menus
        ['resource' => 'menus',               'action' => 'view',   'name' => 'Ver Menús',                   'description' => 'Listar menús del sistema'],
        ['resource' => 'menus',               'action' => 'create', 'name' => 'Crear Menús',                 'description' => 'Agregar nuevos menús'],
        ['resource' => 'menus',               'action' => 'update', 'name' => 'Actualizar Menús',            'description' => 'Modificar menús existentes'],
        ['resource' => 'menus',               'action' => 'delete', 'name' => 'Eliminar Menús',              'description' => 'Eliminar menús'],
    ];

    public function run(): void
    {
        foreach (self::PERMISSIONS as $data) {
            Permission::updateOrCreate(
                ['resource' => $data['resource'], 'action' => $data['action']],
                ['name' => $data['name'], 'description' => $data['description']],
            );
        }

        $this->command?->info('Permisos creados/actualizados.');
    }
}
