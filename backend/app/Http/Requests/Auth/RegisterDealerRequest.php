<?php

namespace App\Http\Requests\Auth;

use App\Rules\StrongPassword;
use App\Support\Email;
use Illuminate\Foundation\Http\FormRequest;

class RegisterDealerRequest extends FormRequest
{
    public function authorize(): bool
    {
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
            'nombre_concesionaria' => ['required', 'string', 'max:150'],
            'name' => ['required', 'string', 'max:255'],
            'apellido' => ['required', 'string', 'max:100'],
            'responsable_dni' => ['required', 'string', 'max:20'],
            'telefono_publico' => ['required', 'string', 'max:30'],
            'telefono_responsable' => ['required', 'string', 'max:30'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'direccion' => ['required', 'string', 'max:255'],
            'localidad' => ['required', 'string', 'max:100'],
            'provincia' => ['required', 'string', 'max:100'],
            'password' => ['required', 'string', 'confirmed', new StrongPassword],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'nombre_concesionaria.required' => 'El nombre de la concesionaria es obligatorio.',
            'nombre_concesionaria.max' => 'El nombre de la concesionaria no puede superar los 150 caracteres.',
            'name.required' => 'El nombre es obligatorio.',
            'name.max' => 'El nombre no puede superar los 255 caracteres.',
            'apellido.required' => 'El apellido es obligatorio.',
            'apellido.max' => 'El apellido no puede superar los 100 caracteres.',
            'responsable_dni.required' => 'El DNI es obligatorio.',
            'responsable_dni.max' => 'El DNI no puede superar los 20 caracteres.',
            'telefono_publico.required' => 'El teléfono de la concesionaria es obligatorio.',
            'telefono_publico.max' => 'El teléfono de la concesionaria no puede superar los 30 caracteres.',
            'telefono_responsable.required' => 'El teléfono del responsable es obligatorio.',
            'telefono_responsable.max' => 'El teléfono del responsable no puede superar los 30 caracteres.',
            'email.required' => 'El email es obligatorio.',
            'email.email' => 'El email no tiene un formato válido.',
            'email.max' => 'El email no puede superar los 255 caracteres.',
            'email.unique' => 'El email ya está en uso.',
            'direccion.required' => 'La dirección es obligatoria.',
            'direccion.max' => 'La dirección no puede superar los 255 caracteres.',
            'localidad.required' => 'La localidad es obligatoria.',
            'localidad.max' => 'La localidad no puede superar los 100 caracteres.',
            'provincia.required' => 'La provincia es obligatoria.',
            'provincia.max' => 'La provincia no puede superar los 100 caracteres.',
            'password.required' => 'La contraseña es obligatoria.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
        ];
    }
}
