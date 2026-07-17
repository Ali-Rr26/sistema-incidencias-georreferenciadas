<?php

declare(strict_types=1);

namespace App\Domains\Comments\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCommentImageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            'images'   => ['required', 'array', 'min:1'],
            'images.*' => [
                'required',
                'image',
                'mimes:jpg,jpeg,png,gif,webp',
                'max:10240', // 10 MB per file
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'images.required' => 'Debes subir al menos una imagen.',
            'images.*.image'  => 'Cada archivo debe ser una imagen válida.',
            'images.*.mimes'  => 'Solo se permiten imágenes en formato JPG, PNG, GIF o WebP.',
            'images.*.max'    => 'Cada imagen no puede superar los 10 MB.',
        ];
    }
}
