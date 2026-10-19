<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const EQUIPMENT = [
        'control_estabilidad',
        'frenos_abs',
        'airbags_frontales',
        'airbags_laterales',
        'airbags_cortina',
        'isofix',
        'frenado_autonomo',
        'asistencia_carril',
        'punto_ciego',
        'recordatorio_cinturon',
        'asistencia_velocidad',
        'monitoreo_conductor',
        'volante_regulable',
        'climatizador_bizona',
        'butacas_calefaccionadas',
        'android_auto_apple_carplay',
        'sensores_estacionamiento',
        'velocidad_crucero',
        'camara_retroceso',
        'aire_acondicionado',
    ];

    public function up(): void
    {
        Schema::table('vehiculo', function (Blueprint $table) {
            // No defaults: an unknown fact must not become an invented value.
            $table->smallInteger('plazas')->nullable();
            $table->boolean('turbo')->nullable();
            $table->string('potencia_unidad', 10)->nullable();
            $table->decimal('consumo_urbano', 6, 2)->nullable();
            $table->decimal('consumo_ruta', 6, 2)->nullable();

            foreach (self::EQUIPMENT as $field) {
                $table->boolean($field)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('vehiculo', function (Blueprint $table) {
            $table->dropColumn([
                'plazas', 'turbo', 'potencia_unidad', 'consumo_urbano', 'consumo_ruta',
                ...self::EQUIPMENT,
            ]);
        });
    }
};
