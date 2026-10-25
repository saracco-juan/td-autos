<?php

namespace App\Http\Requests;

use App\Models\Vehiculo;
use App\Services\Inventario\VehicleCatalogIdentity;
use App\Support\Patente;
use App\Support\VehiculoFields;
use App\Support\VehiculoOptions;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Unique;
use Illuminate\Validation\ValidationException;

/**
 * Rules and messages shared by every request that writes a dealer vehicle
 * (create now, update later). Subclasses add the photo-count rules and may
 * change the plate uniqueness rule.
 */
abstract class VehiculoRequest extends FormRequest
{
    private array $catalogIdentity = [];

    protected const FOTOS_MINIMO_MESSAGE = VehiculoFields::FOTOS_MINIMO_MESSAGE;

    protected const FOTOS_MAXIMO_MESSAGE = VehiculoFields::FOTOS_MAXIMO_MESSAGE;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * Spaces, dashes and lowercase are accepted; the plate is checked and stored normalized.
     */
    protected function prepareForValidation(): void
    {
        $plate = $this->input('patente');

        if (is_string($plate)) {
            $this->merge(['patente' => Patente::normalize($plate)]);
        }
    }

    /**
     * Rules of every column of the form except the photos.
     *
     * @return array<string, array<int, mixed>>
     */
    protected function vehiculoRules(): array
    {
        return VehiculoFields::rules($this->plateUniqueRule(), includeMatchingFacts: true)
            + ['acara_version_id' => ['nullable', 'string', 'max:70']];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            try {
                $this->catalogIdentity = app(VehicleCatalogIdentity::class)->resolve($this->all(), $this->catalogVehicle());
            } catch (ValidationException $error) {
                foreach ($error->errors() as $field => $messages) {
                    foreach ($messages as $message) {
                        $validator->errors()->add($field, $message);
                    }
                }
            }
        }];
    }

    protected function catalogVehicle(): ?Vehiculo
    {
        return null;
    }

    /**
     * Rules of every uploaded photo (not the count, which differs between create and update).
     *
     * @return array<string, array<int, mixed>>
     */
    protected function fotoRules(): array
    {
        return [
            'fotos.*' => [
                'file',
                'image',
                'mimes:'.implode(',', VehiculoOptions::FOTO_MIMES),
                'max:'.VehiculoOptions::FOTO_MAX_KB,
            ],
        ];
    }

    /**
     * The plate must be unique across the platform; update overrides this to ignore the vehicle itself.
     */
    protected function plateUniqueRule(): Unique
    {
        return Rule::unique('vehiculo_concesionaria', 'patente_normalizada');
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $photo = 'Cada foto tiene que ser una imagen JPG, PNG o WebP.';
        $megabytes = intdiv(VehiculoOptions::FOTO_MAX_KB, 1024);

        return VehiculoFields::messages() + [
            'fotos.*.file' => $photo,
            'fotos.*.image' => $photo,
            'fotos.*.mimes' => $photo,
            'fotos.*.uploaded' => 'No pudimos subir una de las fotos. Probá de nuevo.',
            'fotos.*.max' => "Cada foto puede pesar hasta {$megabytes} MB.",
        ];
    }

    /**
     * Columns of the vehicle row taken from the validated input.
     *
     * @return array<string, mixed>
     */
    public function vehiculoAttributes(): array
    {
        return [...VehiculoFields::attributes($this->validated()), ...$this->catalogIdentity];
    }
}
