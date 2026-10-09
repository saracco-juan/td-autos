<?php

namespace App\Http\Requests;

use App\Support\TransferenciaChecklist;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ToggleTransferenciaItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * The item code comes from the URL, so it is validated like a body field.
     */
    protected function prepareForValidation(): void
    {
        $this->merge(['codigo' => $this->route('codigo')]);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'codigo' => ['required', 'string', Rule::in(TransferenciaChecklist::codes())],
            'completado' => ['bail', 'required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'codigo.required' => 'El paso del trámite no existe.',
            'codigo.string' => 'El paso del trámite no existe.',
            'codigo.in' => 'El paso del trámite no existe.',
            'completado.required' => 'Indicá si el paso está completado o no.',
            'completado.boolean' => 'Indicá si el paso está completado o no.',
        ];
    }
}
