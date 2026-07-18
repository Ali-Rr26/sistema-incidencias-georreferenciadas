<?php

declare(strict_types=1);

namespace App\Domains\Users\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class StoreUserAvatarRequest extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('update', $this->route('user'));

        return true;
    }

    public function rules(): array
    {
        return [
            'avatar' => [
                'required',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120', // 5 MB in KB
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'avatar.required' => 'Debes subir una imagen de avatar.',
            'avatar.image' => 'El archivo debe ser una imagen válida.',
            'avatar.mimes' => 'Solo se permiten imágenes en formato JPG, PNG o WebP.',
            'avatar.max' => 'La imagen no puede superar los 5 MB.',
        ];
    }
}
