<?php

namespace App\Services\Inventario;

use App\Models\Vehiculo;
use Illuminate\Validation\ValidationException;

/** One identity policy shared by manual entry and workbook rows. */
final class VehicleCatalogIdentity
{
    public function __construct(private readonly VehicleCatalog $catalog) {}

    public function resolve(array $input, ?Vehiculo $existing = null, ?array $catalog = null): array
    {
        $labels = array_intersect_key($input, array_flip(['marca', 'modelo', 'version']));
        $id = $input['acara_version_id'] ?? null;
        if ($existing?->acara_version_id !== null && $existing->acara_version_id !== ''
            && $this->unchanged($labels, $existing)
            && ($id === null || $id === '' || $id === $existing->acara_version_id)) {
            return [...$existing->only(['marca', 'modelo', 'version']), 'acara_version_id' => $existing->acara_version_id];
        }
        if (! is_string($id) || $id === '') {
            throw ValidationException::withMessages(['acara_version_id' => 'Elegí la marca, el modelo y la versión del catálogo.']);
        }
        $catalog ??= $this->catalog->current();
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

    /** Resolve editable workbook labels against one snapshot, without fuzzy matching. */
    public function resolveWorkbook(array $input, ?Vehiculo $existing, array $catalog): array
    {
        if ($existing?->acara_version_id !== null && $existing->acara_version_id !== ''
            && $this->unchanged($input, $existing)) {
            return $this->resolve($input, $existing, $catalog);
        }
        if ($catalog['snapshot_id'] === null) {
            throw ValidationException::withMessages(['acara_version_id' => 'El catálogo no está disponible. Intentá de nuevo más tarde.']);
        }
        $matches = array_filter($catalog['entries'], function (array $entry) use ($input): bool {
            foreach (['marca', 'modelo', 'version'] as $field) {
                if (($input[$field] ?? null) !== $entry[$field]) {
                    return false;
                }
            }

            return true;
        });
        if (count($matches) !== 1) {
            $message = $matches === []
                ? 'La marca, el modelo y la versión no coinciden con el catálogo. Volvé a seleccionarlos.'
                : 'La selección del catálogo es ambigua. Revisá la versión antes de importar.';
            throw ValidationException::withMessages(['acara_version_id' => $message]);
        }

        return $this->resolve([...$input, 'acara_version_id' => reset($matches)['id']], $existing, $catalog);
    }

    private function unchanged(array $input, ?Vehiculo $existing): bool
    {
        if ($existing === null) {
            return false;
        }
        foreach (['marca', 'modelo', 'version'] as $field) {
            if ((string) ($input[$field] ?? '') !== (string) $existing->$field) {
                return false;
            }
        }

        return true;
    }
}
