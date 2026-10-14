<?php

namespace Tests\Feature;

use Illuminate\Support\Env;
use Tests\TestCase;

class ConfigTest extends TestCase
{
    public function test_frontend_url_points_to_the_vite_dev_server(): void
    {
        $this->assertSame('http://localhost:5173', config('app.frontend_url'));
    }

    public function test_sanctum_treats_the_vite_dev_server_as_stateful(): void
    {
        $repository = Env::getRepository();
        $previous = $repository->get('SANCTUM_STATEFUL_DOMAINS');
        $repository->clear('SANCTUM_STATEFUL_DOMAINS');

        try {
            $stateful = (require config_path('sanctum.php'))['stateful'];
        } finally {
            if ($previous !== null) {
                $repository->set('SANCTUM_STATEFUL_DOMAINS', $previous);
            }
        }

        $this->assertContains('localhost:5173', $stateful);
        $this->assertContains('127.0.0.1:5173', $stateful);
    }

    public function test_cors_allows_the_vite_dev_server_origin(): void
    {
        $this->assertContains('http://localhost:5173', config('cors.allowed_origins'));
    }

    public function test_transfer_advisor_whatsapp_is_empty_when_env_is_unset(): void
    {
        $repository = Env::getRepository();
        $previous = $repository->get('TRANSFER_ADVISOR_WHATSAPP');
        $repository->clear('TRANSFER_ADVISOR_WHATSAPP');

        try {
            $this->assertSame('', (require config_path('services.php'))['transfer_advisor']['whatsapp']);
        } finally {
            if ($previous !== null) {
                $repository->set('TRANSFER_ADVISOR_WHATSAPP', $previous);
            }
        }
    }

    public function test_vehicle_photos_use_the_public_disk_when_env_is_unset(): void
    {
        $repository = Env::getRepository();
        $previous = $repository->get('VEHICLE_PHOTOS_DISK');
        $repository->clear('VEHICLE_PHOTOS_DISK');

        try {
            $this->assertSame('public', (require config_path('filesystems.php'))['vehicle_photos_disk']);
        } finally {
            if ($previous !== null) {
                $repository->set('VEHICLE_PHOTOS_DISK', $previous);
            }
        }
    }

    public function test_vehicle_photos_disk_can_be_overridden_by_env(): void
    {
        $repository = Env::getRepository();
        $previous = $repository->get('VEHICLE_PHOTOS_DISK');
        $repository->set('VEHICLE_PHOTOS_DISK', 'supabase');

        try {
            $this->assertSame('supabase', (require config_path('filesystems.php'))['vehicle_photos_disk']);
        } finally {
            if ($previous === null) {
                $repository->clear('VEHICLE_PHOTOS_DISK');
            } else {
                $repository->set('VEHICLE_PHOTOS_DISK', $previous);
            }
        }
    }

    public function test_receipts_use_the_private_local_disk_when_env_is_unset(): void
    {
        $repository = Env::getRepository();
        $previous = $repository->get('RECEIPTS_DISK');
        $repository->clear('RECEIPTS_DISK');

        try {
            $this->assertSame('local', (require config_path('filesystems.php'))['receipts_disk']);
        } finally {
            if ($previous !== null) {
                $repository->set('RECEIPTS_DISK', $previous);
            }
        }
    }

    public function test_supabase_storage_disk_is_a_public_path_style_s3_disk(): void
    {
        $disk = config('filesystems.disks.supabase');

        $this->assertSame('s3', $disk['driver']);
        $this->assertTrue($disk['use_path_style_endpoint']);
        $this->assertSame('public', $disk['visibility']);
        $this->assertTrue($disk['throw']);
    }

    public function test_defaults_target_the_vite_dev_server_when_env_is_unset(): void
    {
        $repository = Env::getRepository();
        $previous = $repository->get('FRONTEND_URL');
        $repository->clear('FRONTEND_URL');

        try {
            $this->assertSame('http://localhost:5173', (require config_path('app.php'))['frontend_url']);
            $this->assertSame(['http://localhost:5173'], (require config_path('cors.php'))['allowed_origins']);
        } finally {
            $repository->set('FRONTEND_URL', $previous);
        }
    }
}
