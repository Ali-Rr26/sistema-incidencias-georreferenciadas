<?php

declare(strict_types=1);

use App\Domains\Comments\Models\Comment;
use App\Domains\Comments\Models\CommentImage;
use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Permissions\Models\Permission;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    // Seed roles and permissions (skip IncidentSeeder — requires PostGIS)
    Role::create(['name' => 'admin_sistema']);
    Role::create(['name' => 'operador_sistema']);
    Role::create(['name' => 'admin_organizacion']);
    Role::create(['name' => 'operador_organizacion']);
    Role::create(['name' => 'usuario']);

    Permission::create(['resource' => 'comments', 'action' => 'view',   'name' => 'Ver Comentarios',       'description' => '']);
    Permission::create(['resource' => 'comments', 'action' => 'create', 'name' => 'Agregar Comentarios',   'description' => '']);
    Permission::create(['resource' => 'comments', 'action' => 'update', 'name' => 'Editar Comentarios',    'description' => '']);
    Permission::create(['resource' => 'comments', 'action' => 'delete', 'name' => 'Eliminar Comentarios',  'description' => '']);
    Permission::create(['resource' => 'incidents', 'action' => 'view',   'name' => 'Ver Incidencias',      'description' => '']);
    Permission::create(['resource' => 'incidents', 'action' => 'create', 'name' => 'Crear Incidencias',    'description' => '']);
    Permission::create(['resource' => 'incidents', 'action' => 'update', 'name' => 'Actualizar Incidencias', 'description' => '']);
    Permission::create(['resource' => 'incidents', 'action' => 'delete', 'name' => 'Eliminar Incidencias', 'description' => '']);

    // Role-permission grants for admin_sistema (role_id = 1)
    foreach (Permission::all() as $perm) {
        DB::table('role_permission')->insert([
            'role_id' => 1,
            'permission_id' => $perm->permission_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    Storage::fake('s3');

    $this->user = User::factory()->create();
    $category = IncidentCategory::create(['name' => 'Test Cat']);
    $location = Location::create(['name' => 'Test Loc', 'level' => 'city']);
    $org = Organization::create(['name' => 'Test Org', 'location_id' => $location->id]);
    $incident = Incident::create([
        'incident_category_id' => $category->id,
        'organization_id' => $org->id,
        'user_id' => $this->user->id,
        'location_id' => $location->id,
        'title' => 'Test Incident',
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
    ]);
    $this->comment = Comment::create([
        'incident_id' => $incident->id,
        'user_id' => $this->user->id,
        'message' => 'Comment with images',
    ]);
});

it('deletes S3 images when comment is deleted', function (): void {
    Storage::disk('s3')->put('comments/1/img1.webp', 'content1');
    Storage::disk('s3')->put('comments/1/img2.webp', 'content2');

    CommentImage::create(['comment_id' => $this->comment->id, 'url' => 'comments/1/img1.webp']);
    CommentImage::create(['comment_id' => $this->comment->id, 'url' => 'comments/1/img2.webp']);

    $this->comment->delete();

    Storage::disk('s3')->assertMissing('comments/1/img1.webp');
    Storage::disk('s3')->assertMissing('comments/1/img2.webp');
});

it('soft-deletes comment even if S3 delete fails gracefully', function (): void {
    Storage::disk('s3')->put('comments/1/img1.webp', 'content1');
    CommentImage::create(['comment_id' => $this->comment->id, 'url' => 'comments/1/img1.webp']);

    $this->comment->delete();

    $this->assertSoftDeleted('comments', ['id' => $this->comment->id]);
    $this->assertDatabaseCount('comment_images', 0);
});
