<?php

declare(strict_types=1);

namespace App\StatusHistory\Interfaces\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StatusHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'estado_origen'  => $this->previous_status,
            'estado_destino' => $this->new_status,
            'comentario'     => $this->comentario,
            'timestamp'      => $this->created_at,
            'usuario'        => $this->whenLoaded('user', fn () => [
                'id'         => $this->user->id,
                'nombre'     => trim("{$this->user->first_name} {$this->user->last_name}"),
                'email'      => $this->user->email,
            ]),
        ];
    }
}
