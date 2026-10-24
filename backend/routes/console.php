<?php

use App\Services\Calculadora\CalculatorRatesStore;
use App\Services\Calculadora\CalculatorReview;
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

Artisan::command('calculadora:review', function (CalculatorReview $service) {
    $review = $service->run();

    $this->info('Calculator yearly review ('.$review['generated_at'].'). It only reports; no rate is changed.');
    $this->line('Stale: '.count($review['stale']).' | Fresh: '.count($review['fresh']).' | Unreachable sources: '.count($review['unreachable_sources']));
    foreach ($review['stale'] as $group) {
        $this->warn("  STALE  {$group['label']} [{$group['config_path']}] reviewed {$group['reviewed_at']} ({$group['age_months']} months)");
    }
    foreach ($review['fresh'] as $group) {
        $this->line("  fresh  {$group['label']} [{$group['config_path']}] reviewed {$group['reviewed_at']}");
    }
    foreach ($review['unreachable_sources'] as $source) {
        $this->warn('  UNREACHABLE  '.$source['url'].' ('.($source['status'] !== null ? 'HTTP '.$source['status'] : $source['error']).')');
    }
    $snapshot = $review['snapshot'];
    $this->line($snapshot['latest_fetched_at'] === null
        ? 'Monthly snapshot: none valid.'
        : 'Monthly snapshot: '.$snapshot['latest_fetched_at'].' ('.$snapshot['age_days'].' days'.($snapshot['stale'] ? ', late' : '').').');

    return 0;
})->purpose('Yearly alert: list the hand-reviewed calculator values older than 12 months and the source URLs that stopped answering; never changes a rate');

// January 1, 05:00 in Argentina. The 5 s source checks run in parallel; the cap is a safety net.
Schedule::exec(escapeshellarg(PHP_BINARY), ['-d', 'memory_limit=128M', '-d', 'max_execution_time=120',
    base_path('artisan'), 'calculadora:review'])->yearlyOn(1, 1, '05:00')->timezone('America/Argentina/Buenos_Aires')->withoutOverlapping(10);
