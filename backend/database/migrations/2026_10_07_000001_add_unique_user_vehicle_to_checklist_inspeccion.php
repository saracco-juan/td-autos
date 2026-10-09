<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One checklist per user and vehicle: the item marks hang from that single row.
        Schema::table('checklist_inspeccion', function (Blueprint $table) {
            $table->unique(['usuario_id', 'vehiculo_id']);
        });
    }

    public function down(): void
    {
        Schema::table('checklist_inspeccion', function (Blueprint $table) {
            $table->dropUnique(['usuario_id', 'vehiculo_id']);
        });
    }
};
