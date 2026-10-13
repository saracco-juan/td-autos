<?php

namespace App\Models;

use Database\Factories\ConcesionariaFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
     * True once an admin approved the registration request.
     */
    public function estaActiva(): bool
    {
        return $this->estado_alta === self::ESTADO_ACTIVA;
    }
}
