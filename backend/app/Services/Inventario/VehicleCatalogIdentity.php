<?php

namespace App\Services\Inventario;

use App\Models\Vehiculo;
use Illuminate\Validation\ValidationException;

/** One identity policy shared by manual entry and workbook rows. */
final class VehicleCatalogIdentity
{
    public function __construct(private readonly VehicleCatalog $catalog) {}

    public function resolve(array $input, ?Vehiculo $existing = null): array
    {
        $labels = array_intersect_key($input, array_flip(['marca', 'modelo', 'version']));
        $id = $input['acara_version_id'] ?? null;
        $unchanged = $existing !== null;
        foreach (['marca', 'modelo', 'version'] as $field) {
            $unchanged = $unchanged && (string) ($labels[$field] ?? '') === (string) $existing?->$field;
        }
        if ($unchanged && ($id === null || $id === '' || $id === $existing->acara_version_id)) {
            return [...$existing->only(['marca', 'modelo', 'version']), 'acara_version_id' => $existing->acara_version_id];
        }
        if (! is_string($id) || $id === '') {
            throw ValidationException::withMessages(['acara_version_id' => 'Elegí la marca, el modelo y la versión del catálogo.']);
        }
        $catalog = $this->catalog->current();
        if ($catalog['snapshot_id'] === null) {
            throw ValidationException::withMessages(['acara_version_id' => 'El catálogo no está disponible. Intentá de nuevo más tarde.']);
        }
        foreach ($catalog['entries'] as $entry) {
            if ($entry['id'] !== $id) {
                continue;
            }
            foreach (['marca', 'modelo', 'version'] as $field) {
                if (($labels[$field] ?? null) !== $entry[$field]) {
                    throw ValidationException::withMessages(['acara_version_id' => 'La selección no coincide con el catálogo. Volvé a elegir la versión.']);
                }
            }

            return ['acara_version_id' => $id, ...array_intersect_key($entry, array_flip(['marca', 'modelo', 'version']))];
        }
        throw ValidationException::withMessages(['acara_version_id' => 'La versión ya no está disponible en el catálogo. Volvé a seleccionarla.']);
    }
}
