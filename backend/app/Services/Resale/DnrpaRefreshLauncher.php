<?php

namespace App\Services\Resale;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Process;
use Symfony\Component\Process\PhpExecutableFinder;

/**
 * Starts `dnrpa:refresh` as a detached CLI process, with the same limits as the scheduled run.
 * The download can take minutes, longer than a web request may live; the lock mirrors the
 * schedule's withoutOverlapping(15) and simply expires.
 */
final class DnrpaRefreshLauncher
{
    public const LOCK = 'dnrpa-refresh-launch';

    private const LOCK_SECONDS = 15 * 60;

    public function launch(): bool
    {
        if (! Cache::lock(self::LOCK, self::LOCK_SECONDS)->get()) {
            return false;
        }
        // Under mod_php PHP_BINARY is not the CLI binary, so look it up on the PATH.
        $php = (new PhpExecutableFinder)->find(false) ?: 'php';
        Process::run(sprintf('nohup %s -d memory_limit=512M -d max_execution_time=600 %s dnrpa:refresh > /dev/null 2>&1 &',
            escapeshellarg($php), escapeshellarg(base_path('artisan'))));

        return true;
    }
}
