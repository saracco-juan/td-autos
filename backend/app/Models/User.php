<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Notifications\ResetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const ROL_COMPRADOR = 'comprador';

    public const ROL_CONCESIONARIA = 'concesionaria';

    public const ROL_ADMINISTRADOR = 'administrador';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'apellido',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'auth_subject',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var list<string>
     */
    protected $appends = [
        'perfil_completo',
        'tiene_diagnostico',
    ];

    /**
     * Send the password reset notification (Spanish mail).
     *
     * @param  string  $token
     */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    /**
     * A profile is complete when both name and apellido are filled (computed, not stored).
     */
    protected function perfilCompleto(): Attribute
    {
        return Attribute::get(fn () => filled($this->name) && filled($this->apellido));
    }

    /**
     * The user's single needs diagnosis (at most one row per user).
     *
     * @return HasOne<Diagnostico, $this>
     */
    public function diagnostico(): HasOne
    {
        return $this->hasOne(Diagnostico::class, 'usuario_id');
    }

    /**
     * An existing diagnosis counts unless its legacy passenger answer needs confirmation.
     */
    protected function tieneDiagnostico(): Attribute
    {
        return Attribute::get(fn () => $this->diagnostico()
            ->where(fn ($query) => $query->whereNull('estado')->orWhere('estado', '!=', 'pendiente_pasajeros'))
            ->exists());
    }

    /**
     * The dealer this user is responsible for (dealer users only).
     *
     * @return HasOne<Concesionaria, $this>
     */
    public function concesionaria(): HasOne
    {
        return $this->hasOne(Concesionaria::class, 'usuario_id');
    }

    public function esConcesionaria(): bool
    {
        return $this->rol === self::ROL_CONCESIONARIA;
    }

    /**
     * Platform administrators (created from the console, never through sign-up).
     */
    public function esAdministrador(): bool
    {
        return $this->rol === self::ROL_ADMINISTRADOR;
    }

    /**
     * Dealer users carry a summary of their dealer; other roles never get the key.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $data = parent::toArray();
        unset($data['concesionaria']);

        if ($this->esConcesionaria()) {
            $data['concesionaria'] = $this->concesionaria?->only(['id', 'nombre', 'estado_alta']);
        }

        return $data;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'activo' => 'boolean',
        ];
    }
}
