<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tipo_carroceria', function (Blueprint $table) {
            $table->increments('id');
            $table->string('nombre', 100);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tipo_carroceria');
    }
};
