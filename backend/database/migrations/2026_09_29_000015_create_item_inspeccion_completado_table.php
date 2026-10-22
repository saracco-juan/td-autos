<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('item_inspeccion_completado', function (Blueprint $table) {
            $table->integer('checklist_id');
            $table->string('item_codigo', 100);
            $table->timestamp('completado_en');
            $table->primary(['checklist_id', 'item_codigo']);
            $table->foreign('checklist_id')->references('id')->on('checklist_inspeccion');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('item_inspeccion_completado');
    }
};
