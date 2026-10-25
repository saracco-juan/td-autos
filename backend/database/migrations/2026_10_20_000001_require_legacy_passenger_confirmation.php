<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Legacy 5 meant five OR more; neither new choice can be inferred safely.
        DB::table('diagnostico')->where('pasajeros', 5)->update([
            'pasajeros' => null,
            'estado' => 'pendiente_pasajeros',
        ]);
    }

    public function down(): void
    {
        // Retain migration history: rerunning up() cannot distinguish confirmed 5 from legacy 5.
        if (DB::table('diagnostico')->exists()) {
            throw new RuntimeException('Cannot roll back passenger confirmation while diagnoses exist. Restore a coordinated backup instead.');
        }
    }
};
