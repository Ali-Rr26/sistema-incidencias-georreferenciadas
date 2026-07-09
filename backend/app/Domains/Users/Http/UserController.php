<?php

declare(strict_types=1);

namespace App\Domains\Users\Http;

use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Http\Requests\StoreUserRequest;
use App\Domains\Users\Http\Requests\UpdateUserRequest;
use App\Domains\Users\Http\Resources\UserCollection;
use App\Domains\Users\Http\Resources\UserResource;
use App\Domains\Users\Models\User;
use App\Domains\Users\Repositories\UserRepository;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;

class UserController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private readonly UserRepository $users)
    {
        $this->authorizeResource(User::class, 'user');
    }

    public function index(Request $request): JsonResponse
    {
        $users = $this->users->paginate(
            $request->only(['role_id', 'organization_id', 'search', 'per_page']),
        );

        return new UserCollection($users)->response();
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = $this->users->create(
            $request->validated(),
        );
        $user->load(['role', 'organization']);

        return (new UserResource($user))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(User $user): JsonResponse
    {
        $user->load(['role', 'organization']);

        return (new UserResource($user))->withCatalog()->response();
    }

    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $user = $this->users->update($user->id, $request->validated());
        $user->load(['role', 'organization']);

        return new UserResource($user)->response();
    }

    public function destroy(User $user): JsonResponse
    {
        $this->users->delete($user->id);

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Returns the catalogs needed to render the user create/edit form
     * and the user index filter bar — roles and organizations — in a
     * single request instead of two parallel ones.
     *
     * Authorization: requires users.view so only admins with user
     * management access can retrieve the catalog.
     */
    public function formData(Request $request): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        return response()->json([
            'roles' => Role::orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Role $r) => ['id' => $r->id, 'name' => $r->name])
                ->values(),
            'organizations' => Organization::orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Organization $o) => ['id' => $o->id, 'name' => $o->name])
                ->values(),
        ]);
    }
}
