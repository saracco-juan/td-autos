<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // History of the monthly calculator refresh: readers use the latest row with status `valid`.
        Schema::create('calculator_refresh_snapshot', function (Blueprint $table) {
            $table->id();
            $table->timestampTz('fetched_at');
            // `valid` (at least one source answered) or `failed` (none did; payload is null).
            $table->string('status', 10);
            // Date of the newest fuel price row and last CPI month inside the payload, for quick inspection.
            $table->date('fuel_source_date')->nullable();
            $table->char('cpi_month', 7)->nullable();
            $table->json('payload')->nullable();
            $table->index(['status', 'fetched_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calculator_refresh_snapshot');
    }
};
