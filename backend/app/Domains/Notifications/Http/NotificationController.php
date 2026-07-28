<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Http;

use App\Domains\Incidents\Enums\ApprovalDecision;
use App\Domains\Incidents\Services\IncidentApprovalService;
use App\Domains\Notifications\Http\Resources\NotificationResource;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Notifications\Services\NotificationService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly NotificationService $service,
        private readonly IncidentApprovalService $approvalService,
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

        $perPage = min((int) $request->integer('per_page', 50), 200);
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

    /**
     * Aprueba una solicitud de aprobación. Delega a `IncidentApprovalService`
     * para todas las invariantes de dominio (status `resolved`, notificación
     * sin `processed_at`, no expirada, etc.). La policy — `who` — sólo
     * garantiza que el caller tiene autoridad para decidir; la policy `when`
     * (escenarios: ya decidida, expirada, etc.) vive en el service.
     */
    public function approve(Notification $notification): JsonResponse
    {
        $notification->loadMissing('incident');
        $this->authorize('approve', $notification);

        $source = $this->approvalService->decide(
            $notification->incident_id,
            Auth::user(),
            ApprovalDecision::Approved,
            null,
        );

        return (new NotificationResource($source->fresh('incident')))->response();
    }

    /**
     * Rechaza una solicitud de aprobación. La validación de `reason` vive
     * en el controller (no en la policy) porque `Gate::before` deja pasar a
     * `admin_sistema` por encima de cualquier policy. Lo mismo aplica al
     * service: ya valida que `reason` no esté vacío para `Rejected`, pero
     * ese check se ejecuta *después* del casteo del enum, así que necesitamos
     * cortar antes con un 422 explícito.
     */
    public function reject(Request $request, Notification $notification): JsonResponse
    {
        $notification->loadMissing('incident');
        $this->authorize('reject', $notification);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $source = $this->approvalService->decide(
            $notification->incident_id,
            Auth::user(),
            ApprovalDecision::Rejected,
            $validated['reason'],
        );

        return (new NotificationResource($source->fresh('incident')))->response();
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
