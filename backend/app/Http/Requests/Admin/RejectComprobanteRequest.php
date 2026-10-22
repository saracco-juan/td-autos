<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * A rejection always carries the reason the dealer will read (RF19, TC-50).
 */
class RejectComprobanteRequest extends FormRequest
{
    public const MAX_REASON = 500;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('motivo_rechazo'))) {
            $this->merge(['motivo_rechazo' => trim($this->input('motivo_rechazo'))]);
        }
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'motivo_rechazo' => ['required', 'string', 'max:'.self::MAX_REASON],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'motivo_rechazo.required' => 'Ingresá el motivo del rechazo.',
            'motivo_rechazo.string' => 'Ingresá el motivo del rechazo.',
            'motivo_rechazo.max' => 'El motivo no puede superar los '.self::MAX_REASON.' caracteres.',
        ];
    }
}
