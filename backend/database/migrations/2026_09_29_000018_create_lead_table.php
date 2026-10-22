<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lead', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedBigInteger('comprador_usuario_id')->nullable();
            $table->integer('vehiculo_concesionaria_id')->nullable();
            $table->timestamp('generado_en');
            $table->foreign('comprador_usuario_id')->references('id')->on('users');
            $table->foreign('vehiculo_concesionaria_id')->references('vehiculo_id')->on('vehiculo_concesionaria');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead');
    }
};
