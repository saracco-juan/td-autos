<?php

namespace App\Support;

/**
 * Text fields of a dealer shared by the self-registration and the administrator's edit form:
 * label, ending of "obligatori_" (grammatical gender) and max length.
 */
final class DealerFields
{
    public const PUBLIC_PHONE_MESSAGE = 'Ingresá un teléfono con código de país, de 8 a 15 dígitos, o dejalo vacío.';

    public static function normalizePublicPhone(string $phone): ?string
    {
        $normalized = preg_replace('/[\s()+-]/u', '', $phone);

        return $normalized === '' ? null : $normalized;
    }

    public static function publicPhoneRules(): array
    {
        return ['present', 'nullable', 'string', 'max:30', 'regex:/^[1-9][0-9]{7,14}$/D'];
    }

    /**
     * @var array<string, array{string, string, int}>
     */
    public const FIELDS = [
        'nombre_concesionaria' => ['El nombre de la concesionaria', 'o', 150],
        'responsable_dni' => ['El DNI', 'o', 20],
        'telefono_publico' => ['El teléfono de la concesionaria', 'o', 30],
        'telefono_responsable' => ['El teléfono del responsable', 'o', 30],
        'direccion' => ['La dirección', 'a', 255],
        'localidad' => ['La localidad', 'a', 100],
        'provincia' => ['La provincia', 'a', 100],
    ];

    /**
     * @param  array<string, string>  $rename  Input name to use instead of a field's own name.
     * @return array<string, array<int, string>>
     */
    public static function rules(array $rename = []): array
    {
        $rules = [];

        foreach (self::FIELDS as $field => [, , $max]) {
            $rules[$rename[$field] ?? $field] = ['required', 'string', "max:{$max}"];
        }

        return $rules;
    }

    /**
     * @param  array<string, string>  $rename  Input name to use instead of a field's own name.
     * @return array<string, string>
     */
    public static function messages(array $rename = []): array
    {
        $messages = [];

        foreach (self::FIELDS as $field => [$label, $ending, $max]) {
            $key = $rename[$field] ?? $field;
            $messages["{$key}.required"] = "{$label} es obligatori{$ending}.";
            $messages["{$key}.string"] = "{$label} debe ser un texto.";
            $messages["{$key}.max"] = "{$label} no puede superar los {$max} caracteres.";
        }

        return $messages;
    }
}
