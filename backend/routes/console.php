<?php

use App\Services\Resale\DnrpaActivityStore;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('suscripciones:procesar')->hourly();

Artisan::command('dnrpa:refresh', function (DnrpaActivityStore $store) {
    $state = $store->refresh();
    $this->info('DNRPA: '.($state['warning'] ?? 'ready').' ('.($state['snapshot']['activity']['window_end'] ?? 'none').').');

    return $state['warning'] === null ? 0 : 1;
})->purpose('Check DNRPA every 14 days and retain dated last-valid aggregate history');

Schedule::exec(escapeshellarg(PHP_BINARY), ['-d', 'memory_limit=512M', '-d', 'max_execution_time=600',
    base_path('artisan'), 'dnrpa:refresh'])->dailyAt('01:00')->withoutOverlapping(15);
