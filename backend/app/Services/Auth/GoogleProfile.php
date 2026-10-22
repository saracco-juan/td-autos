<?php

namespace App\Services\Auth;

use App\Support\Email;
use InvalidArgumentException;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Laravel\Socialite\Two\User;

final class GoogleProfile
{
    public function __construct(
        public readonly string $sub,
        public readonly string $email,
        public readonly bool $emailVerified,
        public readonly ?string $givenName,
        public readonly ?string $familyName,
        public readonly ?string $fullName,
    ) {}

    public static function fromSocialite(SocialiteUser $user): self
    {
        $sub = trim((string) $user->getId());
        $email = trim((string) $user->getEmail());

        if ($sub === '' || $email === '') {
            throw new InvalidArgumentException('Google profile is missing the subject or the email.');
        }

        $raw = $user instanceof User ? $user->user : [];

        return new self(
            sub: $sub,
            email: Email::normalize($email),
            emailVerified: filter_var($raw['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN),
            givenName: self::nullableString($raw['given_name'] ?? null),
            familyName: self::nullableString($raw['family_name'] ?? null),
            fullName: self::nullableString($user->getName()),
        );
    }

    /**
     * Identity stored in users.auth_subject.
     */
    public function subject(): string
    {
        return 'google:'.$this->sub;
    }

    private static function nullableString(mixed $value): ?string
    {
        $value = is_string($value) ? trim($value) : '';

        return $value === '' ? null : $value;
    }
}
