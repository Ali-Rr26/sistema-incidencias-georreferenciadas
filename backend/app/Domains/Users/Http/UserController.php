<?php

declare(strict_types=1);

namespace App\Domains\Users\Http;

use App\Domains\Invitations\Services\InvitationService;
use App\Domains\Organizations\Repositories\OrganizationRepository;
use App\Domains\Roles\Repositories\RoleRepository;
use App\Domains\Users\Http\Requests\StoreUserRequest;
use App\Domains\Users\Http\Requests\UpdateUserRequest;
use App\Domains\Users\Http\Resources\UserCollection;
use App\Domains\Users\Http\Resources\UserResource;
use App\Domains\Users\Models\User;
use App\Domains\Users\Repositories\UserRepository;
use App\Domains\Users\Services\ProfileImageService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

class UserController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly UserRepository $users,
        private readonly ProfileImageService $profileImageService,
        private readonly RoleRepository $roles,
        private readonly OrganizationRepository $organizations,
        private readonly InvitationService $invitationService,
    ) {
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

        // Capture inviter before the closure — $request is not available after the
        // HTTP response is sent (afterCommit runs after request lifecycle).
        $inviter = $request->user();

        // Dispatch invitation mail after the transaction commits successfully.
        // If the transaction rolls back, the invitation is never created.
        DB::afterCommit(function () use ($user, $inviter): void {
            $this->invitationService->createAndSendInvitation($user, $inviter);
        });

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

    /**
     * Update a user record.
     *
     * Profile image is owned by this endpoint now (previously a separate
     * POST /users/{user}/avatar + DELETE /users/{user}/avatar pair, removed).
     * The update picks one of three paths based on the multipart payload:
     *
     *   - `avatar` file present           -> replaceAvatar() (deletes old, stores new)
     *   - `_delete_avatar=true`, no file  -> removeAvatar()   (deletes file, clears column)
     *   - neither present                 -> leave profile_image_path untouched
     */
    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $data = $request->validated();

        // Strip non-fillable helper fields; the controller decides avatar fate.
        unset($data['avatar'], $data['_delete_avatar']);

        if ($request->hasFile('avatar')) {
            $newPath = $this->profileImageService->replaceAvatar(
                $user,
                $request->file('avatar'),
            );
            $data['profile_image_path'] = $newPath;
        } elseif ($request->boolean('_delete_avatar')) {
            $this->profileImageService->removeAvatar($user);
            $data['profile_image_path'] = null;
        }

        $user = $this->users->update($user->id, $data);
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
     * and the user index filter bar — roles and organizations — in a single
     * request instead of two parallel ones.
     *
     * Authorization: requires users.view so only admins with user
     * management access can retrieve the catalog.
     */
    public function formData(Request $request): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        return response()->json([
            'roles' => $this->roles->catalog(),
            'organizations' => $this->organizations->catalog(),
        ]);
    }
}
