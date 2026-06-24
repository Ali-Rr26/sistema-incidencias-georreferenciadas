<?php

declare(strict_types=1);

namespace App\Domains\Roles\Http;

use App\Domains\Roles\Models\Role;
use App\Domains\Roles\Repositories\RoleRepository;
use App\Domains\Roles\Http\Requests\StoreRoleRequest;
use App\Domains\Roles\Http\Requests\UpdateRoleRequest;
use App\Domains\Roles\Http\Resources\RoleCollection;
use App\Domains\Roles\Http\Resources\RoleResource;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;

class RoleController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private readonly RoleRepository $roles)
    {
        $this->authorizeResource(Role::class, 'role');
    }

    public function index(Request $request): JsonResponse
    {
        $role = $this->roles->paginate(
            $request->only(['search','per_page']),
        );

        return new RoleCollection($role)->response();
    }

    public function store(StoreRoleRequest $request): JsonResponse
    {
        $role = $this->roles->create(
            $request->validated(),
        );
        return (new RoleResource($role))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(int $id): JsonResponse
    {
        $role = $this->roles->findById($id);
        if($role === null){
            return response()->json([
                'message' => 'Rol no encontrado',
            ], Response::HTTP_NOT_FOUND);
        }
        return new RoleResource($role)->response();
    }

    public function update(UpdateRoleRequest $request, int $id): JsonResponse
    {
        $role = $this->roles->update($id, $request->validated());
        return new RoleResource($role)->response();
    }

    public function destroy(int $id): JsonResponse
    {
        $this->roles->delete($id);

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
