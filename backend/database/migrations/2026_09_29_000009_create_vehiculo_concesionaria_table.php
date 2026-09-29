<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehiculo_concesionaria', function (Blueprint $table) {
            $table->integer('vehiculo_id');
            $table->integer('concesionaria_id')->nullable();
            $table->string('patente_normalizada', 50)->nullable()->unique();
            $table->boolean('visible');
            $table->timestamp('ocultado_en')->nullable();
            $table->timestamp('eliminar_desde')->nullable();
            $table->primary(['vehiculo_id']);
            $table->foreign('vehiculo_id')->references('id')->on('vehiculo');
            $table->foreign('concesionaria_id')->references('id')->on('concesionaria');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehiculo_concesionaria');
    }
};
