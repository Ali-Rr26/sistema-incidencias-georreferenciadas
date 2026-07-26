<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Centralized validation rules and regex for phone numbers across user profiles,
 * registration, and management endpoints.
 */
final class PhoneRules
{
    /** Regex matching numbers and standard phone formatting characters (+, -, spaces, parentheses). */
    public const REGEX = '/^[0-9\+\-\s\(\)]+$/';

    /** Custom error message in Spanish. */
    public const MESSAGE = 'El teléfono solo debe contener números y caracteres válidos (+, -, paréntesis).';

    /**
     * Common Laravel validation rules array for phone fields.
     *
     * @return array<int, string>
     */
    public static function rules(bool $sometimes = false): array
    {
        $rules = [];
        if ($sometimes) {
            $rules[] = 'sometimes';
        }
        $rules[] = 'nullable';
        $rules[] = 'string';
        $rules[] = 'max:50';
        $rules[] = 'regex:'.self::REGEX;

        return $rules;
    }
}
