<?php

namespace Database\Seeders\RealDemo;

use App\Support\VehiculoFields;
use App\Support\VehiculoOptions;
use Database\Seeders\Support\LocalAcaraCatalogData;
use Random\Engine\Mt19937;
use Random\Randomizer;
use RuntimeException;

/**
 * Pure, deterministic builder of the realistic demo inventory (UH-05): real ACARA versions and
 * prices per year, curated specs per model (`assets/real-demo/models.json`) and free-licensed
 * photo URLs. It touches no database; `RealDemoLoader` and `demo:reales-xlsx` consume its output.
 */
final class RealDemoInventory
{
    public const SEED = 20261026;

    public const DATA_FILE = 'seeders/assets/real-demo/models.json';

    /** Share of each body type in the inventory. */
    public const BODY_MIX = ['Hatchback' => 35, 'Sedán' => 25, 'SUV' => 20, 'Pickup' => 10, 'Rural / familiar' => 7, 'Furgón' => 3];

    /** Fixed dealers; `weight` makes their stock uneven. */
    public const DEALERS = [
        ['slug' => 'autos-del-plata', 'nombre' => 'Autos del Plata', 'localidad' => 'La Plata', 'provincia' => 'Buenos Aires', 'direccion' => 'Calle 7 1450', 'telefono' => '221 4521-3300', 'weight' => 3.0],
        ['slug' => 'costa-atlantica-automotores', 'nombre' => 'Costa Atlántica Automotores', 'localidad' => 'Mar del Plata', 'provincia' => 'Buenos Aires', 'direccion' => 'Avenida Colón 3120', 'telefono' => '223 4930-1200', 'weight' => 2.5],
        ['slug' => 'sur-motors', 'nombre' => 'Sur Motors', 'localidad' => 'Bahía Blanca', 'provincia' => 'Buenos Aires', 'direccion' => 'Avenida Alem 890', 'telefono' => '291 4551-7788', 'weight' => 1.5],
        ['slug' => 'palermo-usados', 'nombre' => 'Palermo Usados', 'localidad' => 'Palermo', 'provincia' => 'CABA', 'direccion' => 'Avenida Santa Fe 4800', 'telefono' => '11 4777-2100', 'weight' => 2.0],
        ['slug' => 'caballito-autos', 'nombre' => 'Caballito Autos', 'localidad' => 'Caballito', 'provincia' => 'CABA', 'direccion' => 'Avenida Rivadavia 5600', 'telefono' => '11 4903-6650', 'weight' => 1.2],
        ['slug' => 'sierras-automotores', 'nombre' => 'Sierras Automotores', 'localidad' => 'Córdoba', 'provincia' => 'Córdoba', 'direccion' => 'Avenida Colón 2250', 'telefono' => '351 4228-9100', 'weight' => 2.2],
        ['slug' => 'rio-cuarto-motor-center', 'nombre' => 'Río Cuarto Motor Center', 'localidad' => 'Río Cuarto', 'provincia' => 'Córdoba', 'direccion' => 'Avenida Sabattini 740', 'telefono' => '358 4640-5522', 'weight' => 1.0],
        ['slug' => 'litoral-rodados', 'nombre' => 'Litoral Rodados', 'localidad' => 'Rosario', 'provincia' => 'Santa Fe', 'direccion' => 'Bulevar Oroño 1630', 'telefono' => '341 4488-3010', 'weight' => 3.0],
        ['slug' => 'cuyo-vehiculos', 'nombre' => 'Cuyo Vehículos', 'localidad' => 'Mendoza', 'provincia' => 'Mendoza', 'direccion' => 'Avenida San Martín 2090', 'telefono' => '261 4290-4411', 'weight' => 1.6],
        ['slug' => 'norte-autos-tucuman', 'nombre' => 'Norte Autos Tucumán', 'localidad' => 'San Miguel de Tucumán', 'provincia' => 'Tucumán', 'direccion' => 'Avenida Mate de Luna 1100', 'telefono' => '381 4311-9090', 'weight' => 1.4],
    ];

    private const FIRST_YEAR = 2012;

    private const LAST_YEAR = 2025;

    private const CURRENT_YEAR = 2026;

    private const UNLINKED_PERCENT = 15;

    private const AUTOMATIC = '/(?<![A-Za-z])(AT|CVT|DSG|Tiptronic|Aut|Automática|eCVT|DCT|Powershift)(?![A-Za-z])/iu';

    private const TIERS = ['base', 'mid', 'top'];

    private const ASSISTANCE_FIELDS = ['frenado_autonomo', 'asistencia_carril', 'punto_ciego', 'monitoreo_conductor', 'asistencia_velocidad'];

    private const DESCRIPTIONS = [
        'Unidad con service al día y papeles listos para transferir.',
        'Muy buen estado general, lista para usar. Se acepta vehículo en parte de pago.',
        'Única en su estado, con historial de mantenimiento en concesionaria.',
        'Llaves y manuales completos, sin detalles. Consultá por financiación.',
    ];

    /** @var array<string, array<string, list<array<string, mixed>>>> candidate versions by body and model key */
    private array $candidates = [];

    /** @var array<string, array<string, mixed>> */
    private array $specs = [];

    /**
     * @param  array<string, mixed>|null  $snapshot  The bundled ACARA snapshot; loaded when null.
     * @param  list<array<string, mixed>>|null  $models  Curated model data; read from the data file when null.
     */
    public function __construct(?array $snapshot = null, ?array $models = null)
    {
        $snapshot ??= (new LocalAcaraCatalogData)->load();
        $models ??= json_decode(file_get_contents(database_path(self::DATA_FILE)), true, 512, JSON_THROW_ON_ERROR);

        foreach ($models as $model) {
            $key = self::key($model['make'], $model['model']);
            if (count($model['photos'] ?? []) < VehiculoOptions::FOTOS_MINIMO) {
                throw new RuntimeException("{$model['make']} {$model['model']} needs at least ".VehiculoOptions::FOTOS_MINIMO.' photos in the real demo data.');
            }
            $this->specs[$key] = $model;
        }

        $this->indexCandidates($snapshot['rows']);
    }

    /**
     * An inventory built from another data file (the tests use a small fixture).
     *
     * @param  array<string, mixed>|null  $snapshot
     */
    public static function fromFile(string $path, ?array $snapshot = null): self
    {
        return new self($snapshot, json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR));
    }

    /**
     * The same vehicles for the same seed: first the local load, then the XLSX export.
     *
     * @return list<array<string, mixed>>
     */
    public function vehicles(int $count, int $seed = self::SEED): array
    {
        if ($count < 1) {
            return [];
        }
        if ($this->candidates === []) {
            throw new RuntimeException('No priced ACARA version matches the real demo data.');
        }

        $random = new Randomizer(new Mt19937($seed));
        $bodies = array_keys($this->candidates);
        $weights = array_column(self::DEALERS, 'weight');
        $plates = [];
        $vehicles = [];

        for ($i = 0; $i < $count; $i++) {
            $body = self::pickBody($random, $bodies);
            $models = array_keys($this->candidates[$body]);
            $versions = $this->candidates[$body][$models[$random->getInt(0, count($models) - 1)]];
            $version = $versions[$random->getInt(0, count($versions) - 1)];
            $year = $version['years'][$random->getInt(0, count($version['years']) - 1)];
            $dealer = self::DEALERS[self::pickIndex($random, $weights)];

            $vehicles[] = $this->vehicle($random, $version, $year, $dealer, $plates);
        }

        return $vehicles;
    }

    /**
     * A body type drawn by the target mix, normalized over the bodies that are available.
     *
     * @param  list<string>  $available
     */
    public static function pickBody(Randomizer $random, array $available): string
    {
        return $available[self::pickIndex($random, array_map(fn (string $body) => self::BODY_MIX[$body], $available))];
    }

    /**
     * @param  list<int|float>  $weights
     */
    private static function pickIndex(Randomizer $random, array $weights): int
    {
        $point = $random->getInt(0, 999999) / 1000000 * array_sum($weights);
        foreach ($weights as $index => $weight) {
            $point -= $weight;
            if ($point < 0) {
                return $index;
            }
        }

        return count($weights) - 1;
    }

    private static function key(string $make, string $model): string
    {
        return $make.'|'.$model;
    }

    /**
     * Versions of the curated models that have a price in the covered years and a real engine match (no
     * fallback: a guessed engine would put the wrong specs on the car). A version id found twice
     * has two prices, so it is dropped (the catalog collapses them and the import could not tell them apart).
     *
     * @param  list<array<string, mixed>>  $rows
     */
    private function indexCandidates(array $rows): void
    {
        $seen = array_count_values(array_column($rows, 'version_id'));

        foreach ($rows as $row) {
            $key = self::key($row['make'], $row['model']);
            if (! isset($this->specs[$key]) || $seen[$row['version_id']] > 1
                || $this->firstMatch(array_column($this->specs[$key]['engines'], 'match'), $row['version']) === null) {
                continue;
            }
            $years = [];
            for ($year = self::FIRST_YEAR; $year <= self::LAST_YEAR; $year++) {
                if (isset($row['values'][(string) $year]) && (float) $row['values'][(string) $year] > 0) {
                    $years[] = $year;
                }
            }
            if ($years !== []) {
                $this->candidates[$this->specs[$key]['body']][$key][] = ['row' => $row, 'years' => $years];
            }
        }

        // Stable order whatever the order of the data file.
        ksort($this->candidates);
    }

    /**
     * @param  array{row: array<string, mixed>, years: list<int>}  $version
     * @param  array<string, mixed>  $dealer
     * @param  array<string, true>  $plates
     * @return array<string, mixed>
     */
    private function vehicle(Randomizer $random, array $version, int $year, array $dealer, array &$plates): array
    {
        $row = $version['row'];
        $spec = $this->specs[self::key($row['make'], $row['model'])];
        $engine = $this->engine($spec['engines'], $row['version']);
        $reference = (float) $row['values'][(string) $year];
        $price = $reference * (0.90 + $random->getInt(0, 20000) / 100000);
        $age = max(self::CURRENT_YEAR - $year, 1);
        $linked = $random->getInt(1, 100) > self::UNLINKED_PERCENT;

        return [
            'dealer' => $dealer['slug'],
            'linked' => $linked,
            'acara_version_id' => $row['version_id'],
            'patente' => $this->plate($random, $year, $plates),
            'marca' => $row['make'],
            'modelo' => $row['model'],
            'version' => $row['version'],
            'anio' => $year,
            'kilometraje' => (int) (round($age * $random->getInt(8000, 18000) / 100) * 100),
            'precio' => $row['currency'] === 'USD' ? (int) (round($price / 100) * 100) : (int) (round($price / 50000) * 50000),
            'moneda' => $row['currency'],
            'transmision' => preg_match(self::AUTOMATIC, $row['version']) === 1 ? 'automatica' : 'manual',
            'combustible' => $engine['fuel'],
            'carroceria' => $spec['body'],
            'ubicacion' => $dealer['localidad'],
            'descripcion' => self::DESCRIPTIONS[$random->getInt(0, count(self::DESCRIPTIONS) - 1)],
            'fotos' => $this->photos($spec['photos'], $random->getInt(0, count($spec['photos']) - 1)),
            'plazas' => $spec['seats'],
            'motor' => $engine['motor'] ?? $engine['match'],
            'turbo' => $engine['turbo'],
            'potencia' => $this->power($row['version'], $engine),
            'potencia_unidad' => 'CV',
            'consumo_urbano' => $engine['consumo_urbano'] ?? null,
            'consumo_ruta' => $engine['consumo_ruta'] ?? null,
            ...$this->equipment($spec, $row['version'], $year),
        ];
    }

    /**
     * The first listed engine whose `match` is a substring of the version name (list the most specific
     * ones first). Candidates always have a match.
     *
     * @param  list<array<string, mixed>>  $engines
     * @return array<string, mixed>
     */
    private function engine(array $engines, string $version): array
    {
        return $engines[$this->firstMatch(array_column($engines, 'match'), $version)];
    }

    /**
     * Index of the first entry with a case-insensitive substring found in the text, or null.
     * Each entry is a string or a list of strings.
     *
     * @param  list<string|list<string>>  $entries
     */
    private function firstMatch(array $entries, string $text): ?int
    {
        foreach ($entries as $index => $needles) {
            foreach ((array) $needles as $needle) {
                if (stripos($text, $needle) !== false) {
                    return $index;
                }
            }
        }

        return null;
    }

    /**
     * The "(170cv)" of the version name when sane, the engine's power otherwise.
     *
     * @param  array<string, mixed>  $engine
     */
    private function power(string $version, array $engine): int
    {
        if (preg_match('/\((\d+)cv\)/i', $version, $found) === 1 && (int) $found[1] <= 700) {
            return (int) $found[1];
        }

        return (int) $engine['power_cv'];
    }

    /**
     * @param  array<string, mixed>  $spec
     * @return array<string, bool>
     */
    private function equipment(array $spec, string $version, int $year): array
    {
        $trim = $this->firstMatch(array_column($spec['trims'], 'match'), $version);
        $wanted = $trim === null ? 0 : (int) array_search($spec['trims'][$trim]['tier'], self::TIERS, true);
        $equipment = $this->nearestTier($spec['equipment'], $wanted);

        if ($year < 2018) {
            foreach (self::ASSISTANCE_FIELDS as $field) {
                $equipment[$field] = false;
            }
        }

        return array_intersect_key($equipment, VehiculoFields::EQUIPMENT_FIELDS);
    }

    /**
     * The wanted tier, or the nearest lower one (then the nearest higher) when the model lacks it.
     *
     * @param  array<string, array<string, bool>>  $tiers
     * @return array<string, bool>
     */
    private function nearestTier(array $tiers, int $wanted): array
    {
        $last = count(self::TIERS) - 1;
        $order = [...($wanted > 0 ? range($wanted, 0) : [0]), ...($wanted < $last ? range($wanted + 1, $last) : [])];
        foreach ($order as $index) {
            if (isset($tiers[self::TIERS[$index]])) {
                return $tiers[self::TIERS[$index]];
            }
        }

        throw new RuntimeException('A real demo model has no equipment tier.');
    }

    /**
     * Seven photos from the model's pool, starting at a rotating position.
     *
     * @param  list<array<string, mixed>>  $pool
     * @return list<string>
     */
    private function photos(array $pool, int $start): array
    {
        $urls = [];
        for ($i = 0; $i < VehiculoOptions::FOTOS_MINIMO; $i++) {
            $urls[] = $pool[($start + $i) % count($pool)]['url'];
        }

        return $urls;
    }

    /**
     * A normalized plate nobody has taken in this run: the old AAA123 until 2016, Mercosur AA123AA after.
     *
     * @param  array<string, true>  $plates
     */
    private function plate(Randomizer $random, int $year, array &$plates): string
    {
        $mercosurShare = match (true) {
            $year <= 2015 => 0,
            $year === 2016 => 50,
            default => 90,
        };

        do {
            $plate = $random->getInt(1, 100) <= $mercosurShare
                ? $this->letters($random, 2).sprintf('%03d', $random->getInt(0, 999)).$this->letters($random, 2)
                : $this->letters($random, 3).sprintf('%03d', $random->getInt(0, 999));
        } while (isset($plates[$plate]));

        $plates[$plate] = true;

        return $plate;
    }

    private function letters(Randomizer $random, int $count): string
    {
        $letters = '';
        for ($i = 0; $i < $count; $i++) {
            $letters .= chr($random->getInt(65, 90));
        }

        return $letters;
    }
}
