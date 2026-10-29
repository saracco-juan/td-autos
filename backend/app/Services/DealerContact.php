<?php

namespace App\Services;

use App\Models\User;

final class DealerContact
{
    public function show(User $owner): array
    {
        return ['telefono_publico' => $owner->concesionaria->telefono_publico];
    }

    public function update(User $owner, ?string $phone): array
    {
        $owner->concesionaria->update(['telefono_publico' => $phone]);

        return $this->show($owner);
    }
}
