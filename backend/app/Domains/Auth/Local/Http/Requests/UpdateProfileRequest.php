<?php

declare(strict_types=1);

namespace App\Domains\Auth\Local\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $rules = [
            'first_name' => ['sometimes', 'string', 'max:100'],
            'last_name' => ['sometimes', 'string', 'max:100'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'password' => ['sometimes', 'nullable', 'string', 'min:8'],
        ];

        // Multipart: avatar as file upload
        if ($this->hasFile('avatar')) {
            $rules['avatar'] = [
                'required',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:800', // 800 KB
            ];
        } else {
            // JSON: avatar as legacy { urls: [...] } object
            $rules['avatar'] = ['sometimes', 'array'];
            $rules['avatar.urls'] = Rule::when(
                $this->has('avatar.urls'),
                ['array', 'max:5'],
            );
            $rules['avatar.urls.*'] = Rule::when(
                $this->has('avatar.urls'),
                ['string', 'url'],
            );
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'avatar.required' => 'Debes subir una imagen de avatar.',
            'avatar.image' => 'El archivo debe ser una imagen válida.',
            'avatar.mimes' => 'Solo se permiten imágenes en formato JPG, PNG o WebP.',
            'avatar.max' => 'La imagen no puede superar los 800 KB.',
        ];
    }
}
