<?php

namespace App\Http\Requests;

use App\Support\DealerFields;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;

final class UpdateDealerProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->esConcesionaria() === true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('telefono_publico'))) {
            $this->merge(['telefono_publico' => DealerFields::normalizePublicPhone($this->input('telefono_publico'))]);
        }
    }

    public function rules(): array
    {
        return [
            ...Arr::except(DealerFields::rules(), ['nombre_concesionaria']),
            'telefono_publico' => DealerFields::publicPhoneRules(),
            'responsable_nombre' => ['required', 'string', 'max:255'],
            'responsable_apellido' => ['required', 'string', 'max:100'],
            'nombre' => ['prohibited'],
            'email' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            ...DealerFields::messages(),
            'telefono_publico.*' => DealerFields::PUBLIC_PHONE_MESSAGE,
            'responsable_nombre.required' => 'El nombre del responsable es obligatorio.',
            'responsable_nombre.string' => 'El nombre del responsable debe ser un texto.',
            'responsable_nombre.max' => 'El nombre del responsable no puede superar los 255 caracteres.',
            'responsable_apellido.required' => 'El apellido es obligatorio.',
            'responsable_apellido.string' => 'El apellido debe ser un texto.',
            'responsable_apellido.max' => 'El apellido no puede superar los 100 caracteres.',
            'nombre.prohibited' => 'El nombre comercial no se puede editar.',
            'email.prohibited' => 'El email no se puede editar.',
        ];
    }
}
