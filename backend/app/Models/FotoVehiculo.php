<?php

namespace App\Models;

use Database\Factories\FotoVehiculoFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FotoVehiculo extends Model
{
    /** @use HasFactory<FotoVehiculoFactory> */
    use HasFactory;

    protected $table = 'foto_vehiculo';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'vehiculo_id',
        'ubicacion_archivo',
        'orden',
    ];

    /**
     * @return BelongsTo<Vehiculo, $this>
     */
    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class, 'vehiculo_id');
    }
}
