<?php

namespace App\Http\Requests\Auth;

/**
 * Dealer self-registration: the buyer registration rules for the responsible person,
 * plus the dealer's own data. Every field is required.
 */
class RegisterDealerRequest extends RegisterRequest
{
    /**
     * Dealer-only text fields: label, ending of "obligatori_" (grammatical gender) and max length.
     *
     * @var array<string, array{string, string, int}>
     */
    private const DEALER_FIELDS = [
        'nombre_concesionaria' => ['El nombre de la concesionaria', 'o', 150],
        'responsable_dni' => ['El DNI', 'o', 20],
        'telefono_publico' => ['El teléfono de la concesionaria', 'o', 30],
        'telefono_responsable' => ['El teléfono del responsable', 'o', 30],
        'direccion' => ['La dirección', 'a', 255],
        'localidad' => ['La localidad', 'a', 100],
        'provincia' => ['La provincia', 'a', 100],
    ];

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $rules = [...parent::rules(), 'apellido' => ['required', 'string', 'max:100']];

        foreach (self::DEALER_FIELDS as $field => [, , $max]) {
            $rules[$field] = ['required', 'string', "max:{$max}"];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $messages = [
            ...parent::messages(),
            'name.string' => 'El nombre debe ser un texto.',
            'apellido.required' => 'El apellido es obligatorio.',
            'apellido.string' => 'El apellido debe ser un texto.',
            'email.string' => 'El email debe ser un texto.',
            'password.string' => 'La contraseña debe ser un texto.',
        ];

        foreach (self::DEALER_FIELDS as $field => [$label, $ending, $max]) {
            $messages["{$field}.required"] = "{$label} es obligatori{$ending}.";
            $messages["{$field}.string"] = "{$label} debe ser un texto.";
            $messages["{$field}.max"] = "{$label} no puede superar los {$max} caracteres.";
        }

        return $messages;
    }
}
