<?php

namespace Tests\Unit\Services;

use App\Services\Auth\GoogleProfile;
use InvalidArgumentException;
use Laravel\Socialite\Two\User as SocialiteUser;
use Tests\TestCase;

class GoogleAccountResolverTest extends TestCase
{
    private function socialiteUser(array $attributes, array $raw = []): SocialiteUser
    {
        return (new SocialiteUser)->setRaw($raw)->map($attributes);
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
}
