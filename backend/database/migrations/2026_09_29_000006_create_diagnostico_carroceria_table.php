<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('diagnostico_carroceria', function (Blueprint $table) {
            $table->integer('diagnostico_id');
            $table->integer('tipo_carroceria_id');
            $table->primary(['diagnostico_id', 'tipo_carroceria_id']);
            $table->foreign('diagnostico_id')->references('id')->on('diagnostico');
            $table->foreign('tipo_carroceria_id')->references('id')->on('tipo_carroceria');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('diagnostico_carroceria');
    }
};
