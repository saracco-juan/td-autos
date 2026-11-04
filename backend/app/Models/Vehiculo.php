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
        'acara_version_id',
        'anio',
        'kilometraje',
        'precio',
        'moneda',
        'combustible',
        'transmision',
        'motor',
        'potencia',
        'plazas',
        'turbo',
        'potencia_unidad',
        'consumo_urbano',
        'consumo_ruta',
        'control_estabilidad',
        'frenos_abs',
        'airbags_frontales',
        'airbags_laterales',
        'airbags_cortina',
        'isofix',
        'frenado_autonomo',
        'asistencia_carril',
        'punto_ciego',
        'recordatorio_cinturon',
        'asistencia_velocidad',
        'monitoreo_conductor',
        'volante_regulable',
        'climatizador_bizona',
        'butacas_calefaccionadas',
        'android_auto_apple_carplay',
        'sensores_estacionamiento',
        'velocidad_crucero',
        'camara_retroceso',
        'aire_acondicionado',
        'ubicacion',
        'descripcion',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'plazas' => 'integer',
            'turbo' => 'boolean',
            'consumo_urbano' => 'decimal:2',
            'consumo_ruta' => 'decimal:2',
            'control_estabilidad' => 'boolean',
            'frenos_abs' => 'boolean',
            'airbags_frontales' => 'boolean',
            'airbags_laterales' => 'boolean',
            'airbags_cortina' => 'boolean',
            'isofix' => 'boolean',
            'frenado_autonomo' => 'boolean',
            'asistencia_carril' => 'boolean',
            'punto_ciego' => 'boolean',
            'recordatorio_cinturon' => 'boolean',
            'asistencia_velocidad' => 'boolean',
            'monitoreo_conductor' => 'boolean',
            'volante_regulable' => 'boolean',
            'climatizador_bizona' => 'boolean',
            'butacas_calefaccionadas' => 'boolean',
            'android_auto_apple_carplay' => 'boolean',
            'sensores_estacionamiento' => 'boolean',
            'velocidad_crucero' => 'boolean',
            'camara_retroceso' => 'boolean',
            'aire_acondicionado' => 'boolean',
        ];
    }

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

    /**
     * Link to the external listing, when the vehicle comes from a marketplace.
     *
     * @return HasOne<PublicacionExterna, $this>
     */
    public function publicacionExterna(): HasOne
    {
        return $this->hasOne(PublicacionExterna::class, 'vehiculo_id');
    }

    /**
     * The cover photo (lowest `orden`), loadable for a whole page in one query.
     *
     * @return HasOne<FotoVehiculo, $this>
     */
    public function portada(): HasOne
    {
        return $this->hasOne(FotoVehiculo::class, 'vehiculo_id')->ofMany('orden', 'min');
    }
}
