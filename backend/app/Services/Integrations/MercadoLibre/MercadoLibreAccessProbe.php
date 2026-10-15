<?php

namespace App\Services\Integrations\MercadoLibre;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use SensitiveParameter;
use stdClass;

final class MercadoLibreAccessProbe
{
    public function run(AuthorizationAttempt $attempt, #[SensitiveParameter] string $clientId,
        #[SensitiveParameter] string $secret, #[SensitiveParameter] string $callback): array
    {
        $report = ['ok' => false, 'stage' => 'authorization'];
        try {
            $attempt->authorizationUrl($clientId);
            if ($secret === '' || strlen($secret) > 4096) {
                throw new InvalidArgumentException('invalid_client_secret');
            }
            $grant = $attempt->consumeCallback($callback);
            $report['stage'] = 'oauth';
            $response = $this->request()->asForm()->post('https://api.mercadolibre.com/oauth/token',
                $grant + ['client_id' => $clientId, 'client_secret' => $secret]);
            $report['oauth'] = $this->diagnostic($response);
            if ($response->status() !== 200) {
                return $report + ['error' => 'token_rejected'];
            }
            $data = json_decode($response->body());
            if (! $data instanceof stdClass || ! is_string($data->access_token ?? null)
                || ! preg_match('/^[A-Za-z0-9._~+\/-]{1,8192}=*$/D', $data->access_token)
                || ! is_string($data->token_type ?? null) || strtolower($data->token_type) !== 'bearer'
                || ! is_int($data->expires_in ?? null) || $data->expires_in <= 0) {
                return $report + ['error' => 'malformed_token_response'];
            }
            $token = $data->access_token;
            $report['stage'] = 'account';
            $response = $this->request()->withToken($token)->get('https://api.mercadolibre.com/users/me');
            $report['account'] = $this->diagnostic($response);
            $account = json_decode($response->body());
            $accountValid = $response->status() === 200 && $account instanceof stdClass
                && is_int($account->id ?? null) && $account->id > 0;
            $report['stage'] = 'search';
            $response = $this->request()->withToken($token)->get('https://api.mercadolibre.com/sites/MLA/search', [
                'q' => 'Toyota Corolla', 'category' => 'MLA1744', 'limit' => 5,
            ]);
            $report['search'] = $this->diagnostic($response);
            if ($response->status() !== 200) {
                return $report + ['error' => 'search_rejected'];
            }
            $search = json_decode($response->body());
            if (! $search instanceof stdClass || ! is_array($search->results ?? null) || count($search->results) > 5) {
                return $report + ['error' => 'malformed_search_response'];
            }
            $listings = [];
            foreach ($search->results as $item) {
                if (! $item instanceof stdClass || ! is_string($item->id ?? null) || ! preg_match('/^MLA[0-9]+$/D', $item->id)
                    || ! is_string($item->title ?? null) || $item->title === '' || strlen($item->title) > 1024
                    || (! is_int($item->price ?? null) && ! is_float($item->price ?? null)) || ! is_finite($item->price) || $item->price < 0
                    || ! in_array($item->currency_id ?? null, ['ARS', 'USD'], true) || ! $this->validPermalink($item->permalink ?? null)) {
                    return $report + ['error' => 'malformed_search_response'];
                }
                $listings[] = array_intersect_key((array) $item, array_flip(['id', 'title', 'price', 'currency_id', 'permalink']));
            }
            if (! $accountValid) {
                return $report + ['error' => 'account_unverified'];
            }
            $report = array_replace($report, ['ok' => true, 'outcome' => $listings ? 'listings_received' : 'empty_results',
                'result_count' => count($listings), 'listings' => $listings]);
            // Even allowlisted listing fields must not echo credentials reflected by a provider.
            $sensitive = [$secret, $token, $grant['code'], $grant['code_verifier']];
            if (is_string($data->refresh_token ?? null) && $data->refresh_token !== '') {
                $sensitive[] = $data->refresh_token;
            }
            array_walk_recursive($report, static function (&$value) use ($sensitive) {
                if (is_string($value)) {
                    $value = str_replace($sensitive, '[redacted]', $value);
                }
            });

            return $report;
        } catch (InvalidArgumentException $exception) {
            $code = $exception->getMessage();

            return $report + ['error' => in_array($code, ['invalid_client_id', 'invalid_client_secret', 'invalid_callback',
                'authorization_attempt_unavailable', 'authorization_attempt_expired'], true) ? $code : 'probe_failed'];
        } catch (ConnectionException) {
            return $report + ['error' => 'connection_error'];
        }
    }

    private function request(): PendingRequest
    {
        return Http::acceptJson()->connectTimeout(3)->timeout(10)->withoutRedirecting();
    }

    private function diagnostic(#[SensitiveParameter] Response $response): array
    {
        $data = json_decode($response->body());
        $result = ['status' => $response->status(), 'format' => $data instanceof stdClass ? 'json_object' : (json_last_error() === JSON_ERROR_NONE ? 'json_other' : 'non_json')];
        if ($data instanceof stdClass && in_array($data->error ?? null, ['forbidden', 'unauthorized', 'invalid_token', 'invalid_grant', 'access_denied'], true)) {
            $result['code'] = $data->error;
        }

        return $result;
    }

    private function validPermalink(mixed $url): bool
    {
        if (! is_string($url) || strlen($url) > 2048 || ! filter_var($url, FILTER_VALIDATE_URL)) {
            return false;
        }
        $parts = parse_url($url);

        return ($parts['scheme'] ?? '') === 'https' && ($parts['port'] ?? 443) === 443
            && preg_match('/(^|\.)mercadolibre\.com\.ar$/D', $parts['host'] ?? '') === 1
            && ! isset($parts['user']) && ! isset($parts['pass']) && ! isset($parts['query']) && ! isset($parts['fragment']);
    }
}
