<?php

namespace App\Http\Requests;

use App\Support\PaymentReceipts;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The single payment receipt file a dealer uploads (RF18, TC-48, TC-81).
 */
class StoreComprobanteRequest extends FormRequest
{
    private const FORMAT_MESSAGE = 'El comprobante tiene que ser PDF, JPG o PNG.';

    public function authorize(): bool
    {
        return true;
    }

    /**
     * Both the extension and the real content type must be allowed.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'comprobante' => [
                'bail',
                'required',
                'file',
                'mimes:'.implode(',', PaymentReceipts::EXTENSIONS),
                'mimetypes:'.implode(',', PaymentReceipts::MIME_TYPES),
                'max:'.PaymentReceipts::MAX_KB,
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $megabytes = intdiv(PaymentReceipts::MAX_KB, 1024);

        return [
            'comprobante.required' => 'Adjuntá el comprobante.',
            'comprobante.file' => self::FORMAT_MESSAGE,
            'comprobante.mimes' => self::FORMAT_MESSAGE,
            'comprobante.mimetypes' => self::FORMAT_MESSAGE,
            'comprobante.uploaded' => 'No pudimos subir el comprobante. Probá de nuevo.',
            'comprobante.max' => "El comprobante no puede superar los {$megabytes} MB.",
        ];
    }
}
