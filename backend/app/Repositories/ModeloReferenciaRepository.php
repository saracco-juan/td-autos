<?php

namespace App\Repositories;

use App\Models\ModeloReferencia;
use Illuminate\Database\Eloquent\Collection;

final class ModeloReferenciaRepository
{
    /**
     * @return Collection<int, ModeloReferencia>
     */
    public function all(): Collection
    {
        return ModeloReferencia::query()->with('tipoCarroceria')->orderBy('marca')->orderBy('modelo')->get();
    }
}
