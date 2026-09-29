<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publicacion_externa', function (Blueprint $table) {
            $table->integer('vehiculo_id');
            $table->string('marketplace', 100);
            $table->string('external_id', 255)->nullable()->unique();
            $table->string('url_original', 500)->nullable();
            $table->primary(['vehiculo_id']);
            $table->foreign('vehiculo_id')->references('id')->on('vehiculo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('publicacion_externa');
    }
};
