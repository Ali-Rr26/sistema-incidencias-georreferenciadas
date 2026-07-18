<?php

declare(strict_types=1);

namespace Tests\Feature\Resources;

use App\Domains\Roles\Models\Role;
use App\Domains\Users\Http\Resources\UserResource;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserResourceTest extends TestCase
{
    use RefreshDatabase;

    public function test_to_array_includes_timestamps(): void
    {
        Role::create(['id' => 1, 'name' => 'admin_sistema']);

        $user = User::factory()->create();

        $resource = new UserResource($user);
        $array = $resource->toArray(request());

        $this->assertArrayHasKey('created_at', $array);
        $this->assertArrayHasKey('updated_at', $array);
        $this->assertNotNull($array['created_at']);
        $this->assertNotNull($array['updated_at']);
    }
}
