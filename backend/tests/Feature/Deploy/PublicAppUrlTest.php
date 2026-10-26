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
        // A host the request never uses: if the provider forced the APP_URL, it would show up in the URL.
        // The request root comes from the local environment (APP_URL in .env), so compare against it.
        config(['app.url' => 'http://app-url.test:9000']);
        $this->app->getProvider(AppServiceProvider::class)->boot();

        $this->assertSame(request()->getSchemeAndHttpHost().'/up', url('/up'));
        $this->assertStringNotContainsString('app-url.test', url('/up'));
    }

    public function test_forwarded_https_from_a_proxy_is_trusted(): void
    {
        $this->get('/', ['X-Forwarded-Proto' => 'https'])->assertOk();

        $this->assertTrue(request()->isSecure());
    }
}
