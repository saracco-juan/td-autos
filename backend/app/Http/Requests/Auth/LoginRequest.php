<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use App\Support\Email;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    public const MESSAGE_INVALID_CREDENTIALS = 'Usuario incorrecto, por favor intente nuevamente';

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => Email::normalize($this->input('email'))]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.required' => 'El email es obligatorio.',
            'email.email' => 'El email no tiene un formato válido.',
            'password.required' => 'La contraseña es obligatoria.',
        ];
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        if (! Auth::attempt($this->credentials(), $this->boolean('remember'))) {
            $this->failAttempt();
        }

        RateLimiter::clear($this->throttleKey());
    }

    /**
     * Check the credentials without starting a session (token clients).
     *
     * @throws ValidationException
     */
    public function authenticateWithoutSession(): User
    {
        $this->ensureIsNotRateLimited();

        $provider = Auth::guard('web')->getProvider();
        $user = $provider->retrieveByCredentials($this->credentials());

        if ($user === null || ! $provider->validateCredentials($user, $this->credentials())) {
            $this->failAttempt();
        }

        RateLimiter::clear($this->throttleKey());

        return $user;
    }

    /**
     * Inactive and Google-only (null password) accounts fail like any other bad credentials.
     *
     * @return array<string, mixed>
     */
    private function credentials(): array
    {
        return [...$this->only('email', 'password'), 'activo' => true];
    }

    /**
     * @throws ValidationException
     */
    private function failAttempt(): never
    {
        RateLimiter::hit($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => self::MESSAGE_INVALID_CREDENTIALS,
        ]);
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => "Demasiados intentos. Probá de nuevo en {$seconds} segundos.",
        ]);
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->input('email')).'|'.$this->ip());
    }
}
