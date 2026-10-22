<?php

namespace App\Http\Requests\Auth;

use App\Support\DealerFields;

/**
 * Dealer self-registration: the buyer registration rules for the responsible person,
 * plus the dealer's own data. Every field is required.
 */
class RegisterDealerRequest extends RegisterRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'apellido' => ['required', 'string', 'max:100'],
            ...DealerFields::rules(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...parent::messages(),
            'name.string' => 'El nombre debe ser un texto.',
            'apellido.required' => 'El apellido es obligatorio.',
            'apellido.string' => 'El apellido debe ser un texto.',
            'email.string' => 'El email debe ser un texto.',
            'password.string' => 'La contraseña debe ser un texto.',
            ...DealerFields::messages(),
        ];
    }
}
