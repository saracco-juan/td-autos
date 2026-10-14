<?php

namespace App\Http\Requests;

use App\Support\Patente;
use App\Support\VehiculoOptions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Unique;

/**
 * Rules and messages shared by every request that writes a dealer vehicle
 * (create now, update later). Subclasses add the photo-count rules and may
 * change the plate uniqueness rule.
 */
abstract class VehiculoRequest extends FormRequest
{
    /**
     * Text columns: noun phrase used in the messages and maximum length.
     *
     * @var array<string, array{string, int}>
     */
    private const TEXT_FIELDS = [
        'marca' => ['la marca', 100],
        'modelo' => ['el modelo', 100],
        'version' => ['la versión', 100],
        'ubicacion' => ['la ubicación', 150],
        'descripcion' => ['la descripción', 2000],
    ];

    /**
     * Numeric columns: noun phrase and whether the value must be a whole number.
     *
     * @var array<string, array{string, bool}>
     */
    private const NUMBER_FIELDS = [
        'anio' => ['el año', true],
        'kilometraje' => ['el kilometraje', true],
        'precio' => ['el precio', false],
    ];

    /**
     * Fields picked from a list: noun phrase.
     *
     * @var array<string, string>
     */
    private const CHOICE_FIELDS = [
        'transmision' => 'la transmisión',
        'combustible' => 'el combustible',
        'carroceria_id' => 'la carrocería',
    ];

    /** Fields that may be left empty. */
    private const OPTIONAL_FIELDS = ['version', 'descripcion'];

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
        $rules = [
            'patente' => ['bail', 'required', 'string', $this->plateFormatRule(), $this->plateUniqueRule()],
            'anio' => ['required', 'integer', 'between:1950,'.((int) date('Y') + 1)],
            'kilometraje' => ['required', 'integer', 'between:0,2000000'],
            'precio' => ['required', 'numeric', 'between:1,9999999999.99'],
            'transmision' => ['required', Rule::in(VehiculoOptions::TRANSMISION)],
            'combustible' => ['required', Rule::in(VehiculoOptions::COMBUSTIBLE)],
            'carroceria_id' => ['required', 'integer', Rule::exists('tipo_carroceria', 'id')],
        ];

        foreach (self::TEXT_FIELDS as $field => [, $max]) {
            $presence = in_array($field, self::OPTIONAL_FIELDS, true) ? 'nullable' : 'required';
            $rules[$field] = [$presence, 'string', "max:{$max}"];
        }

        return $rules;
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
        $messages = [
            'patente.required' => 'Indicá la patente.',
            'patente.string' => 'Indicá una patente válida, por ejemplo AB123CD o ABC123.',
            'patente.unique' => 'Esa patente ya está cargada en la plataforma.',
        ];

        foreach (self::TEXT_FIELDS as $field => [$noun, $max]) {
            $messages["{$field}.required"] = "Indicá {$noun}.";
            $messages["{$field}.string"] = "Revisá {$noun}: tiene que ser un texto.";
            $messages["{$field}.max"] = "Revisá {$noun}: no puede superar los {$max} caracteres.";
        }

        foreach (self::NUMBER_FIELDS as $field => [$noun, $whole]) {
            $messages["{$field}.required"] = "Indicá {$noun}.";
            $messages["{$field}.integer"] = "Revisá {$noun}: tiene que ser un número entero.";
            $messages["{$field}.numeric"] = "Revisá {$noun}: tiene que ser un número.";
            $messages["{$field}.between"] = "Revisá {$noun}: está fuera del rango permitido.";
        }

        foreach (self::CHOICE_FIELDS as $field => $noun) {
            $messages["{$field}.required"] = "Elegí {$noun}.";
            $messages["{$field}.in"] = "Elegí {$noun} de la lista.";
            $messages["{$field}.integer"] = "Elegí {$noun} de la lista.";
            $messages["{$field}.exists"] = "Elegí {$noun} de la lista.";
        }

        $photo = 'Cada foto tiene que ser una imagen JPG, PNG o WebP.';
        $megabytes = intdiv(VehiculoOptions::FOTO_MAX_KB, 1024);

        return $messages + [
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
        $data = $this->validated();

        return [
            ...array_intersect_key($data, array_flip([
                'marca', 'modelo', 'version', 'anio', 'kilometraje', 'precio',
                'transmision', 'combustible', 'ubicacion', 'descripcion',
            ])),
            'tipo_carroceria_id' => $data['carroceria_id'],
        ];
    }

    private function plateFormatRule(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            if (! Patente::isValid($value)) {
                $fail('Ingresá una patente válida, por ejemplo AB123CD o ABC123.');
            }
        };
    }
}
