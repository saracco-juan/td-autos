<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Password policy: at least 8 characters with an uppercase letter,
 * a lowercase letter and a number. Every unmet requirement is reported.
 */
final class StrongPassword implements ValidationRule
{
    public const MIN_LENGTH = 8;

    public const MESSAGE_MIN_LENGTH = 'La contraseña debe tener al menos 8 caracteres.';

    public const MESSAGE_UPPERCASE = 'La contraseña debe incluir al menos una letra mayúscula.';

    public const MESSAGE_LOWERCASE = 'La contraseña debe incluir al menos una letra minúscula.';

    public const MESSAGE_NUMBER = 'La contraseña debe incluir al menos un número.';

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $password = is_string($value) ? $value : '';

        $requirements = [
            self::MESSAGE_MIN_LENGTH => mb_strlen($password) >= self::MIN_LENGTH,
            self::MESSAGE_UPPERCASE => preg_match('/\p{Lu}/u', $password) === 1,
            self::MESSAGE_LOWERCASE => preg_match('/\p{Ll}/u', $password) === 1,
            self::MESSAGE_NUMBER => preg_match('/[0-9]/', $password) === 1,
        ];

        foreach ($requirements as $message => $met) {
            if (! $met) {
                $fail($message);
            }
        }
    }
}
