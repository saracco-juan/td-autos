<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The XLSX upload of the inventory import, preview and apply alike (CU-20). What is inside the
 * file is checked by the import services, not here.
 */
class ImportVehiculosRequest extends FormRequest
{
    /** Size limit in kilobytes (the unit of the max rule). */
    public const MAX_KB = 2048;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'archivo' => ['bail', 'required', 'file', 'extensions:xlsx', 'max:'.self::MAX_KB],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'archivo.required' => 'Elegí un archivo XLSX.',
            'archivo.file' => 'Elegí un archivo XLSX válido.',
            'archivo.uploaded' => 'No pudimos subir el archivo. Probá de nuevo.',
            'archivo.extensions' => 'El archivo tiene que ser un XLSX.',
            'archivo.max' => 'El archivo puede pesar hasta '.intdiv(self::MAX_KB, 1024).' MB.',
        ];
    }
}
