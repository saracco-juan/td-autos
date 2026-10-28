<?php

namespace App\Console\Commands;

use App\Models\ModeloReferencia;
use App\Models\TipoCarroceria;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

/**
 * Upserts the curated models table (HU06) from the repository asset. It matches rows by (marca, modelo), so it is
 * safe to run on every container start and after every `db:local`.
 */
final class LoadPortalModels extends Command
{
    private const ASSET = 'seeders/assets/portal-models.json';

    protected $signature = 'portales:load-models {--path= : Models file (default: the repository asset)}';

    protected $description = 'Create or update the curated models the recommendations point to';

    public function handle(): int
    {
        try {
            $rows = $this->readRows((string) ($this->option('path') ?: database_path(self::ASSET)));
            $bodyTypes = TipoCarroceria::query()->pluck('id', 'nombre')->all();
            $counts = ['created' => 0, 'updated' => 0, 'unchanged' => 0];

            DB::transaction(function () use ($rows, $bodyTypes, &$counts): void {
                foreach ($rows as $row) {
                    $counts[$this->upsert($row, $bodyTypes)]++;
                }
            });

            $this->info("Portal models loaded: {$counts['created']} created, {$counts['updated']} updated, {$counts['unchanged']} unchanged.");

            return self::SUCCESS;
        } catch (Throwable $error) {
            report($error);
            $this->error('Portal models not loaded: '.$error->getMessage());

            return self::FAILURE;
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function readRows(string $path): array
    {
        if (! is_file($path) || ! is_readable($path)) {
            throw new RuntimeException("The models file is missing or unreadable: {$path}");
        }
        $rows = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        if (! is_array($rows) || ! array_is_list($rows)) {
            throw new RuntimeException('The models file must hold a list of models.');
        }

        return $rows;
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  array<string, int>  $bodyTypes
     * @return 'created'|'updated'|'unchanged'
     */
    private function upsert(array $row, array $bodyTypes): string
    {
        $label = ($row['marca'] ?? '?').' '.($row['modelo'] ?? '?');
        $bodyType = $row['carroceria'] ?? null;
        if (! is_string($bodyType) || ! isset($bodyTypes[$bodyType])) {
            throw new RuntimeException($label.': unknown body type "'.(is_scalar($bodyType) ? $bodyType : '').'".');
        }
        unset($row['carroceria']);

        $model = ModeloReferencia::query()->firstOrNew(['marca' => $row['marca'], 'modelo' => $row['modelo']]);
        $exists = $model->exists;
        $model->fill($row + ['tipo_carroceria_id' => $bodyTypes[$bodyType]]);

        if ($exists && ! $model->isDirty()) {
            return 'unchanged';
        }
        $model->save();

        return $exists ? 'updated' : 'created';
    }
}
