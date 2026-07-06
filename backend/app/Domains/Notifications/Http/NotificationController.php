<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Http;

use App\Domains\Notifications\Http\Resources\NotificationResource;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Notifications\Services\NotificationService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

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
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $perPage = min((int) $request->integer('per_page', 20), 50);
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
     * Marca todas las notificaciones del usuario como leídas.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
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
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $count = Notification::query()->forUser($user)->unread()->count();

        return response()->json(['unread_count' => $count]);
    }
}
