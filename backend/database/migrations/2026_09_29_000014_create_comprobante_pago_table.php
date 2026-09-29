<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comprobante_pago', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('suscripcion_id')->nullable();
            $table->unsignedBigInteger('revisado_por_admin_id')->nullable();
            $table->date('periodo_desde');
            $table->date('periodo_hasta');
            $table->string('archivo_url', 500);
            $table->string('estado', 50);
            $table->string('motivo_rechazo', 500)->nullable();
            $table->timestamp('fecha_de_pago')->nullable();
            $table->timestamp('fecha_revision')->nullable();
            $table->foreign('suscripcion_id')->references('id')->on('suscripcion');
            $table->foreign('revisado_por_admin_id')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comprobante_pago');
    }
};
