<?php

namespace Tests\Feature\Mail;

use Illuminate\Http\Client\Request;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportException;
use Tests\TestCase;

/**
 * Deployed environments send mail through the Gmail API over HTTPS (Render free blocks SMTP).
 */
class GmailApiTransportTest extends TestCase
{
    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    private const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'mail.mailers.gmail.client_id' => 'test-client-id',
            'mail.mailers.gmail.client_secret' => 'test-client-secret',
            'mail.mailers.gmail.refresh_token' => 'test-refresh-token',
            'mail.from.address' => 'tdautos.noreply@gmail.com',
            'mail.from.name' => 'TD Autos',
        ]);
    }

    public function test_sends_the_mime_message_through_the_gmail_api(): void
    {
        Http::fake([
            self::TOKEN_URL => Http::response(['access_token' => 'access-1', 'expires_in' => 3599]),
            self::SEND_URL => Http::response(['id' => 'msg-1']),
        ]);

        $this->sendMail();

        Http::assertSent(fn (Request $request) => $request->url() === self::TOKEN_URL
            && $request->method() === 'POST'
            && $request['grant_type'] === 'refresh_token'
            && $request['client_id'] === 'test-client-id'
            && $request['client_secret'] === 'test-client-secret'
            && $request['refresh_token'] === 'test-refresh-token');

        Http::assertSent(function (Request $request) {
            if ($request->url() !== self::SEND_URL) {
                return false;
            }

            $mime = $this->decodeRaw($request['raw']);

            return $request->method() === 'POST'
                && $request->hasHeader('Authorization', 'Bearer access-1')
                && str_contains($mime, 'To: buyer@example.com')
                && str_contains($mime, 'From: TD Autos <tdautos.noreply@gmail.com>')
                && str_contains($mime, 'Subject: Hola desde TD Autos');
        });
    }

    public function test_keeps_blind_copies_as_a_bcc_header_for_the_gmail_api(): void
    {
        Http::fake([
            self::TOKEN_URL => Http::response(['access_token' => 'access-1', 'expires_in' => 3599]),
            self::SEND_URL => Http::response(['id' => 'msg-1']),
        ]);

        Mail::mailer('gmail')->raw('Copia.', function (Message $message) {
            $message->to('buyer@example.com')->bcc('admin@example.com')->subject('Copia oculta');
        });

        Http::assertSent(function (Request $request) {
            if ($request->url() !== self::SEND_URL) {
                return false;
            }

            $mime = $this->decodeRaw($request['raw']);

            return str_contains($mime, 'Bcc: admin@example.com')
                && ! str_contains($mime, 'Bcc: buyer@example.com');
        });
    }

    public function test_reuses_the_cached_access_token(): void
    {
        Http::fake([
            self::TOKEN_URL => Http::response(['access_token' => 'access-1', 'expires_in' => 3599]),
            self::SEND_URL => Http::response(['id' => 'msg-1']),
        ]);

        $this->sendMail();
        $this->sendMail();

        $this->assertSame(1, $this->countRequestsTo(self::TOKEN_URL));
        $this->assertSame(2, $this->countRequestsTo(self::SEND_URL));
    }

    public function test_refreshes_the_token_and_retries_once_after_a_401(): void
    {
        Http::fake([
            self::TOKEN_URL => Http::sequence()
                ->push(['access_token' => 'stale', 'expires_in' => 3599])
                ->push(['access_token' => 'fresh', 'expires_in' => 3599]),
            self::SEND_URL => Http::sequence()
                ->push(['error' => ['code' => 401]], 401)
                ->push(['id' => 'msg-1']),
        ]);

        $this->sendMail();

        $this->assertSame(2, $this->countRequestsTo(self::TOKEN_URL));
        Http::assertSent(fn (Request $request) => $request->url() === self::SEND_URL
            && $request->hasHeader('Authorization', 'Bearer fresh'));
    }

    public function test_a_second_401_fails_without_more_retries(): void
    {
        Http::fake([
            self::TOKEN_URL => Http::response(['access_token' => 'access-1', 'expires_in' => 3599]),
            self::SEND_URL => Http::response(['error' => ['code' => 401]], 401),
        ]);

        try {
            $this->sendMail();
            $this->fail('Expected a TransportException.');
        } catch (TransportException $exception) {
            $this->assertStringContainsString('401', $exception->getMessage());
        }

        $this->assertSame(2, $this->countRequestsTo(self::SEND_URL));
    }

    public function test_a_server_error_throws_a_transport_exception_without_secrets(): void
    {
        Http::fake([
            self::TOKEN_URL => Http::response(['access_token' => 'access-1', 'expires_in' => 3599]),
            self::SEND_URL => Http::response('echo test-client-secret test-refresh-token access-1', 500),
        ]);

        try {
            $this->sendMail();
            $this->fail('Expected a TransportException.');
        } catch (TransportException $exception) {
            $this->assertStringContainsString('500', $exception->getMessage());
            $this->assertNoSecretsIn($exception->getMessage());
        }
    }

    public function test_a_rejected_refresh_token_throws_a_transport_exception_without_secrets(): void
    {
        Http::fake([
            self::TOKEN_URL => Http::response('invalid_grant test-refresh-token test-client-secret', 400),
        ]);

        try {
            $this->sendMail();
            $this->fail('Expected a TransportException.');
        } catch (TransportException $exception) {
            $this->assertStringContainsString('400', $exception->getMessage());
            $this->assertNoSecretsIn($exception->getMessage());
        }

        Http::assertNotSent(fn (Request $request) => $request->url() === self::SEND_URL);
    }

    private function sendMail(): void
    {
        Mail::mailer('gmail')->raw('Tu cuenta está lista.', function (Message $message) {
            $message->to('buyer@example.com')->subject('Hola desde TD Autos');
        });
    }

    private function decodeRaw(string $raw): string
    {
        $this->assertDoesNotMatchRegularExpression('/[+\/]/', $raw, 'raw must be base64url');

        return (string) base64_decode(strtr($raw, '-_', '+/'));
    }

    private function countRequestsTo(string $url): int
    {
        return Http::recorded(fn (Request $request) => $request->url() === $url)->count();
    }

    private function assertNoSecretsIn(string $text): void
    {
        foreach (['test-client-secret', 'test-refresh-token', 'access-1'] as $secret) {
            $this->assertStringNotContainsString($secret, $text);
        }
    }
}
