<?php

namespace App\Http\Requests;

use App\Support\InspeccionChecklist;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ToggleInspeccionItemRequest extends FormRequest
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
            'codigo' => ['required', 'string', Rule::in(InspeccionChecklist::codes())],
            'completado' => ['bail', 'required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'codigo.required' => 'El punto de la inspección no existe.',
            'codigo.string' => 'El punto de la inspección no existe.',
            'codigo.in' => 'El punto de la inspección no existe.',
            'completado.required' => 'Indicá si el punto está revisado o no.',
            'completado.boolean' => 'Indicá si el punto está revisado o no.',
        ];
    }
}
