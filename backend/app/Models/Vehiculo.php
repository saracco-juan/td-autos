<?php

namespace App\Models;

use Database\Factories\VehiculoFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Vehiculo extends Model
{
    /** @use HasFactory<VehiculoFactory> */
    use HasFactory;

    protected $table = 'vehiculo';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'origen',
        'tipo_carroceria_id',
        'marca',
        'modelo',
        'version',
        'anio',
        'kilometraje',
        'precio',
        'moneda',
        'combustible',
        'transmision',
        'motor',
        'potencia',
        'ubicacion',
    ];

    /**
     * @return BelongsTo<TipoCarroceria, $this>
     */
    public function tipoCarroceria(): BelongsTo
    {
        return $this->belongsTo(TipoCarroceria::class, 'tipo_carroceria_id');
    }
}
