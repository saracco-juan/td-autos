<?php

namespace App\Support;

use Illuminate\Validation\Rule;

/**
 * Rules and messages of the vehicle columns (everything but the photos), shared by the manual
 * form and the CSV import so both validate and answer the same way.
 */
final class VehiculoFields
{
    public const FOTOS_MINIMO_MESSAGE = 'Cargá al menos siete fotos.';

    public const FOTOS_MAXIMO_MESSAGE = 'Podés cargar hasta '.VehiculoOptions::FOTOS_MAXIMO.' fotos.';

    public const PATENTE_TAKEN_MESSAGE = 'Esa patente ya está cargada en la plataforma.';

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
     * Numeric columns: noun phrase.
     *
     * @var array<string, string>
     */
    private const NUMBER_FIELDS = [
        'anio' => 'el año',
        'kilometraje' => 'el kilometraje',
        'precio' => 'el precio',
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

    /**
     * Rules of every column of a vehicle except the photos.
     *
     * @param  mixed  $plateUniqueRule  Rule that decides whether the plate may be used; none when null.
     * @return array<string, array<int, mixed>>
     */
    public static function rules(mixed $plateUniqueRule = null): array
    {
        $rules = [
            'patente' => array_values(array_filter(
                ['bail', 'required', 'string', self::plateFormatRule(), $plateUniqueRule],
                fn ($rule) => $rule !== null,
            )),
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
     * Rules of the photo count, for a request field holding the whole list of photos.
     *
     * @return list<string>
     */
    public static function fotosCountRules(): array
    {
        return ['bail', 'required', 'array', 'min:'.VehiculoOptions::FOTOS_MINIMO, 'max:'.VehiculoOptions::FOTOS_MAXIMO];
    }

    /**
     * @return array<string, string>
     */
    public static function fotosCountMessages(): array
    {
        return [
            'fotos.required' => self::FOTOS_MINIMO_MESSAGE,
            'fotos.array' => self::FOTOS_MINIMO_MESSAGE,
            'fotos.min' => self::FOTOS_MINIMO_MESSAGE,
            'fotos.max' => self::FOTOS_MAXIMO_MESSAGE,
        ];
    }

    /**
     * Columns of the vehicle row taken from validated input (the body type is mapped from `carroceria_id`).
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    public static function attributes(array $validated): array
    {
        return [
            ...array_intersect_key($validated, array_flip([
                'marca', 'modelo', 'version', 'anio', 'kilometraje', 'precio',
                'transmision', 'combustible', 'ubicacion', 'descripcion',
            ])),
            'tipo_carroceria_id' => $validated['carroceria_id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function messages(): array
    {
        $messages = [
            'patente.required' => 'Indicá la patente.',
            'patente.string' => 'Indicá una patente válida, por ejemplo AB123CD o ABC123.',
            'patente.unique' => self::PATENTE_TAKEN_MESSAGE,
        ];

        foreach (self::TEXT_FIELDS as $field => [$noun, $max]) {
            $messages["{$field}.required"] = "Indicá {$noun}.";
            $messages["{$field}.string"] = "Revisá {$noun}: tiene que ser un texto.";
            $messages["{$field}.max"] = "Revisá {$noun}: no puede superar los {$max} caracteres.";
        }

        foreach (self::NUMBER_FIELDS as $field => $noun) {
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

        return $messages;
    }

    private static function plateFormatRule(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            if (! Patente::isValid($value)) {
                $fail('Ingresá una patente válida, por ejemplo AB123CD o ABC123.');
            }
        };
    }
}
