<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Enums;

enum ApprovalDecision: string
{
    case Approved = 'approved';
    case Rejected = 'rejected';

    /**
     * Backing string values for every case.
     *
     * Mirrors IncidentStatus::values() so the CHECK constraint in
     * 2026_07_28_000001_create_incident_approvals_table and any frontend
     * constant codegen read from a single source.
     *
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
