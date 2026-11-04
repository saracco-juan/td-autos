<?php

namespace App\Console\Commands;

use Database\Seeders\RealDemo\RealDemoCredits;
use Database\Seeders\RealDemo\RealDemoInventory;
use Illuminate\Console\Command;

/**
 * Regenerates the photo credits of the real demo data (UH-05) after `models.json` changes.
 */
class WriteRealDemoCredits extends Command
{
    protected $signature = 'demo:reales-creditos';

    protected $description = 'Regenerate CREDITS.md from the real demo data file';

    public function handle(): int
    {
        $models = json_decode(file_get_contents(database_path(RealDemoInventory::DATA_FILE)), true, 512, JSON_THROW_ON_ERROR);

        file_put_contents(database_path(RealDemoCredits::FILE), RealDemoCredits::render($models));
        $this->info('Wrote '.RealDemoCredits::FILE.' ('.count($models).' models).');

        return self::SUCCESS;
    }
}
