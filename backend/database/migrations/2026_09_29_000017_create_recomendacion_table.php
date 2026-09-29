<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recomendacion', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('diagnostico_id')->nullable();
            $table->integer('vehiculo_id')->nullable();
            $table->integer('posicion');
            $table->decimal('puntaje_total', 10, 4);
            $table->timestamp('generada_en');
            $table->foreign('diagnostico_id')->references('id')->on('diagnostico');
            $table->foreign('vehiculo_id')->references('id')->on('vehiculo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recomendacion');
    }
};
