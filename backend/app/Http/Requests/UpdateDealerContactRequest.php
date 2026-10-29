<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateDealerContactRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->esConcesionaria() === true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('telefono_publico'))) {
            $phone = preg_replace('/[\s()+-]/u', '', $this->input('telefono_publico'));
            $this->merge(['telefono_publico' => $phone === '' ? null : $phone]);
        }
    }

    public function rules(): array
    {
        return ['telefono_publico' => ['present', 'nullable', 'string', 'max:30', 'regex:/^[1-9][0-9]{7,14}$/D']];
    }

    public function messages(): array
    {
        return ['telefono_publico.*' => 'Ingresá un teléfono con código de país, de 8 a 15 dígitos, o dejalo vacío.'];
    }
}
