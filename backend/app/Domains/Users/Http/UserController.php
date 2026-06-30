<?php

declare(strict_types=1);

namespace App\Domains\Users\Http;

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

        return (new UserResource($user))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(int $id): JsonResponse
    {
        $user = $this->users->findById($id);

        if ($user === null) {
            return response()->json([
                'message' => 'Usuario no encontrado.',
            ], Response::HTTP_NOT_FOUND);
        }

        return new UserResource($user)->response();
    }

    public function update(UpdateUserRequest $request, int $id): JsonResponse
    {
        $user = $this->users->update($id, $request->validated());

        return new UserResource($user)->response();
    }

    public function destroy(int $id): JsonResponse
    {
        $this->users->delete($id);

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
