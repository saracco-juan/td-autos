<?php

namespace App\Services\Inventario;

use App\Services\Resale\AcaraPriceSource;

/** Identity projection for inventory inputs; prices remain in the original source snapshot. */
final class VehicleCatalog
{
    public function __construct(private readonly AcaraPriceSource $source) {}

    public function current(): array
    {
        $current = $this->source->current();
        $snapshot = $current['snapshot'];
        $entries = $conflicts = [];

        foreach ($snapshot['rows'] ?? [] as $row) {
            $id = $row['version_id'];
            if (isset($conflicts[$id])) {
                continue;
            }
            $entry = ['id' => $id, 'marca' => $row['make'],
                'modelo' => $row['model'], 'version' => $row['version']];
            if (isset($entries[$id]) && $entries[$id] !== $entry) {
                $conflicts[$id] = true;
                unset($entries[$id]);

                continue;
            }
            $entries[$id] = $entry;
        }

        $entries = array_values($entries);
        usort($entries, fn (array $a, array $b) => [$a['marca'], $a['modelo'], $a['version'], $a['id']]
            <=> [$b['marca'], $b['modelo'], $b['version'], $b['id']]);

        return [
            'snapshot_id' => $snapshot['snapshot_id'] ?? null,
            'source_date' => $snapshot['source_date'] ?? null,
            'stale' => $current['stale'],
            'warning' => $current['warning'],
            'entries' => $entries,
        ];
    }
}
