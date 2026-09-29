<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('favorito', function (Blueprint $table) {
            $table->unsignedBigInteger('usuario_id');
            $table->integer('vehiculo_id');
            $table->timestamp('fecha_guardado');
            $table->primary(['usuario_id', 'vehiculo_id']);
            $table->foreign('usuario_id')->references('id')->on('users');
            $table->foreign('vehiculo_id')->references('id')->on('vehiculo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('favorito');
    }
};
