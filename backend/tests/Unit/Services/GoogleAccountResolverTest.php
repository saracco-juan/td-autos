<?php

namespace Tests\Unit\Services;

use App\Exceptions\Auth\GoogleEmailConflictException;
use App\Models\User;
use App\Services\Auth\GoogleAccountResolver;
use App\Services\Auth\GoogleProfile;
use Exception;
use Illuminate\Auth\Events\Registered;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use InvalidArgumentException;
use Laravel\Socialite\Two\User as SocialiteUser;
use Tests\TestCase;

class GoogleAccountResolverTest extends TestCase
{
    use RefreshDatabase;

    private function socialiteUser(array $attributes, array $raw = []): SocialiteUser
    {
        return (new SocialiteUser)->setRaw($raw)->map($attributes);
    }

    private function profile(array $overrides = []): GoogleProfile
    {
        $data = array_merge([
            'sub' => 'S1',
            'email' => 'g@x.com',
            'emailVerified' => true,
            'givenName' => 'Gina',
            'familyName' => 'Perez',
            'fullName' => 'Gina Perez',
        ], $overrides);

        return new GoogleProfile(...$data);
    }

    public function test_profile_maps_sub_and_normalizes_email(): void
    {
        $profile = GoogleProfile::fromSocialite($this->socialiteUser(
            ['id' => 'S1', 'email' => '  G@X.com ', 'name' => 'Gina Perez'],
            ['given_name' => 'Gina', 'family_name' => 'Perez', 'email_verified' => true],
        ));

        $this->assertSame('S1', $profile->sub);
        $this->assertSame('g@x.com', $profile->email);
        $this->assertSame('google:S1', $profile->subject());
        $this->assertTrue($profile->emailVerified);
        $this->assertSame('Gina', $profile->givenName);
        $this->assertSame('Perez', $profile->familyName);
        $this->assertSame('Gina Perez', $profile->fullName);
    }

    public function test_profile_coerces_string_email_verified(): void
    {
        $true = GoogleProfile::fromSocialite($this->socialiteUser(
            ['id' => 'S1', 'email' => 'g@x.com'], ['email_verified' => 'true'],
        ));
        $false = GoogleProfile::fromSocialite($this->socialiteUser(
            ['id' => 'S1', 'email' => 'g@x.com'], ['email_verified' => 'false'],
        ));
        $missing = GoogleProfile::fromSocialite($this->socialiteUser(
            ['id' => 'S1', 'email' => 'g@x.com'],
        ));

        $this->assertTrue($true->emailVerified);
        $this->assertFalse($false->emailVerified);
        $this->assertFalse($missing->emailVerified);
    }

    public function test_profile_requires_sub_and_email(): void
    {
        $this->expectException(InvalidArgumentException::class);
        GoogleProfile::fromSocialite($this->socialiteUser(['id' => null, 'email' => 'g@x.com']));
    }

    public function test_profile_requires_email(): void
    {
        $this->expectException(InvalidArgumentException::class);
        GoogleProfile::fromSocialite($this->socialiteUser(['id' => 'S1', 'email' => null]));
    }

    public function test_existing_google_subject_returns_same_user(): void
    {
        $user = User::factory()->create(['email' => 'other@x.com', 'auth_subject' => 'google:S1']);

        $resolved = app(GoogleAccountResolver::class)->resolve($this->profile());

        $this->assertTrue($resolved->is($user));
        $this->assertSame(1, User::count());
    }

    public function test_verified_google_email_links_existing_local_user(): void
    {
        $user = User::factory()->unverified()->create(['email' => 'g@x.com', 'auth_subject' => null]);

        $resolved = app(GoogleAccountResolver::class)->resolve($this->profile());

        $this->assertTrue($resolved->is($user));
        $this->assertSame(1, User::count());
        $this->assertSame('google:S1', $user->fresh()->auth_subject);
        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_unverified_google_email_with_existing_user_is_rejected(): void
    {
        $user = User::factory()->create(['email' => 'g@x.com', 'auth_subject' => null]);

        try {
            app(GoogleAccountResolver::class)->resolve($this->profile(['emailVerified' => false]));
            $this->fail('Expected GoogleEmailConflictException.');
        } catch (GoogleEmailConflictException) {
            $this->assertNull($user->fresh()->auth_subject);
            $this->assertSame(1, User::count());
        }
    }

    public function test_existing_user_with_different_subject_is_rejected(): void
    {
        $user = User::factory()->create(['email' => 'g@x.com', 'auth_subject' => 'google:OTHER']);

        try {
            app(GoogleAccountResolver::class)->resolve($this->profile());
            $this->fail('Expected GoogleEmailConflictException.');
        } catch (GoogleEmailConflictException) {
            $this->assertSame('google:OTHER', $user->fresh()->auth_subject);
        }
    }

    public function test_new_verified_google_user_is_created_as_buyer(): void
    {
        Event::fake([Registered::class]);

        $user = app(GoogleAccountResolver::class)->resolve($this->profile());

        $this->assertSame(1, User::count());
        $this->assertSame('g@x.com', $user->email);
        $this->assertSame('Gina', $user->name);
        $this->assertSame('Perez', $user->apellido);
        $this->assertSame(User::ROL_COMPRADOR, $user->rol);
        $this->assertSame('google:S1', $user->auth_subject);
        $this->assertNull($user->password);
        $this->assertNotNull($user->email_verified_at);
        Event::assertDispatched(Registered::class, fn (Registered $e) => $e->user->is($user));
    }

    public function test_new_unverified_google_user_has_no_verified_at(): void
    {
        $user = app(GoogleAccountResolver::class)->resolve($this->profile(['emailVerified' => false]));

        $this->assertNull($user->email_verified_at);
    }

    public function test_new_user_name_falls_back_to_full_name_then_email_local_part(): void
    {
        $resolver = app(GoogleAccountResolver::class);

        $fromFull = $resolver->resolve($this->profile([
            'sub' => 'A', 'email' => 'a@x.com', 'givenName' => null, 'familyName' => null, 'fullName' => 'Ana Lopez',
        ]));
        $fromEmail = $resolver->resolve($this->profile([
            'sub' => 'B', 'email' => 'bob.smith@x.com', 'givenName' => null, 'familyName' => null, 'fullName' => null,
        ]));

        $this->assertSame('Ana Lopez', $fromFull->name);
        $this->assertNull($fromFull->apellido);
        $this->assertSame('bob.smith', $fromEmail->name);
    }

    public function test_family_name_is_truncated_to_column_length(): void
    {
        $user = app(GoogleAccountResolver::class)->resolve($this->profile(['familyName' => str_repeat('a', 150)]));

        $this->assertSame(100, mb_strlen($user->apellido));
    }

    public function test_unique_constraint_race_is_retried_once(): void
    {
        $winner = User::factory()->create(['email' => 'g@x.com', 'auth_subject' => 'google:S1']);

        $resolver = new class extends GoogleAccountResolver
        {
            public int $calls = 0;

            protected function attempt(GoogleProfile $profile): User
            {
                if (++$this->calls === 1) {
                    throw new UniqueConstraintViolationException('sqlite', 'insert', [], new Exception('race'));
                }

                return parent::attempt($profile);
            }
        };

        $resolved = $resolver->resolve($this->profile());

        $this->assertTrue($resolved->is($winner));
        $this->assertSame(2, $resolver->calls);
    }
}
