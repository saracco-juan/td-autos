<?php

namespace App\Http\Requests;

use App\Support\DealerFields;
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
            $this->merge(['telefono_publico' => DealerFields::normalizePublicPhone($this->input('telefono_publico'))]);
        }
    }

    public function rules(): array
    {
        return ['telefono_publico' => DealerFields::publicPhoneRules()];
    }

    public function messages(): array
    {
        return ['telefono_publico.*' => DealerFields::PUBLIC_PHONE_MESSAGE];
    }
}
