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

    /** Equipment keys and human-readable labels shared by validation and presentation. */
    public const EQUIPMENT_FIELDS = [
        'control_estabilidad' => 'control de estabilidad',
        'frenos_abs' => 'frenos ABS',
        'airbags_frontales' => 'airbags frontales para conductor y acompañante',
        'airbags_laterales' => 'airbags laterales',
        'airbags_cortina' => 'airbags de cortina',
        'isofix' => 'anclajes ISOFIX',
        'frenado_autonomo' => 'frenado autónomo de emergencia',
        'asistencia_carril' => 'alerta o asistencia de carril',
        'punto_ciego' => 'alerta de punto ciego',
        'recordatorio_cinturon' => 'recordatorio de cinturón',
        'asistencia_velocidad' => 'asistencia de velocidad',
        'monitoreo_conductor' => 'monitoreo del conductor',
        'volante_regulable' => 'volante regulable en altura y profundidad',
        'climatizador_bizona' => 'climatizador bizona',
        'butacas_calefaccionadas' => 'butacas calefaccionadas',
        'android_auto_apple_carplay' => 'Android Auto o Apple CarPlay',
        'sensores_estacionamiento' => 'sensores de estacionamiento',
        'velocidad_crucero' => 'velocidad crucero',
        'camara_retroceso' => 'cámara de retroceso',
        'aire_acondicionado' => 'aire acondicionado o climatizador',
    ];

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
    public static function rules(mixed $plateUniqueRule = null, bool $includeMatchingFacts = false): array
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

        // The API opts in; the CSV contract is upgraded in its own chained stage.
        if ($includeMatchingFacts) {
            $rules += [
                'moneda' => ['required', Rule::in(VehiculoOptions::MONEDAS)],
                'plazas' => ['required', 'integer', 'between:1,32767'],
                'motor' => ['required', 'string', 'max:100'],
                'turbo' => ['required', 'boolean'],
                'potencia' => ['required', 'integer', 'between:1,2147483647'],
                'potencia_unidad' => ['required', Rule::in(VehiculoOptions::POTENCIA_UNIDADES)],
            ];
            foreach (['consumo_urbano', 'consumo_ruta'] as $field) {
                $rules[$field] = ['required_if:combustible,nafta,diesel', 'nullable', 'numeric', 'gt:0', 'decimal:0,2', 'max:9999.99'];
            }
            foreach (array_keys(self::EQUIPMENT_FIELDS) as $field) {
                $rules[$field] = ['required', 'boolean'];
            }
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
                'moneda', 'plazas', 'motor', 'turbo', 'potencia', 'potencia_unidad',
                'consumo_urbano', 'consumo_ruta',
                ...array_keys(self::EQUIPMENT_FIELDS),
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

        foreach ([
            'moneda' => ['Elegí ARS o USD.', ['required', 'in']],
            'plazas' => ['Indicá una cantidad de plazas entera y positiva.', ['required', 'integer', 'between']],
            'motor' => ['Indicá el motor (hasta 100 caracteres).', ['required', 'string', 'max']],
            'turbo' => ['Indicá si el motor tiene turbo.', ['required', 'boolean']],
            'potencia' => ['Indicá una potencia entera y positiva.', ['required', 'integer', 'between']],
            'potencia_unidad' => ['Elegí CV, HP o kW para la potencia.', ['required', 'in']],
            'consumo_urbano' => ['Indicá el consumo urbano en L/100 km: mayor que cero y con hasta dos decimales.', ['required_if', 'numeric', 'gt', 'decimal', 'max']],
            'consumo_ruta' => ['Indicá el consumo en ruta en L/100 km: mayor que cero y con hasta dos decimales.', ['required_if', 'numeric', 'gt', 'decimal', 'max']],
        ] as $field => [$message, $rules]) {
            foreach ($rules as $rule) {
                $messages["{$field}.{$rule}"] = $message;
            }
        }

        foreach (self::EQUIPMENT_FIELDS as $field => $label) {
            $messages["{$field}.required"] = "Indicá si tiene {$label} (sí o no).";
            $messages["{$field}.boolean"] = "Indicá si tiene {$label} (sí o no).";
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
