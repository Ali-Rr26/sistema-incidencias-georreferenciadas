<?php

declare(strict_types=1);

namespace App\Domains\Users\Http\Controllers;

use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Http\Requests\StoreUserAvatarRequest;
use App\Domains\Users\Http\Resources\UserResource;
use App\Domains\Users\Services\ProfileImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

class UserAvatarController extends Controller
{
    public function __construct(
        private readonly ProfileImageService $profileImageService,
    ) {
        $this->middleware(JwtAuthenticate::class);
    }

    /**
     * POST /api/users/{user}/avatar
     *
     * Upload and replace the user's avatar image.
     */
    public function store(StoreUserAvatarRequest $request, int $user): JsonResponse
    {
        $targetUser = $request->user();
        $path = $this->profileImageService->replaceAvatar($targetUser, $request->file('avatar'));

        return response()->json(
            new UserResource($targetUser->load(['role', 'organization'])),
        );
    }

    /**
     * DELETE /api/users/{user}/avatar
     *
     * Remove the user's avatar image.
     */
    public function destroy(int $user): JsonResponse
    {
        $targetUser = auth()->user();
        $this->profileImageService->removeAvatar($targetUser);

        return response()->json(
            new UserResource($targetUser->load(['role', 'organization'])),
        );
    }
}
