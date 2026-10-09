<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One ticked checklist item; etapa_codigo holds the item code, not a stage code.
 * The table's primary key is (seguimiento_id, etapa_codigo), so there is no single key column:
 * create and delete rows through the relation or a query.
 */
class EtapaTransferenciaCompletada extends Model
{
    protected $table = 'etapa_transferencia_completada';

    protected $primaryKey = null;

    public $incrementing = false;

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'seguimiento_id',
        'etapa_codigo',
        'completada_en',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'completada_en' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<ChecklistTransferencia, $this>
     */
    public function checklist(): BelongsTo
    {
        return $this->belongsTo(ChecklistTransferencia::class, 'seguimiento_id');
    }
}
