<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One transfer checklist per user. The table keeps a vehiculo_id column from the DER,
 * but the checklist is not tied to a vehicle, so it stays null and is not fillable.
 */
class ChecklistTransferencia extends Model
{
    public const EN_CURSO = 'en_curso';

    public const INCOMPLETA = 'incompleta';

    public const COMPLETA = 'completa';

    protected $table = 'checklist_transferencia';

    // The table has actualizado_en but no created_at/updated_at.
    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'usuario_id',
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
     * @return HasMany<EtapaTransferenciaCompletada, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(EtapaTransferenciaCompletada::class, 'seguimiento_id');
    }
}
