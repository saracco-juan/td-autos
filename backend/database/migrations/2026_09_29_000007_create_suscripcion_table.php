<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suscripcion', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('concesionaria_id')->nullable()->unique();
            $table->string('estado', 50);
            $table->date('vigente_desde');
            $table->date('vigente_hasta')->nullable();
            $table->date('gracia_hasta')->nullable();
            $table->date('inactiva_desde')->nullable();
            $table->date('retencion_hasta')->nullable();
            $table->foreign('concesionaria_id')->references('id')->on('concesionaria');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suscripcion');
    }
};
