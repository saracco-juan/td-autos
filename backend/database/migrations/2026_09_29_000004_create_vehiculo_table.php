<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehiculo', function (Blueprint $table) {
            $table->increments('id');
            $table->string('origen', 50);
            $table->integer('tipo_carroceria_id')->nullable();
            $table->string('marca', 100)->nullable();
            $table->string('modelo', 100)->nullable();
            $table->string('version', 100)->nullable();
            $table->integer('anio')->nullable();
            $table->integer('kilometraje')->nullable();
            $table->decimal('precio', 12, 2)->nullable();
            $table->string('moneda', 10)->nullable();
            $table->string('combustible', 50)->nullable();
            $table->string('transmision', 50)->nullable();
            $table->string('motor', 100)->nullable();
            $table->integer('potencia')->nullable();
            $table->string('ubicacion', 150)->nullable();
            $table->foreign('tipo_carroceria_id')->references('id')->on('tipo_carroceria');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehiculo');
    }
};
