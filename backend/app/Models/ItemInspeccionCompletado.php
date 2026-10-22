<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One ticked checklist item. The table's primary key is (checklist_id, item_codigo),
 * so there is no single key column: create and delete rows through the relation or a query.
 */
class ItemInspeccionCompletado extends Model
{
    protected $table = 'item_inspeccion_completado';

    protected $primaryKey = null;

    public $incrementing = false;

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'checklist_id',
        'item_codigo',
        'completado_en',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'completado_en' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<ChecklistInspeccion, $this>
     */
    public function checklist(): BelongsTo
    {
        return $this->belongsTo(ChecklistInspeccion::class, 'checklist_id');
    }
}
