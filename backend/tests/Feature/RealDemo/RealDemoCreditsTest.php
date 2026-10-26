<?php

namespace Tests\Feature\RealDemo;

use Database\Seeders\RealDemo\RealDemoCredits;
use Database\Seeders\RealDemo\RealDemoInventory;
use Tests\TestCase;

/**
 * UH-05 demo data: every free-licensed photo is credited in CREDITS.md, generated from the data file.
 */
class RealDemoCreditsTest extends TestCase
{
    private function models(): array
    {
        return json_decode(file_get_contents(database_path(RealDemoInventory::DATA_FILE)), true, 512, JSON_THROW_ON_ERROR);
    }

    public function test_the_credits_list_the_page_author_and_license_of_every_photo_by_model(): void
    {
        $credits = RealDemoCredits::render($this->models());

        foreach ($this->models() as $model) {
            $this->assertStringContainsString("## {$model['make']} {$model['model']}", $credits);
            foreach ($model['photos'] as $photo) {
                $this->assertStringContainsString($photo['page'], $credits);
                $this->assertStringContainsString($photo['author'], $credits);
                $this->assertStringContainsString($photo['license'], $credits);
            }
        }
    }

    public function test_the_committed_credits_file_is_up_to_date_with_the_data_file(): void
    {
        $this->assertFileExists(database_path(RealDemoCredits::FILE));
        $this->assertSame(
            RealDemoCredits::render($this->models()),
            str_replace("\r\n", "\n", file_get_contents(database_path(RealDemoCredits::FILE))),
            'Run `php artisan demo:reales-creditos` after changing models.json.',
        );
    }

    public function test_the_command_rewrites_the_credits_file(): void
    {
        $path = database_path(RealDemoCredits::FILE);
        $before = file_get_contents($path);
        try {
            file_put_contents($path, 'stale');
            $this->artisan('demo:reales-creditos')->assertExitCode(0);
            $this->assertSame($before, file_get_contents($path));
        } finally {
            file_put_contents($path, $before);
        }
    }
}
