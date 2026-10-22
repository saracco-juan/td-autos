<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Diagnostico extends Model
{
    protected $table = 'diagnostico';

    // The table has actualizado_en but no created_at/updated_at.
    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'usuario_id',
        'presupuesto_maximo',
        'uso_principal',
        'pasajeros',
        'kilometros_mensuales',
        'transmision_preferida',
        'prioridad_comprador',
        'estado',
        'actualizado_en',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'calculado_en' => 'datetime',
            'actualizado_en' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    /**
     * @return BelongsToMany<TipoCarroceria, $this>
     */
    public function carrocerias(): BelongsToMany
    {
        return $this->belongsToMany(TipoCarroceria::class, 'diagnostico_carroceria', 'diagnostico_id', 'tipo_carroceria_id');
    }
}
