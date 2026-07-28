<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Enums;

/**
 * Decisión de un admin sobre una incidencia `resolved`.
 *
 * Solo dos outcomes canónicos. El enum se usa para evitar strings sueltos en
 * `IncidentApprovalService::decide()` y en cualquier chequeo posterior; los
 * valores coinciden con los que persistía el refactor histórico en la
 * columna `data->decision` del JSONB de `notifications` (decisión legacy)
 * — mantener el mismo vocabulario evita migrar datos legacy.
 */
enum ApprovalDecision: string
{
    case Approved = 'approved';
    case Rejected = 'rejected';

    /**
     * Backing string values for every case.
     *
     * Native PHP enums only expose `cases()`; this helper returns the
     * plain string values so callers (e.g. controller validation, future
     * CHECK constraints) can iterate without reaching into each case.
     *
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Spanish display label for the decision. Mirrors `IncidentStatus::label()`:
     * the enum owns the user-facing strings so neither the API response nor
     * the frontend constants codegen can drift.
     */
    public function label(): string
    {
        return match ($this) {
            self::Approved => 'Aprobado',
            self::Rejected => 'Rechazado',
        };
    }
}
