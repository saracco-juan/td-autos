<?php

namespace App\Models;

use Database\Factories\ConcesionariaFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Concesionaria extends Model
{
    /** @use HasFactory<ConcesionariaFactory> */
    use HasFactory;

    public const ESTADO_PENDIENTE = 'pendiente';

    public const ESTADO_ACTIVA = 'activa';

    protected $table = 'concesionaria';

    // The table has creada_en but no created_at/updated_at.
    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'nombre',
        'responsable_dni',
        'telefono_publico',
        'telefono_responsable',
        'direccion',
        'localidad',
        'provincia',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'creada_en' => 'datetime',
        ];
    }

    /**
     * The responsible person's account.
     *
     * @return BelongsTo<User, $this>
     */
    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    /**
     * @return HasOne<Suscripcion, $this>
     */
    public function suscripcion(): HasOne
    {
        return $this->hasOne(Suscripcion::class, 'concesionaria_id');
    }

    /**
     * Payment receipts across the dealer's subscription.
     *
     * @return HasManyThrough<ComprobantePago, Suscripcion, $this>
     */
    public function comprobantes(): HasManyThrough
    {
        return $this->hasManyThrough(ComprobantePago::class, Suscripcion::class, 'concesionaria_id', 'suscripcion_id');
    }

    /**
     * True once an admin approved the registration request.
     */
    public function estaActiva(): bool
    {
        return $this->estado_alta === self::ESTADO_ACTIVA;
    }

    /**
     * The vehicles this dealer owns. Querying through it scopes to the dealer, so a vehicle
     * of another dealer is simply not found.
     *
     * @return BelongsToMany<Vehiculo, $this>
     */
    public function vehiculos(): BelongsToMany
    {
        return $this->belongsToMany(Vehiculo::class, 'vehiculo_concesionaria', 'concesionaria_id', 'vehiculo_id')
            ->withPivot(['patente_normalizada', 'visible', 'ocultado_en', 'eliminar_desde']);
    }
}
