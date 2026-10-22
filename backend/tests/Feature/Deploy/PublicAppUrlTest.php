<?php

namespace Tests\Feature\Deploy;

use App\Providers\AppServiceProvider;
use Tests\TestCase;

/**
 * Behind the Vercel -> Render proxies, generated absolute URLs must use the public APP_URL.
 */
class PublicAppUrlTest extends TestCase
{
    public function test_https_app_url_with_prefix_becomes_the_root_of_generated_urls(): void
    {
        config(['app.url' => 'https://app.vercel.app/backend']);
        $this->app->getProvider(AppServiceProvider::class)->boot();

        $this->assertSame('https://app.vercel.app/backend/up', url('/up'));
        $this->assertSame('https://app.vercel.app/backend/logout', route('logout'));
    }

    public function test_local_http_app_url_leaves_urls_to_the_request(): void
    {
        config(['app.url' => 'http://localhost:8000']);
        $this->app->getProvider(AppServiceProvider::class)->boot();

        $this->assertSame('http://localhost/up', url('/up'));
    }

    public function test_forwarded_https_from_a_proxy_is_trusted(): void
    {
        $this->get('/', ['X-Forwarded-Proto' => 'https'])->assertOk();

        $this->assertTrue(request()->isSecure());
    }
}
