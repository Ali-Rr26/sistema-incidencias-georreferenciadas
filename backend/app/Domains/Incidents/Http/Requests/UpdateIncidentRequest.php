<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Requests;

use App\Domains\Incidents\Http\Rules\LocationGeomConsistentRule;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Shared\Services\InputSanitizer;
use App\Storage\ImageRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class UpdateIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $incident = $this->route('incident');
        if (! $incident instanceof Incident) {
            $incident = Incident::find($incident);
        }

        if ($incident === null) {
            return false;
        }

        $user = $this->user();
        if ($user === null) {
            return false;
        }

        if (! $user->can('update', $incident)) {
            return false;
        }

        // Status transitions require the user to be 'responsable' — the rule
        // lives in IncidentPolicy::updateStatus (single owner); Gate::authorize
        // preserves the deny message as the 403 body.
        if ($this->has('status')) {
            Gate::authorize('updateStatus', [$incident, (string) $this->input('status')]);
        }

        if ($user->isOperator()) {
            $lockedFields = ['title', 'priority', 'incident_category_id', 'location_id'];
            foreach ($lockedFields as $field) {
                if ($this->has($field)) {
                    return false;
                }
            }
        }

        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|nullable|string',
            'incident_category_id' => 'sometimes|integer|exists:incident_categories,id',
            'location_id' => ['sometimes', 'integer', 'exists:locations,id', app(LocationGeomConsistentRule::class)],
            'status' => ['sometimes', Rule::in([Incident::STATUS_PENDING, Incident::STATUS_IN_PROGRESS, Incident::STATUS_RESOLVED])],
            'priority' => ['sometimes', Rule::in([Incident::PRIORITY_LOW, Incident::PRIORITY_MEDIUM, Incident::PRIORITY_HIGH])],
            'resolution_date' => 'nullable|date',
            'geom' => 'nullable|json',

            // Imágenes opcionales (multipart)
            'images' => [...['nullable'], ...ImageRules::galleryArrayRules()],
            'images.*' => [...['nullable'], ...ImageRules::galleryFileRules()],
        ];
    }

    protected function passedValidation(): void
    {
        $sanitized = InputSanitizer::sanitizeRequest(
            $this->validated(),
            textFields: ['title', 'description'],
        );
        $this->replace($sanitized);
    }

    public function messages(): array
    {
        return [
            'status.in' => 'Status must be: pending, in_progress or resolved.',
            'priority.in' => 'Priority must be: low, medium or high.',
            'resolution_date.date' => 'La fecha ingresada no es válida. Use el formato DD/MM/AAAA.',
            'images.max' => 'You can attach a maximum of '.ImageRules::MAX_FILES.' images.',
            'images.*.image' => 'Each file must be an image.',
            'images.*.mimes' => 'Only JPEG, PNG, WEBP or GIF images are allowed.',
            'images.*.max' => 'Each image must not exceed '.(ImageRules::MAX_SIZE_KB / 1024).' MB.',
        ];
    }
}
