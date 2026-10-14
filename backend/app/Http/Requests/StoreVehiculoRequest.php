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
        $minimum = 'Cargá al menos siete fotos.';

        return [
            ...parent::messages(),
            'fotos.required' => $minimum,
            'fotos.array' => $minimum,
            'fotos.min' => $minimum,
            'fotos.max' => 'Podés cargar hasta '.VehiculoOptions::FOTOS_MAXIMO.' fotos.',
        ];
    }
}
