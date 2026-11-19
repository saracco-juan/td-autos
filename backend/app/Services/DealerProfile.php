<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

final class DealerProfile
{
    private const DEALER_FIELDS = ['telefono_publico', 'direccion', 'localidad', 'provincia', 'responsable_dni', 'telefono_responsable'];

    public function show(User $owner): array
    {
        return [
            ...$owner->concesionaria->only(['nombre', ...self::DEALER_FIELDS]),
            'email' => $owner->email,
            'responsable_nombre' => $owner->name,
            'responsable_apellido' => $owner->apellido,
        ];
    }

    public function update(User $owner, array $data): array
    {
        DB::transaction(function () use ($owner, $data) {
            $owner->concesionaria->update(Arr::only($data, self::DEALER_FIELDS));
            $owner->update([
                'name' => $data['responsable_nombre'],
                'apellido' => $data['responsable_apellido'],
            ]);
        });

        return $this->show($owner);
    }
}
