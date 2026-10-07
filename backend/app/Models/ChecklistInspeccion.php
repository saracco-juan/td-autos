<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChecklistInspeccion extends Model
{
    public const EN_CURSO = 'en_curso';

    public const INCOMPLETA = 'incompleta';

    public const COMPLETA = 'completa';

    protected $table = 'checklist_inspeccion';

    // The table has actualizado_en but no created_at/updated_at.
    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'usuario_id',
        'vehiculo_id',
        'estado',
        'actualizado_en',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
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
     * @return BelongsTo<Vehiculo, $this>
     */
    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class, 'vehiculo_id');
    }

    /**
     * @return HasMany<ItemInspeccionCompletado, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(ItemInspeccionCompletado::class, 'checklist_id');
    }
}
