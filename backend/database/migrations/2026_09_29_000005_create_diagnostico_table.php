<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('diagnostico', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedBigInteger('usuario_id')->nullable()->unique();
            $table->decimal('presupuesto_maximo', 12, 2)->nullable();
            $table->string('uso_principal', 100)->nullable();
            $table->integer('pasajeros')->nullable();
            $table->string('transmision_preferida', 50)->nullable();
            $table->string('prioridad_comprador', 50)->nullable();
            $table->string('estado', 50)->nullable();
            $table->string('estado_fuente_externa', 50)->nullable();
            $table->timestamp('calculado_en')->nullable();
            $table->timestamp('actualizado_en')->nullable();
            $table->foreign('usuario_id')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('diagnostico');
    }
};
