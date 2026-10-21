<?php

use App\Services\Resale\AcaraPriceSource;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('suscripciones:procesar')->hourly();

Artisan::command('acara:refresh', function (AcaraPriceSource $source) {
    $state = $source->refresh();
    $this->info('ACARA: '.($state['warning'] ?? 'ready').' ('.count($state['snapshot']['rows'] ?? []).' rows).');

    return $state['warning'] === null ? 0 : 1;
})->purpose('Refresh the ACARA last-valid snapshot at most once every 14 days');

Schedule::exec(escapeshellarg(PHP_BINARY), ['-d', 'memory_limit=512M', '-d', 'max_execution_time=120',
    base_path('artisan'), 'acara:refresh'])->daily()->withoutOverlapping(10);
