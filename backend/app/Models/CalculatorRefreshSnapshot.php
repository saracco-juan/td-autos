<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One monthly refresh of the calculator's moving values (fuel prices per province, CPI).
 * `payload` = {fuel: {source_date, national, provinces}|null, cpi: {latest_month, latest_value, base_month, base_value}|null}.
 */
class CalculatorRefreshSnapshot extends Model
{
    public const STATUS_VALID = 'valid';

    public const STATUS_FAILED = 'failed';

    protected $table = 'calculator_refresh_snapshot';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['fetched_at' => 'datetime', 'payload' => 'array', 'fuel_source_date' => 'date:Y-m-d'];
    }
}
