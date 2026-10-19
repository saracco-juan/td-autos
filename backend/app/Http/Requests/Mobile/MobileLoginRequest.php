<?php

namespace App\Http\Requests\Mobile;

use App\Http\Requests\Auth\LoginRequest;

class MobileLoginRequest extends LoginRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [...parent::rules(), 'device_name' => ['required', 'string', 'max:255']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [...parent::messages(), 'device_name.required' => 'El nombre del dispositivo es obligatorio.'];
    }
}
