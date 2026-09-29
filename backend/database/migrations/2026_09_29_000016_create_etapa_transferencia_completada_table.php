<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('etapa_transferencia_completada', function (Blueprint $table) {
            $table->integer('seguimiento_id');
            $table->string('etapa_codigo', 100);
            $table->timestamp('completada_en');
            $table->primary(['seguimiento_id', 'etapa_codigo']);
            $table->foreign('seguimiento_id')->references('id')->on('checklist_transferencia');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etapa_transferencia_completada');
    }
};
