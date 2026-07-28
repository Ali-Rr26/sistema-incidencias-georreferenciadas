<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Enums;

enum NotificationType: string
{
    case Claim = 'claim';
    case Assignment = 'assignment';
    case StatusChange = 'status_change';
    case Assigned = 'assigned';
    case Comment = 'comment';
    case Legacy = 'legacy';
    case IncidenciaAtendidaParaAprobacion = 'incidencia_atendida_para_aprobacion';

    /**
     * Outcome of an admin decision on a resolved incident.
     *
     * These are deliberately NOT `StatusChange`, even though the incident
     * status does change. `NotificationService::notify()` drops a message
     * when an identical `user_id` + `type` + `incident_id` row exists within
     * the last 60 seconds, and returns `null` without raising. The observer
     * already emits `StatusChange` to the citizen when the incident turns
     * `resolved`, so reusing it here made the approval notice disappear
     * whenever the admin decided within that window — the happy path for an
     * admin watching the bell over SSE. Distinct types keep both messages.
     */
    case ResolucionAprobada = 'resolucion_aprobada';

    case ResolucionRechazada = 'resolucion_rechazada';

    /**
     * Backing string values for every case — single source for the
     * `notifications_type_check` CHECK constraint kept in sync by
     * migrations.
     *
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
