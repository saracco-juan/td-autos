<?php

namespace App\Services\Integrations\MercadoLibre;

use InvalidArgumentException;
use SensitiveParameter;

final class AuthorizationAttempt
{
    public const REDIRECT_URI = 'https://brought-clover-landmass.ngrok-free.dev';

    private string $state;

    private string $verifier;

    private int $expiresAt;

    private bool $consumed = false;

    public function __construct()
    {
        $this->state = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $this->verifier = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $this->expiresAt = now()->timestamp + 300;
    }

    public function authorizationUrl(#[SensitiveParameter] string $clientId): string
    {
        if (! preg_match('/^[0-9]{1,32}$/D', $clientId)) {
            throw new InvalidArgumentException('invalid_client_id');
        }

        return 'https://auth.mercadolibre.com.ar/authorization?'.http_build_query([
            'response_type' => 'code', 'client_id' => $clientId, 'redirect_uri' => self::REDIRECT_URI,
            'state' => $this->state, 'code_challenge_method' => 'S256',
            'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', $this->verifier, true)), '+/', '-_'), '='),
        ], '', '&', PHP_QUERY_RFC3986);
    }

    public function consumeCallback(#[SensitiveParameter] string $url): array
    {
        if ($this->consumed || now()->timestamp >= $this->expiresAt) {
            throw new InvalidArgumentException($this->consumed ? 'authorization_attempt_unavailable' : 'authorization_attempt_expired');
        }
        if (strlen($url) > 16384 || preg_match('/[\x00-\x20\x7f]/', $url)) {
            throw new InvalidArgumentException('invalid_callback');
        }
        $parts = parse_url($url);
        if (! filter_var($url, FILTER_VALIDATE_URL) || ($parts['scheme'] ?? null) !== 'https'
            || ($parts['host'] ?? null) !== parse_url(self::REDIRECT_URI, PHP_URL_HOST)
            || ($parts['port'] ?? 443) !== 443 || ! in_array($parts['path'] ?? '', ['', '/'], true)
            || isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment'])) {
            throw new InvalidArgumentException('invalid_callback');
        }
        $values = [];
        foreach (explode('&', $parts['query'] ?? '') as $part) {
            [$key, $value] = array_pad(explode('=', $part, 2), 2, '');
            $key = urldecode($key);
            if (str_contains($key, '[') || str_contains($key, ']') || array_key_exists($key, $values)) {
                throw new InvalidArgumentException('invalid_callback');
            }
            $values[$key] = urldecode($value);
        }
        if (! isset($values['state']) || ! hash_equals($this->state, $values['state'])
            || ! isset($values['code']) || trim($values['code']) === '' || isset($values['error'])) {
            throw new InvalidArgumentException('invalid_callback');
        }
        // Consume before transport: even a timeout cannot safely replay an authorization code.
        $this->consumed = true;

        return ['grant_type' => 'authorization_code', 'code' => $values['code'],
            'code_verifier' => $this->verifier, 'redirect_uri' => self::REDIRECT_URI];
    }

    public function __debugInfo(): array
    {
        return ['consumed' => $this->consumed, 'expires_at' => $this->expiresAt];
    }
}
