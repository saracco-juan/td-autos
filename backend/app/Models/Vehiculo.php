<?php

namespace App\Models;

use Database\Factories\VehiculoFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

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
        'descripcion',
    ];

    /**
     * @return BelongsTo<TipoCarroceria, $this>
     */
    public function tipoCarroceria(): BelongsTo
    {
        return $this->belongsTo(TipoCarroceria::class, 'tipo_carroceria_id');
    }

    /**
     * Who owns the vehicle when it was loaded by a dealer.
     *
     * @return HasOne<VehiculoConcesionaria, $this>
     */
    public function propiedad(): HasOne
    {
        return $this->hasOne(VehiculoConcesionaria::class, 'vehiculo_id');
    }

    /**
     * Photos in upload order; the first one is the cover.
     *
     * @return HasMany<FotoVehiculo, $this>
     */
    public function fotos(): HasMany
    {
        return $this->hasMany(FotoVehiculo::class, 'vehiculo_id')->orderBy('orden');
    }
}
