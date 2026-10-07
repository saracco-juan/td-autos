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
     * True once a diagnosis row exists for the user (computed, not stored).
     */
    protected function tieneDiagnostico(): Attribute
    {
        return Attribute::get(fn () => $this->diagnostico()->exists());
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
