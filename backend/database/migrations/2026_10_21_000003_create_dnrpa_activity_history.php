<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dnrpa_refresh_state', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->timestampTz('attempted_at')->nullable();
            $table->timestampTz('checked_at')->nullable();
        });
        Schema::create('dnrpa_activity_history', function (Blueprint $table) {
            $table->char('month', 7)->primary();
            $table->json('payload');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dnrpa_activity_history');
        Schema::dropIfExists('dnrpa_refresh_state');
    }
};
