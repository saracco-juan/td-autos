<?php

namespace App\Services\Inventario;

use App\Models\TipoCarroceria;
use App\Support\Patente;
use App\Support\VehiculoFields;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * Validates one CSV row with the same rules and messages as the manual vehicle form. The plate
 * is checked for format only: uniqueness depends on the rest of the batch and on the database,
 * so the planner decides it.
 */
class VehiculoRowValidator
{
    /** @var array<string, int>|null Body type id by normalized name. */
    private ?array $bodyTypes = null;

    /**
     * @param  array<string, string>  $data  Cells of the row keyed by column name.
     */
    public function validate(int $fila, array $data): ImportRow
    {
        $plate = Patente::normalize($data['patente'] ?? '');
        $photos = $this->photos($data['fotos'] ?? '');

        $validator = Validator::make(
            [
                ...$this->nullIfEmpty($data),
                ...$this->normalizedOptions($data),
                'patente' => $plate === '' ? null : $plate,
                'carroceria_id' => $this->bodyTypeId($data['carroceria'] ?? ''),
                'fotos' => $photos,
            ],
            [
                ...VehiculoFields::rules(),
                'fotos' => VehiculoFields::fotosCountRules(),
                'fotos.*' => ['url:http,https'],
            ],
            [
                ...VehiculoFields::messages(),
                ...VehiculoFields::fotosCountMessages(),
                'fotos.*.url' => 'La foto :position no es una URL válida: tiene que empezar con http:// o https://.',
            ],
        );

        if ($validator->fails()) {
            return new ImportRow($fila, $plate, [], $photos, array_values(array_unique($validator->errors()->all())));
        }

        return new ImportRow($fila, $plate, VehiculoFields::attributes($validator->validated()), $photos);
    }

    /**
     * @param  array<string, string>  $data
     * @return array<string, ?string>
     */
    private function nullIfEmpty(array $data): array
    {
        return array_map(fn (string $cell) => $cell === '' ? null : $cell, $data);
    }

    /**
     * Transmission and fuel values without case or accents (the catalog values are lowercase
     * ASCII), so "Automática" or "NAFTA" match. Blank cells are left to the `required` rule.
     *
     * @param  array<string, string>  $data
     * @return array<string, string>
     */
    private function normalizedOptions(array $data): array
    {
        $options = array_intersect_key($data, array_flip(['transmision', 'combustible']));

        return array_map(
            fn (string $value) => $this->normalizeName($value),
            array_filter($options, fn (string $value) => trim($value) !== ''),
        );
    }

    /**
     * URLs of the `fotos` cell: separated by `|`, trimmed, empty pieces dropped.
     *
     * @return list<string>
     */
    private function photos(string $cell): array
    {
        return array_values(array_filter(
            array_map('trim', explode('|', $cell)),
            fn (string $url) => $url !== '',
        ));
    }

    /**
     * Id of the body type named in the cell; the name itself when unknown (it then fails the
     * `integer` rule with the "pick from the list" message) and null when blank.
     */
    private function bodyTypeId(string $name): int|string|null
    {
        if ($name === '') {
            return null;
        }

        $this->bodyTypes ??= TipoCarroceria::query()->pluck('id', 'nombre')
            ->mapWithKeys(fn (int $id, string $nombre) => [$this->normalizeName($nombre) => $id])
            ->all();

        return $this->bodyTypes[$this->normalizeName($name)] ?? $name;
    }

    private function normalizeName(string $name): string
    {
        return Str::lower(Str::ascii(preg_replace('/\s+/u', ' ', trim($name))));
    }
}
