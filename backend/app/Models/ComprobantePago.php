<?php

namespace App\Models;

use Database\Factories\ComprobantePagoFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A payment receipt (bank transfer proof) a dealer uploads for an administrator to review.
 */
class ComprobantePago extends Model
{
    /** @use HasFactory<ComprobantePagoFactory> */
    use HasFactory;

    public const ESTADO_PENDIENTE_REVISION = 'pendiente de revisión';

    public const ESTADO_APROBADO = 'aprobado';

    public const ESTADO_RECHAZADO = 'rechazado';

    protected $table = 'comprobante_pago';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'suscripcion_id',
        'periodo_desde',
        'periodo_hasta',
        'archivo_url',
        'estado',
        'fecha_de_pago',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'periodo_desde' => 'date',
            'periodo_hasta' => 'date',
            'fecha_de_pago' => 'datetime',
            'fecha_revision' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Suscripcion, $this>
     */
    public function suscripcion(): BelongsTo
    {
        return $this->belongsTo(Suscripcion::class, 'suscripcion_id');
    }

    /**
     * The administrator who approved or rejected the receipt.
     *
     * @return BelongsTo<User, $this>
     */
    public function revisadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revisado_por_admin_id');
    }

    public function estaPendiente(): bool
    {
        return $this->estado === self::ESTADO_PENDIENTE_REVISION;
    }

    /**
     * A receipt pays the first activation unless an earlier receipt of the same
     * subscription was already approved; then it is a renewal.
     */
    public function esRenovacion(): bool
    {
        return self::query()
            ->where('suscripcion_id', $this->suscripcion_id)
            ->where('estado', self::ESTADO_APROBADO)
            ->where('id', '<', $this->id)
            ->exists();
    }

    /**
     * Receipts still waiting for an administrator decision.
     *
     * @param  Builder<ComprobantePago>  $query
     * @return Builder<ComprobantePago>
     */
    public function scopePendientes(Builder $query): Builder
    {
        // Qualified: the scope is also used through a join (dealer -> subscription -> receipts).
        return $query->where($query->qualifyColumn('estado'), self::ESTADO_PENDIENTE_REVISION);
    }
}
