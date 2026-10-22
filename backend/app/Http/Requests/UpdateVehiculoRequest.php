<?php

namespace App\Http\Requests;

use App\Models\Vehiculo;
use App\Support\VehiculoOptions;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Unique;

/**
 * CU-19: a dealer edits one of its own vehicles. Every field is sent again.
 */
class UpdateVehiculoRequest extends VehiculoRequest
{
    private ?Vehiculo $vehiculo = null;

    /**
     * The vehicle of the route, looked up only among the signed-in dealer's own. Resolving it here
     * makes a foreign or missing id answer 404 before any validation message can hint it exists.
     */
    public function authorize(): bool
    {
        $this->vehiculo();

        return true;
    }

    public function vehiculo(): Vehiculo
    {
        return $this->vehiculo ??= $this->user()->concesionaria->vehiculos()
            ->with('fotos')
            ->findOrFail($this->route('id'));
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            ...$this->vehiculoRules(),
            'fotos' => ['nullable', 'array'],
            ...$this->fotoRules(),
            'fotos_eliminar' => ['nullable', 'array'],
            'fotos_eliminar.*' => ['integer', Rule::in($this->vehiculo()->fotos->pluck('id')->all())],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $foreign = 'Una de las fotos a eliminar no pertenece a este vehículo.';

        return [
            ...parent::messages(),
            'fotos.array' => 'Enviá las fotos nuevas como una lista de archivos.',
            'fotos_eliminar.array' => $foreign,
            'fotos_eliminar.*.integer' => $foreign,
            'fotos_eliminar.*.in' => $foreign,
        ];
    }

    /**
     * The final number of photos (current - removed + new) must stay inside the allowed range.
     *
     * @return array<int, \Closure(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            $photoErrors = array_filter(
                array_keys($validator->errors()->messages()),
                fn (string $key) => str_starts_with($key, 'fotos'),
            );

            if ($photoErrors !== []) {
                return;
            }

            $final = $this->vehiculo()->fotos->count() - count($this->fotosAEliminar()) + count($this->fotosNuevas());

            if ($final < VehiculoOptions::FOTOS_MINIMO) {
                $validator->errors()->add('fotos', self::FOTOS_MINIMO_MESSAGE);
            } elseif ($final > VehiculoOptions::FOTOS_MAXIMO) {
                $validator->errors()->add('fotos', self::FOTOS_MAXIMO_MESSAGE);
            }
        }];
    }

    /**
     * Ids of the photos of this vehicle to delete (checked by the rules).
     *
     * @return list<int>
     */
    public function fotosAEliminar(): array
    {
        return array_values(array_unique(array_map('intval', (array) $this->input('fotos_eliminar', []))));
    }

    /**
     * @return list<UploadedFile>
     */
    public function fotosNuevas(): array
    {
        return array_values((array) $this->file('fotos', []));
    }

    protected function plateUniqueRule(): Unique
    {
        return Rule::unique('vehiculo_concesionaria', 'patente_normalizada')->ignore($this->vehiculo()->id, 'vehiculo_id');
    }
}
