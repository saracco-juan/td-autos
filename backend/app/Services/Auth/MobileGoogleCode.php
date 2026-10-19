<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * One-time codes that carry a verified Google sign-in from the system browser back to the app.
 * Only the hash of a code is stored; it lives for a short time and works once.
 */
class MobileGoogleCode
{
    private const KEY_PREFIX = 'mobile_google_code:';

    public function issue(User $user): string
    {
        $code = bin2hex(random_bytes(32));

        Cache::put(self::key($code), $user->getKey(), now()->addSeconds((int) config('mobile.google_code_ttl')));

        return $code;
    }

    /**
     * Consume the code and return the user it was issued to, or null when unknown, used or expired.
     */
    public function redeem(string $code): ?User
    {
        $userId = Cache::pull(self::key($code));

        return $userId === null ? null : User::find($userId);
    }

    private static function key(string $code): string
    {
        return self::KEY_PREFIX.hash('sha256', $code);
    }
}
