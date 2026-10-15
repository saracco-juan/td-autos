<?php

use App\Services\Integrations\MercadoLibre\AuthorizationAttempt;
use App\Services\Integrations\MercadoLibre\MercadoLibreAccessProbe;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Symfony\Component\Console\Output\OutputInterface;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Fail closed for piped input; the capability can be substituted by console tests.
app()->bind('mercadolibre.stdin-is-terminal', fn () => defined('STDIN') && stream_isatty(STDIN));

Artisan::command('mercadolibre:probe-access', function (MercadoLibreAccessProbe $probe) {
    if (! $this->input->isInteractive() || ! app('mercadolibre.stdin-is-terminal')) {
        $this->error('Ejecutá este diagnóstico en una terminal interactiva privada.');

        return 1;
    }
    try {
        $clientId = $this->secret('App ID', false);
        $secret = $this->secret('Client secret', false);
        $attempt = new AuthorizationAttempt;
        $this->line('Abrí esta URL en tu navegador y autorizá la app. Tenés cinco minutos:');
        $this->line($attempt->authorizationUrl((string) $clientId));
        $this->line('Pegá la URL final completa, con code y state, aunque ngrok muestre offline. No la compartas.');
        $callback = $this->secret('URL final del navegador', false);
        $result = $probe->run($attempt, (string) $clientId, (string) $secret, (string) $callback);
    } catch (Throwable) {
        $result = ['ok' => false, 'error' => 'private_input_or_probe_failed'];
    }
    $this->output->writeln(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE), OutputInterface::OUTPUT_RAW);

    return $result['ok'] ? 0 : 1;
})->purpose('Diagnosticar acceso a publicaciones de vehículos con OAuth manual (HU06)');
