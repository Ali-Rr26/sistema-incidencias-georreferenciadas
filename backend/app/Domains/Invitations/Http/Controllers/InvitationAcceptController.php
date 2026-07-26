<?php

declare(strict_types=1);

namespace App\Domains\Invitations\Http\Controllers;

use App\Domains\Invitations\Exceptions\InvitationGoneException;
use App\Domains\Invitations\Exceptions\InvitationNotFoundException;
use App\Domains\Invitations\Http\Requests\InvitationAcceptRequest;
use App\Domains\Invitations\Services\InvitationService;
use Illuminate\Http\JsonResponse;

class InvitationAcceptController
{
    public function __construct(
        private readonly InvitationService $invitationService,
    ) {}

    /**
     * Acepta una invitación de usuario.
     *
     * POST /api/invitations/{token}/accept
     *
     * @throws InvitationNotFoundException 404
     * @throws InvitationGoneException 410
     */
    public function accept(InvitationAcceptRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $this->invitationService->acceptInvitation(
            tokenPlain: $validated['token'],
            password: $validated['password'],
            acceptTerms: (bool) $validated['accept_terms'],
            termsVersion: $validated['terms_version'],
        );

        return response()->json(['message' => __('messages.account_activated')], JsonResponse::HTTP_OK);
    }
}
