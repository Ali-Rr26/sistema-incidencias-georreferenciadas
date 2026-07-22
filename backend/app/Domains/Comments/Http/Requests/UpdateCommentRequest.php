<?php

declare(strict_types=1);

namespace App\Domains\Comments\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCommentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            'message' => ['required', 'string', 'max:5000'],
        ];
    }

    public function validated($key = null, $default = null)
    {
        $data = parent::validated($key, $default);

        if (is_array($data) && isset($data['message'])) {
            $data['message'] = htmlspecialchars($data['message'] ?? '', ENT_QUOTES, 'UTF-8');
        }

        return $data;
    }
}
