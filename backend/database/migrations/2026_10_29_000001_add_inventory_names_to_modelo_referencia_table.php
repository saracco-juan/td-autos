<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Other names the dealers' inventory uses for the same car as a curated model (e.g. ACARA "Fiesta KD" is
        // loaded as "Fiesta"), so the model photo can be found. An explicit list, never a fuzzy match.
        Schema::table('modelo_referencia', function (Blueprint $table) {
            $table->json('nombres_inventario')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('modelo_referencia', function (Blueprint $table) {
            $table->dropColumn('nombres_inventario');
        });
    }
};
