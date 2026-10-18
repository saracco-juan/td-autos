<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Link between a vehicle and its listing in an external marketplace (RF05).
 */
class PublicacionExterna extends Model
{
    protected $table = 'publicacion_externa';

    protected $primaryKey = 'vehiculo_id';

    public $incrementing = false;

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = ['vehiculo_id', 'marketplace', 'external_id', 'url_original'];

    /**
     * @return BelongsTo<Vehiculo, $this>
     */
    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class, 'vehiculo_id');
    }
}
