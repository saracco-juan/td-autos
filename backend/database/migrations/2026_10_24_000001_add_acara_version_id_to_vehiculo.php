<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehiculo', function (Blueprint $table) {
            // External label-hash reference, not a local foreign key; legacy rows stay unlinked.
            $table->string('acara_version_id', 70)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('vehiculo', fn (Blueprint $table) => $table->dropColumn('acara_version_id'));
    }
};
