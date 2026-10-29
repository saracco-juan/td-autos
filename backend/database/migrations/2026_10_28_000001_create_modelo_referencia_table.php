<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Curated models the recommendations point to (HU06). `marca`/`modelo` are the exact ACARA catalog names,
        // but there is no foreign key to the catalog: the table loads independently of it.
        Schema::create('modelo_referencia', function (Blueprint $table) {
            $table->increments('id');
            $table->string('marca');
            $table->string('modelo');
            $table->unique(['marca', 'modelo']);
            $table->integer('tipo_carroceria_id');
            $table->foreign('tipo_carroceria_id')->references('id')->on('tipo_carroceria');
            $table->unsignedTinyInteger('plazas');
            $table->boolean('tiene_manual');
            $table->boolean('tiene_automatica');
            $table->json('combustibles');
            $table->string('consumo');
            $table->unsignedTinyInteger('seguridad_estrellas')->nullable();
            $table->json('usos');
            $table->string('ruta_mercadolibre');
            $table->string('ruta_kavak')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('modelo_referencia');
    }
};
