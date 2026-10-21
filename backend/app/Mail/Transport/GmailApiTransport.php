<?php

namespace App\Mail\Transport;

use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory as Http;
use Illuminate\Http\Client\Response;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Message;
use Symfony\Component\Mime\MessageConverter;

/**
 * Sends mail through the Gmail API over HTTPS, as the account that granted the refresh token
 * (scope gmail.send). Used where outbound SMTP is blocked (Render free).
 *
 * Error messages carry only HTTP statuses: credentials, tokens and response bodies never leave
 * this class.
 */
class GmailApiTransport extends AbstractTransport
{
    public const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    public const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

    /** Seconds subtracted from the token lifetime so a cached token never expires mid-request. */
    private const EXPIRY_MARGIN = 300;

    private const TIMEOUT = 20;

    private const CONNECT_TIMEOUT = 10;

    public function __construct(
        private readonly Http $http,
        private readonly Cache $cache,
        private readonly string $clientId,
        private readonly string $clientSecret,
        private readonly string $refreshToken,
    ) {
        parent::__construct();
    }

    public function __toString(): string
    {
        return 'gmail+api://default';
    }

    protected function doSend(SentMessage $message): void
    {
        $raw = strtr(base64_encode($this->mime($message)), '+/', '-_');

        $response = $this->post($raw, $this->accessToken());

        if ($response->status() === 401) {
            $this->cache->forget($this->cacheKey());
            $response = $this->post($raw, $this->accessToken());
        }

        if (! $response->successful()) {
            throw new TransportException("Gmail API rejected the message (HTTP {$response->status()}).");
        }
    }

    /**
     * The rendered MIME message. Symfony strips the Bcc header before rendering, and the Gmail API
     * takes the recipients from the headers, so blind copies are added back from the envelope.
     */
    private function mime(SentMessage $message): string
    {
        $mime = $message->toString();
        $original = $message->getOriginalMessage();

        if (! $original instanceof Message) {
            return $mime;
        }

        $email = MessageConverter::toEmail($original);
        $visible = array_map(
            fn (Address $address) => strtolower($address->getAddress()),
            [...$email->getTo(), ...$email->getCc()],
        );
        $bcc = array_filter(
            $message->getEnvelope()->getRecipients(),
            fn (Address $address) => ! in_array(strtolower($address->getAddress()), $visible, true),
        );

        if ($bcc === []) {
            return $mime;
        }

        $header = 'Bcc: '.implode(', ', array_map(fn (Address $address) => $address->toString(), $bcc));

        return $header."\r\n".$mime;
    }

    private function post(string $raw, string $accessToken): Response
    {
        return $this->request(fn () => $this->http
            ->withToken($accessToken)
            ->timeout(self::TIMEOUT)
            ->connectTimeout(self::CONNECT_TIMEOUT)
            ->asJson()
            ->post(self::SEND_URL, ['raw' => $raw]));
    }

    private function accessToken(): string
    {
        $cached = $this->cache->get($this->cacheKey());

        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        $response = $this->request(fn () => $this->http
            ->timeout(self::TIMEOUT)
            ->connectTimeout(self::CONNECT_TIMEOUT)
            ->asForm()
            ->post(self::TOKEN_URL, [
                'grant_type' => 'refresh_token',
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
                'refresh_token' => $this->refreshToken,
            ]));

        $token = $response->json('access_token');

        if (! $response->successful() || ! is_string($token) || $token === '') {
            throw new TransportException("Could not get a Gmail API access token (HTTP {$response->status()}).");
        }

        $ttl = max(1, (int) $response->json('expires_in', 3600) - self::EXPIRY_MARGIN);
        $this->cache->put($this->cacheKey(), $token, $ttl);

        return $token;
    }

    /**
     * @param  callable(): Response  $send
     */
    private function request(callable $send): Response
    {
        try {
            return $send();
        } catch (ConnectionException) {
            throw new TransportException('Could not reach the Gmail API.');
        }
    }

    private function cacheKey(): string
    {
        return 'mail.gmail.access_token.'.sha1($this->clientId);
    }
}
