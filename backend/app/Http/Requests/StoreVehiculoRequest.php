<?php

namespace App\Http\Requests;

use App\Support\VehiculoFields;

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
        return [
            ...$this->vehiculoRules(),
            'fotos' => VehiculoFields::fotosCountRules(),
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
            ...VehiculoFields::fotosCountMessages(),
        ];
    }
}
