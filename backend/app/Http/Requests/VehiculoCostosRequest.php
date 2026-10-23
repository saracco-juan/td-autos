<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VehiculoCostosRequest extends FormRequest
{
    public const COBERTURAS = ['terceros_completo', 'todo_riesgo'];

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'km' => ['nullable', 'integer', 'min:0', 'max:20000'],
            'cobertura' => ['nullable', 'in:'.implode(',', self::COBERTURAS)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $km = 'Revisá los kilómetros: tienen que ser un número entero mayor o igual a 0.';

        return [
            'km.integer' => $km,
            'km.min' => $km,
            'km.max' => 'Revisá los kilómetros: el máximo es 20.000 por mes.',
            'cobertura.in' => 'Elegí una cobertura de la lista.',
        ];
    }
}
