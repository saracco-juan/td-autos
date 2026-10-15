<?php

namespace Tests\Feature\Integrations\MercadoLibre;

use App\Services\Integrations\MercadoLibre\AuthorizationAttempt;
use App\Services\Integrations\MercadoLibre\MercadoLibreAccessProbe;
use Illuminate\Console\OutputStyle;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;
use Tests\TestCase;

class MercadoLibreAccessProbeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
    }

    private function callbackUrl(AuthorizationAttempt $attempt): string
    {
        parse_str(parse_url($attempt->authorizationUrl('12345'), PHP_URL_QUERY), $query);

        return AuthorizationAttempt::REDIRECT_URI.'?code=dummy-code&state='.$query['state'];
    }

    private function probe(AuthorizationAttempt $attempt, ?string $callback = null): array
    {
        return (new MercadoLibreAccessProbe)->run($attempt, '12345', 'dummy-secret', $callback ?? $this->callbackUrl($attempt));
    }

    private function fakeProvider(mixed $search = ['results' => []], int $status = 200): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'dummy-access-token', 'token_type' => 'bearer', 'expires_in' => 21600, 'refresh_token' => 'dummy-refresh-token']),
            '*/users/me' => Http::response(['id' => 123, 'email' => 'private@example.test']),
            '*/sites/MLA/search*' => Http::response($search, $status),
        ]);
    }

    public function test_hu06_pkce_uses_unique_state_and_matching_s256_challenge(): void
    {
        $attempt = new AuthorizationAttempt;
        $url = $attempt->authorizationUrl('12345');
        parse_str(parse_url($url, PHP_URL_QUERY), $query);
        $grant = $attempt->consumeCallback($this->callbackUrl($attempt));
        $this->assertSame('auth.mercadolibre.com.ar', parse_url($url, PHP_URL_HOST));
        $this->assertSame(AuthorizationAttempt::REDIRECT_URI, $query['redirect_uri']);
        $this->assertSame('S256', $query['code_challenge_method']);
        $this->assertSame(rtrim(strtr(base64_encode(hash('sha256', $grant['code_verifier'], true)), '+/', '-_'), '='), $query['code_challenge']);
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/', $query['state']);
        $this->assertStringNotContainsString($query['state'], (new AuthorizationAttempt)->authorizationUrl('12345'));
        $this->assertStringNotContainsString($grant['code_verifier'], print_r($attempt, true));
    }

    #[DataProvider('invalidCallbacks')]
    public function test_invalid_callbacks_never_make_requests(string $mutation): void
    {
        Http::fake();
        $attempt = new AuthorizationAttempt;
        $callback = $this->callbackUrl($attempt);
        $callback = match ($mutation) {
            'origin' => str_replace('brought-clover-landmass.ngrok-free.dev', 'attacker.test', $callback),
            'scheme' => str_replace('https:', 'http:', $callback),
            'port' => str_replace('.dev?', '.dev:444?', $callback),
            'path' => str_replace('.dev?', '.dev/callback?', $callback),
            'userinfo' => str_replace('https://', 'https://user@', $callback),
            'fragment' => $callback.'#fragment',
            'duplicate' => $callback.'&code=other',
            'encoded-duplicate' => $callback.'&%63ode=other',
            'array' => $callback.'&state%5B%5D=other',
            'state' => $callback.'x',
            'missing' => str_replace('code=dummy-code&', '', $callback),
            'missing-state' => AuthorizationAttempt::REDIRECT_URI.'?code=dummy-code',
            'blank' => str_replace('dummy-code', '', $callback),
            'oversized' => $callback.str_repeat('x', 16384),
        };
        $result = $this->probe($attempt, $callback);
        $this->assertFalse($result['ok']);
        $this->assertSame('invalid_callback', $result['error']);
        Http::assertNothingSent();
    }

    public static function invalidCallbacks(): array
    {
        return array_map(fn ($case) => [$case], ['origin', 'scheme', 'port', 'path', 'userinfo', 'fragment', 'duplicate', 'encoded-duplicate', 'array', 'state', 'missing', 'missing-state', 'blank', 'oversized']);
    }

    public function test_attempt_expires_at_five_minutes_and_failed_exchange_cannot_replay(): void
    {
        $attempt = new AuthorizationAttempt;
        $callback = $this->callbackUrl($attempt);
        $this->travel(5)->minutes();
        $this->assertSame('authorization_attempt_expired', $this->probe($attempt, $callback)['error']);
        Http::assertNothingSent();
        $attempt = new AuthorizationAttempt;
        $callback = $this->callbackUrl($attempt);
        Http::fake(['*/oauth/token' => Http::response(['error' => 'invalid_grant'], 400)]);
        $this->assertFalse($this->probe($attempt, $callback)['ok']);
        $this->assertSame('authorization_attempt_unavailable', $this->probe($attempt, $callback)['error']);
        Http::assertSentCount(1);
    }

    #[DataProvider('invalidTokens')]
    public function test_bad_token_responses_never_trigger_gets(mixed $body, int $status): void
    {
        Http::fake(['*/oauth/token' => Http::response($body, $status)]);
        $this->assertFalse($this->probe(new AuthorizationAttempt)['ok']);
        Http::assertSentCount(1);
    }

    public static function invalidTokens(): array
    {
        return [[['error' => 'invalid_grant'], 400], ['<html>denied</html>', 403], [[], 200], [[], 302],
            [['access_token' => "secret\r\nheader", 'token_type' => 'bearer', 'expires_in' => 3600], 200],
            [['access_token' => 'dummy-access-token', 'token_type' => 'bearer', 'expires_in' => 0], 200],
            [['access_token' => 'dummy-access-token', 'token_type' => 'unknown', 'expires_in' => 3600], 200],
            [['access_token' => 'dummy-access-token', 'token_type' => [], 'expires_in' => 3600], 200]];
    }

    public function test_tc18_uses_same_bearer_fixed_cross_seller_query_and_bounded_transport(): void
    {
        $options = [];
        Http::fake(function ($request, $requestOptions) use (&$options) {
            $options[] = $requestOptions;

            return Http::response(match (parse_url($request->url(), PHP_URL_PATH)) {
                '/oauth/token' => ['access_token' => 'dummy-access-token', 'token_type' => 'bearer', 'expires_in' => 21600],
                '/users/me' => ['id' => 123],
                default => ['results' => [['id' => 'MLA123456', 'title' => 'Toyota Corolla', 'price' => 15000, 'currency_id' => 'USD', 'permalink' => 'https://auto.mercadolibre.com.ar/MLA-123456-car']]],
            });
        });
        $result = $this->probe(new AuthorizationAttempt);
        $this->assertTrue($result['ok']);
        $this->assertSame('listings_received', $result['outcome']);
        $this->assertSame(1, $result['result_count']);
        Http::assertSentCount(3);
        $requests = Http::recorded()->pluck(0);
        $this->assertSame('POST', $requests[0]->method());
        $this->assertSame('application/x-www-form-urlencoded', $requests[0]->header('Content-Type')[0]);
        $this->assertSame(AuthorizationAttempt::REDIRECT_URI, $requests[0]['redirect_uri']);
        foreach ([$requests[1], $requests[2]] as $request) {
            $this->assertTrue($request->hasHeader('Authorization', 'Bearer dummy-access-token'));
        }
        $this->assertSame(['q' => 'Toyota Corolla', 'category' => 'MLA1744', 'limit' => 5], $requests[2]->data());
        foreach ($options as $option) {
            $this->assertFalse($option['allow_redirects']);
            $this->assertSame(3, $option['connect_timeout']);
            $this->assertSame(10, $option['timeout']);
        }
    }

    #[DataProvider('searchResponses')]
    public function test_tc19_distinguishes_denial_malformed_and_empty(mixed $body, int $status, string $outcome): void
    {
        $this->fakeProvider($body, $status);
        $result = $this->probe(new AuthorizationAttempt);
        $this->assertSame(200, $result['account']['status']);
        $this->assertSame($status, $result['search']['status']);
        $this->assertSame($outcome, $result['outcome'] ?? $result['error']);
        $this->assertSame($outcome === 'empty_results', $result['ok']);
        $json = json_encode($result);
        foreach (['dummy-access-token', 'dummy-secret', 'dummy-refresh-token', 'private@example.test', 'dummy-code'] as $secret) {
            $this->assertStringNotContainsString($secret, $json);
        }
    }

    public static function searchResponses(): array
    {
        return [[['results' => []], 200, 'empty_results'], [['error' => 'forbidden', 'message' => 'dummy-secret'], 403, 'search_rejected'],
            ['<html>dummy-access-token</html>', 200, 'malformed_search_response'], [['results' => new \stdClass], 200, 'malformed_search_response'],
            [['results' => [['id' => 'invalid']]], 200, 'malformed_search_response'], [[], 302, 'search_rejected'],
            ['{"results":[{"id":"MLA123","title":"Toyota Corolla","price":1e999,"currency_id":"USD","permalink":"https://auto.mercadolibre.com.ar/MLA-123-car"}]}', 200, 'malformed_search_response']];
    }

    public function test_timeout_has_no_retry_or_transport_secret_leak(): void
    {
        $calls = 0;
        Http::fake(function () use (&$calls) {
            $calls++;
            throw new ConnectionException('dummy-secret dummy-code');
        });
        $result = $this->probe(new AuthorizationAttempt);
        $this->assertSame(1, $calls);
        $this->assertSame('connection_error', $result['error']);
        $this->assertStringNotContainsString('dummy-', json_encode($result));
    }

    public function test_command_refuses_noninteractive_input_without_requests(): void
    {
        $this->artisan('mercadolibre:probe-access', ['--no-interaction' => true])->assertExitCode(1);
        Http::assertNothingSent();
    }

    public function test_command_questions_are_hidden_without_echo_fallback(): void
    {
        $this->fakeProvider();
        $command = Artisan::all()['mercadolibre:probe-access'];
        $this->app->instance('mercadolibre.stdin-is-terminal', true);
        $input = new ArrayInput([]);
        $output = new BufferedOutput;
        $style = Mockery::mock(OutputStyle::class.'[askQuestion]', [$input, $output]);
        $captured = '';
        $style->shouldReceive('askQuestion')->times(3)->andReturnUsing(function ($question) use (&$captured, $output) {
            $this->assertTrue($question->isHidden());
            $this->assertFalse($question->isHiddenFallback());
            if ($question->getQuestion() === 'App ID') {
                return '12345';
            }
            if ($question->getQuestion() === 'Client secret') {
                return 'dummy-secret';
            }
            $captured = $output->fetch();
            preg_match('~https://auth\.mercadolibre\.com\.ar/authorization\?[^\s]+~', $captured, $match);
            parse_str(parse_url($match[0], PHP_URL_QUERY), $query);

            return AuthorizationAttempt::REDIRECT_URI.'?code=dummy-code&state='.$query['state'];
        });
        $exit = $command->run($input, $style);
        $this->assertSame(0, $exit);
        $captured .= $output->fetch();
        $this->assertStringContainsString('empty_results', $captured);
        foreach (['dummy-secret', 'dummy-code', 'dummy-access-token', 'dummy-refresh-token'] as $secret) {
            $this->assertStringNotContainsString($secret, $captured);
        }
    }

    public function test_command_rejects_piped_input_and_hidden_input_failure(): void
    {
        $command = Artisan::all()['mercadolibre:probe-access'];
        $input = new ArrayInput([]);
        $output = new BufferedOutput;
        $this->app->instance('mercadolibre.stdin-is-terminal', false);
        $this->assertSame(1, $command->run($input, $output));
        $this->app->instance('mercadolibre.stdin-is-terminal', true);
        $style = Mockery::mock(OutputStyle::class.'[askQuestion]', [$input, $output]);
        $style->shouldReceive('askQuestion')->once()->andThrow(new \RuntimeException('dummy-secret'));
        $this->assertSame(1, $command->run($input, $style));
        $this->assertStringNotContainsString('dummy-secret', $output->fetch());
        Http::assertNothingSent();
    }

    public function test_reflected_secrets_and_unrequested_fields_are_not_returned(): void
    {
        $this->fakeProvider(['results' => [['id' => 'MLA123', 'title' => 'dummy-secret dummy-access-token dummy-refresh-token dummy-code',
            'price' => 1, 'currency_id' => 'ARS', 'permalink' => 'https://auto.mercadolibre.com.ar/MLA-123-car', 'seller' => ['email' => 'private@example.test']]]]);
        $result = $this->probe(new AuthorizationAttempt);
        $this->assertTrue($result['ok']);
        $json = json_encode($result);
        $this->assertStringNotContainsString('dummy-', $json);
        $this->assertStringNotContainsString('email', $json);
        $this->assertStringContainsString('[redacted]', $json);
    }

    public function test_account_failure_does_not_become_a_successful_search(): void
    {
        Http::fakeSequence()->push(['access_token' => 'dummy-token', 'token_type' => 'bearer', 'expires_in' => 3600])
            ->push(['error' => 'unauthorized'], 401)->push(['results' => []]);
        $result = $this->probe(new AuthorizationAttempt);
        $this->assertFalse($result['ok']);
        $this->assertSame('account_unverified', $result['error']);
        $this->assertSame(401, $result['account']['status']);
        $this->assertSame(200, $result['search']['status']);
    }
}
