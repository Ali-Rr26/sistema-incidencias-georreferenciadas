<?php

declare(strict_types=1);

namespace App\Domains\Assignments\Enums;

enum AssignmentRole: string
{
    case Responsible = 'responsible';
    case Support = 'support';
}
