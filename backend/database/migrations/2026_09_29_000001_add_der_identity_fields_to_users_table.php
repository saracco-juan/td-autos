<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('auth_subject', 255)->nullable()->unique();
            $table->string('apellido', 100)->nullable();
            $table->string('telefono', 30)->nullable();
            $table->string('rol', 50)->default('comprador');
            $table->boolean('activo')->default(true);
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        // A downgrade must never delete Google-only users or invent passwords.
        if (Schema::getConnection()->table('users')->whereNull('password')->exists()) {
            throw new RuntimeException('Cannot restore required passwords while users with null passwords exist. Resolve those accounts before retrying this migration rollback.');
        }

        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable(false)->change();
            $table->dropUnique(['auth_subject']);
            $table->dropColumn(['auth_subject', 'apellido', 'telefono', 'rol', 'activo']);
        });
    }
};
