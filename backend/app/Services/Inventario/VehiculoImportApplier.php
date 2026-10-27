<?php

namespace App\Services\Inventario;

use App\Models\Concesionaria;
use App\Support\VehiculoFotos;
use Illuminate\Support\Facades\DB;

/**
 * Applies a valid import plan whole (every row or none) and, once the transaction has committed,
 * deletes the photo files the new URLs replaced. Shared by the import endpoint and the demo command.
 */
class VehiculoImportApplier
{
    public function __construct(private readonly VehiculoImporter $importer) {}

    /**
     * @throws ImportConflictException When a plate was taken since the plan was made.
     */
    public function apply(Concesionaria $dealer, ImportPlan $plan): void
    {
        $replaced = DB::transaction(fn () => $this->importer->apply($dealer, $plan));

        VehiculoFotos::forget($replaced);
    }
}
