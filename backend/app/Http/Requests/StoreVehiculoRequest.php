<?php

namespace App\Http\Requests;

use App\Support\VehiculoOptions;

/**
 * CU-19: a dealer loads a new vehicle with its photos.
 */
class StoreVehiculoRequest extends VehiculoRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $count = ['bail', 'required', 'array', 'min:'.VehiculoOptions::FOTOS_MINIMO, 'max:'.VehiculoOptions::FOTOS_MAXIMO];

        return [
            ...$this->vehiculoRules(),
            'fotos' => $count,
            ...$this->fotoRules(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...parent::messages(),
            'fotos.required' => self::FOTOS_MINIMO_MESSAGE,
            'fotos.array' => self::FOTOS_MINIMO_MESSAGE,
            'fotos.min' => self::FOTOS_MINIMO_MESSAGE,
            'fotos.max' => self::FOTOS_MAXIMO_MESSAGE,
        ];
    }
}
