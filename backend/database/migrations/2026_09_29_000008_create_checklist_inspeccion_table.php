<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('checklist_inspeccion', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedBigInteger('usuario_id')->nullable();
            $table->integer('vehiculo_id')->nullable();
            $table->string('estado', 50);
            $table->timestamp('actualizado_en');
            $table->foreign('usuario_id')->references('id')->on('users');
            $table->foreign('vehiculo_id')->references('id')->on('vehiculo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checklist_inspeccion');
    }
};
