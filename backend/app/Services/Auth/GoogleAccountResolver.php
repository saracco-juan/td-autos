<?php

namespace App\Services\Auth;

use App\Exceptions\Auth\GoogleEmailConflictException;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class GoogleAccountResolver
{
    private const APELLIDO_MAX_LENGTH = 100;

    /**
     * Find, link or create the local account for a Google identity.
     *
     * @throws GoogleEmailConflictException
     */
    public function resolve(GoogleProfile $profile): User
    {
        try {
            return $this->attempt($profile);
        } catch (UniqueConstraintViolationException) {
            // A concurrent callback created the account first; the retry finds it.
            return $this->attempt($profile);
        }
    }

    protected function attempt(GoogleProfile $profile): User
    {
        $registered = null;

        $user = DB::transaction(function () use ($profile, &$registered): User {
            $bySubject = User::where('auth_subject', $profile->subject())->first();

            if ($bySubject) {
                return $bySubject;
            }

            $byEmail = User::where('email', $profile->email)->first();

            if ($byEmail) {
                return $this->link($byEmail, $profile);
            }

            return $registered = $this->create($profile);
        });

        if ($registered) {
            event(new Registered($registered));
        }

        return $user;
    }

    private function link(User $user, GoogleProfile $profile): User
    {
        if (! $profile->emailVerified || $user->auth_subject !== null) {
            throw new GoogleEmailConflictException('The email already belongs to another account.');
        }

        $user->forceFill(['auth_subject' => $profile->subject()]);

        if ($user->email_verified_at === null) {
            $user->email_verified_at = now();
        }

        $user->save();

        return $user;
    }

    private function create(GoogleProfile $profile): User
    {
        $user = new User([
            'name' => $profile->givenName
                ?? $profile->fullName
                ?? Str::before($profile->email, '@'),
            'apellido' => $profile->familyName === null
                ? null
                : mb_substr($profile->familyName, 0, self::APELLIDO_MAX_LENGTH),
            'email' => $profile->email,
        ]);

        $user->forceFill([
            'rol' => User::ROL_COMPRADOR,
            'auth_subject' => $profile->subject(),
            'email_verified_at' => $profile->emailVerified ? now() : null,
        ])->save();

        return $user;
    }
}
