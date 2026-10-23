<?php

use App\Services\Calculadora\CalculatorRatesStore;
use App\Services\Resale\AcaraPriceSource;
use App\Services\Resale\DnrpaActivityStore;
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

Artisan::command('dnrpa:refresh', function (DnrpaActivityStore $store) {
    $state = $store->refresh();
    $this->info('DNRPA: '.($state['warning'] ?? 'ready').' ('.($state['snapshot']['activity']['window_end'] ?? 'none').').');

    return $state['warning'] === null ? 0 : 1;
})->purpose('Check DNRPA every 14 days and retain dated last-valid aggregate history');

Schedule::exec(escapeshellarg(PHP_BINARY), ['-d', 'memory_limit=512M', '-d', 'max_execution_time=600',
    base_path('artisan'), 'dnrpa:refresh'])->dailyAt('01:00')->withoutOverlapping(15);

Artisan::command('calculadora:refresh', function (CalculatorRatesStore $store) {
    $result = $store->refresh();
    $snapshot = $store->latestValid();
    $fuel = $snapshot?->payload['fuel'] ?? null;
    $cpi = $snapshot?->payload['cpi'] ?? null;
    $this->info('Fuel prices: '.$result['fuel'].($fuel === null ? '' : ' (prices of '.$fuel['source_date'].', '.count($fuel['provinces']).' provinces).'));
    $this->info('CPI: '.$result['cpi'].($cpi === null ? '' : ' (latest '.$cpi['latest_month'].', base '.$cpi['base_month'].').'));
    $this->info('Snapshot: '.$result['status'].'.');

    return $result['fuel'] === 'refreshed' && $result['cpi'] === 'refreshed' ? 0 : 1;
})->purpose('Refresh the calculator fuel prices and CPI; a failing source keeps its previous valid value');

// Monthly, early morning in Argentina. The streamed CSV needs little memory; the cap is a safety net.
Schedule::exec(escapeshellarg(PHP_BINARY), ['-d', 'memory_limit=256M', '-d', 'max_execution_time=300',
    base_path('artisan'), 'calculadora:refresh'])->monthlyOn(1, '04:00')->timezone('America/Argentina/Buenos_Aires')->withoutOverlapping(10);
