<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concesionaria', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedBigInteger('usuario_id')->nullable()->unique();
            $table->string('nombre', 150);
            $table->string('responsable_dni', 20)->nullable();
            $table->string('telefono_publico', 30)->nullable();
            $table->string('telefono_responsable', 30)->nullable();
            $table->string('direccion', 255)->nullable();
            $table->string('localidad', 100)->nullable();
            $table->string('provincia', 100)->nullable();
            $table->string('estado_alta', 50)->nullable();
            $table->timestamp('creada_en');
            $table->foreign('usuario_id')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concesionaria');
    }
};
