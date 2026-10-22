<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('foto_vehiculo', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('vehiculo_id')->nullable();
            $table->string('ubicacion_archivo', 500);
            $table->integer('orden');
            $table->foreign('vehiculo_id')->references('id')->on('vehiculo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('foto_vehiculo');
    }
};
