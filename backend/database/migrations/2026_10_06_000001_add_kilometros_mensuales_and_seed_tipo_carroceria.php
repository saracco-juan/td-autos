<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const BODY_TYPES = ['Sedán', 'Hatchback', 'SUV', 'Pickup', 'Furgón', 'Rural / familiar'];

    public function up(): void
    {
        Schema::table('diagnostico', function (Blueprint $table) {
            $table->string('kilometros_mensuales', 50)->nullable();
        });

        // The catalog is data the questionnaire depends on, so it ships with the schema.
        DB::table('tipo_carroceria')->insert(array_map(fn (string $nombre) => ['nombre' => $nombre], self::BODY_TYPES));
    }

    public function down(): void
    {
        // Only the rows this migration inserted, and only when nothing references them.
        DB::table('tipo_carroceria')
            ->whereIn('nombre', self::BODY_TYPES)
            ->whereNotIn('id', DB::table('diagnostico_carroceria')->select('tipo_carroceria_id'))
            ->whereNotIn('id', DB::table('vehiculo')->whereNotNull('tipo_carroceria_id')->select('tipo_carroceria_id'))
            ->delete();

        Schema::table('diagnostico', function (Blueprint $table) {
            $table->dropColumn('kilometros_mensuales');
        });
    }
};
