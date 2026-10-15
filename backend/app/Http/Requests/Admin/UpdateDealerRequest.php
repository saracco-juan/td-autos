<?php

namespace App\Http\Requests\Admin;

use App\Models\Concesionaria;
use App\Support\DealerFields;
use App\Support\Email;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The administrator edits every RF15 data of a dealer except the password (RF32, TC-69).
 * Dealer fields keep the limits and messages of the self-registration.
 */
class UpdateDealerRequest extends FormRequest
{
    public const NOT_FOUND_MESSAGE = 'No encontramos la concesionaria.';

    private ?Concesionaria $dealer = null;

    /**
     * The dealer in the URL; an unknown id answers 404 before any field is validated.
     */
    public function dealer(): Concesionaria
    {
        return $this->dealer ??= Concesionaria::query()->with('usuario')->find($this->route('id'))
            ?? abort(404, self::NOT_FOUND_MESSAGE);
    }

    public function authorize(): bool
    {
        $this->dealer();

        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => Email::normalize($this->input('email'))]);
        }
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            ...DealerFields::rules(['nombre_concesionaria' => 'nombre']),
            'responsable_nombre' => ['required', 'string', 'max:255'],
            'responsable_apellido' => ['required', 'string', 'max:100'],
            'email' => [
                'required', 'string', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($this->dealer()->usuario_id),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...DealerFields::messages(['nombre_concesionaria' => 'nombre']),
            'responsable_nombre.required' => 'El nombre del responsable es obligatorio.',
            'responsable_nombre.string' => 'El nombre del responsable debe ser un texto.',
            'responsable_nombre.max' => 'El nombre del responsable no puede superar los 255 caracteres.',
            'responsable_apellido.required' => 'El apellido es obligatorio.',
            'responsable_apellido.string' => 'El apellido debe ser un texto.',
            'responsable_apellido.max' => 'El apellido no puede superar los 100 caracteres.',
            'email.required' => 'El email es obligatorio.',
            'email.string' => 'El email debe ser un texto.',
            'email.email' => 'El email no tiene un formato válido.',
            'email.max' => 'El email no puede superar los 255 caracteres.',
            'email.unique' => 'Ese email ya está en uso.',
        ];
    }
}
