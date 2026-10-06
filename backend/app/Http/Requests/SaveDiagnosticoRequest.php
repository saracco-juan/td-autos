<?php

namespace App\Http\Requests;

use App\Models\TipoCarroceria;
use App\Support\DiagnosticoOptions;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveDiagnosticoRequest extends FormRequest
{
    private const SCALAR_FIELDS = ['presupuesto', 'uso_principal', 'pasajeros', 'kilometros_mensuales', 'transmision', 'prioridad'];

    private const INVALID_BODY_TYPE = 'El tipo de carrocería elegido no es válido.';

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
            'presupuesto' => $this->option(array_keys(DiagnosticoOptions::PRESUPUESTO)),
            'uso_principal' => $this->option(DiagnosticoOptions::USO_PRINCIPAL),
            'pasajeros' => $this->option(array_keys(DiagnosticoOptions::PASAJEROS)),
            'kilometros_mensuales' => $this->option(DiagnosticoOptions::KILOMETROS_MENSUALES),
            'transmision' => $this->option(DiagnosticoOptions::TRANSMISION),
            'prioridad' => $this->option(DiagnosticoOptions::PRIORIDAD),
            'carrocerias' => ['bail', 'required', 'array', 'min:1', 'max:2', $this->existingDistinctIds(...)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $messages = [
            'carrocerias.required' => 'Elegí al menos un tipo de carrocería.',
            'carrocerias.min' => 'Elegí al menos un tipo de carrocería.',
            'carrocerias.max' => 'Podés elegir hasta dos tipos de carrocería.',
            'carrocerias.array' => self::INVALID_BODY_TYPE,
        ];

        foreach (self::SCALAR_FIELDS as $field) {
            foreach (['required', 'string', 'in'] as $rule) {
                $messages["$field.$rule"] = 'Elegí una opción.';
            }
        }

        return $messages;
    }

    /**
     * @param  list<string>  $codes
     * @return array<int, mixed>
     */
    private function option(array $codes): array
    {
        return ['bail', 'required', 'string', Rule::in($codes)];
    }

    /**
     * Every id must be an integer, appear once and exist in the catalog.
     */
    private function existingDistinctIds(string $attribute, mixed $ids, Closure $fail): void
    {
        $ids = array_values((array) $ids);

        $valid = collect($ids)->every(fn ($id) => is_int($id))
            && count(array_unique($ids)) === count($ids)
            && TipoCarroceria::whereIn('id', $ids)->count() === count($ids);

        if (! $valid) {
            $fail(self::INVALID_BODY_TYPE);
        }
    }
}
