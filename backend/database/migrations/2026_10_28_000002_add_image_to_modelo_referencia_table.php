<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Photo of the model on the recommendation card. It is hotlinked from Wikimedia Commons, so the author,
        // license and file page are stored to credit it. The four columns are all set or all null.
        Schema::table('modelo_referencia', function (Blueprint $table) {
            $table->string('imagen_url', 500)->nullable();
            $table->string('imagen_autor')->nullable();
            $table->string('imagen_licencia', 50)->nullable();
            $table->string('imagen_pagina', 500)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('modelo_referencia', function (Blueprint $table) {
            $table->dropColumn(['imagen_url', 'imagen_autor', 'imagen_licencia', 'imagen_pagina']);
        });
    }
};
