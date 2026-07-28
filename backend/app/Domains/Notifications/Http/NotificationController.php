<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Http;

use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Http\Resources\NotificationResource;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Notifications\Services\NotificationService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly NotificationService $service,
    ) {}

    /**
     * Lista las notificaciones del usuario autenticado, paginadas.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => __('messages.unauthenticated')], 401);
        }

        $perPage = min((int) $request->integer('per_page', 20), 200);
        $page = max((int) $request->integer('page', 1), 1);

        $query = Notification::query()
            ->forUser($user)
            ->with('incident');

        if ($request->boolean('unread_only')) {
            $query->unread();
        }

        $notifications = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'data' => NotificationResource::collection($notifications->items())->resolve(),
            'meta' => [
                'total' => $notifications->total(),
                'per_page' => $notifications->perPage(),
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
            ],
            'unread_count' => Notification::query()->forUser($user)->unread()->count(),
        ]);
    }

    /**
     * Marca una notificación como leída (solo el dueño).
     */
    public function markRead(Request $request, Notification $notification): JsonResponse
    {
        $this->authorize('markAsRead', $notification);

        if (! $notification->read) {
            $notification->update(['read' => true]);
        }

        return (new NotificationResource($notification->fresh('incident')))->response();
    }

    public function approve(Notification $notification): JsonResponse
    {
        $this->assertIsDecidable($notification);
        $this->authorize('approve', $notification);

        // Atomic re-check: only update if no decision is recorded yet.
        // Without this, two concurrent requests could both pass the policy
        // check and last-write-wins the decision. 409 surfaces the race
        // to the caller instead of silently overwriting.
        $newData = array_merge($notification->data ?? [], [
            'decision' => 'approved',
            'rejection_reason' => null,
            'decided_at' => now()->toIso8601String(),
        ]);

        $updated = Notification::query()
            ->whereKey($notification->id)
            ->whereNull(DB::raw("data->>'decision'"))
            ->update([
                'data' => $newData,
                'read' => true,
            ]);

        if ($updated === 0) {
            return response()->json(
                ['message' => __('messages.notification_already_decided')],
                409,
            );
        }

        return (new NotificationResource($notification->fresh('incident')))->response();
    }

    public function reject(Request $request, Notification $notification): JsonResponse
    {
        $this->assertIsDecidable($notification);
        $this->authorize('reject', $notification);
        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:1000']]);
        $reason = $validated['reason'] ?? null;

        $newData = array_merge($notification->data ?? [], [
            'decision' => 'rejected',
            'rejection_reason' => $reason,
            'decided_at' => now()->toIso8601String(),
        ]);

        // Atomic re-check: same rationale as approve(). See note above.
        $updated = Notification::query()
            ->whereKey($notification->id)
            ->whereNull(DB::raw("data->>'decision'"))
            ->update([
                'data' => $newData,
                'read' => true,
            ]);

        if ($updated === 0) {
            return response()->json(
                ['message' => __('messages.notification_already_decided')],
                409,
            );
        }

        return (new NotificationResource($notification->fresh('incident')))->response();
    }

    /**
     * Bypass-proof guard for approve/reject.
     *
     * `Gate::before` in AppServiceProvider lets admin_sistema skip every
     * policy check, so the policy-level filters on type / expires_at /
     * prior-decision can be circumvented by a superuser. This method
     * re-asserts those invariants here, where Gate::before does not apply.
     *
     * Status codes:
     *  - 403 when the notification is the wrong type (not an approval)
     *  - 409 when the notification has already been decided or has expired
     *
     * 409 matches what the policy would emit for the same conditions
     * (see NotificationPolicy::canDecide) and signals "resource state
     * conflict" which is the right shape for re-decide and expiry races.
     */
    private function assertIsDecidable(Notification $notification): void
    {
        if ($notification->type !== NotificationType::IncidenciaAtendidaParaAprobacion) {
            abort(403, 'Esta notificación no es de tipo aprobación.');
        }

        $data = $notification->data ?? [];
        if (! empty($data['decision'])) {
            abort(409, __('messages.notification_already_decided'));
        }

        $expiresAt = $data['expires_at'] ?? null;
        if ($expiresAt !== null) {
            try {
                if (new \DateTimeImmutable($expiresAt) <= new \DateTimeImmutable) {
                    abort(409, __('messages.notification_already_decided'));
                }
            } catch (\Throwable) {
                abort(409, __('messages.notification_already_decided'));
            }
        }
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => __('messages.unauthenticated')], 401);
        }

        $count = $this->service->markAllAsRead($user);

        return response()->json([
            'updated' => $count,
            'unread_count' => 0,
        ]);
    }

    /**
     * Devuelve solo el conteo de no leídas (badge del header).
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => __('messages.unauthenticated')], 401);
        }

        $count = Notification::query()->forUser($user)->unread()->count();

        return response()->json(['unread_count' => $count]);
    }
}
