<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One initialization record, not a source-edition or update history.
        Schema::create('catalog_import', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->date('source_date');
            $table->char('sha256', 64);
            $table->string('snapshot_id', 100);
            $table->timestampTz('imported_at');
        });
        Schema::create('catalog_brands', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
        });
        Schema::create('catalog_models', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained('catalog_brands')->restrictOnDelete();
            $table->string('name');
            $table->unique(['brand_id', 'name']);
        });
        Schema::create('catalog_versions', function (Blueprint $table) {
            // Preserve existing inventory keys; this catalog is never rekeyed or refreshed.
            $table->string('id', 70)->primary();
            $table->foreignId('model_id')->index()->constrained('catalog_models')->restrictOnDelete();
            $table->text('name');
        });
        Schema::create('catalog_prices', function (Blueprint $table) {
            $table->id();
            $table->string('version_id', 70)->index();
            $table->foreign('version_id')->references('id')->on('catalog_versions')->restrictOnDelete();
            // Preserve conflicting source rows instead of overwriting version/year quotes.
            $table->unsignedInteger('source_row');
            $table->unsignedSmallInteger('source_page');
            $table->string('year', 4);
            $table->char('currency', 3);
            $table->decimal('amount', 18, 2)->nullable();
            $table->unique(['source_row', 'year']);
        });
        if (DB::getDriverName() === 'pgsql') {
            // Laravel owns these tables; no direct browser/Data API access is required.
            $clientRoles = DB::table('pg_roles')->whereIn('rolname', ['anon', 'authenticated'])->pluck('rolname');
            foreach (['catalog_import', 'catalog_brands', 'catalog_models', 'catalog_versions', 'catalog_prices'] as $table) {
                DB::statement('ALTER TABLE '.$table.' ENABLE ROW LEVEL SECURITY');
                foreach ($clientRoles as $role) {
                    DB::statement('REVOKE ALL ON TABLE '.$table.' FROM "'.$role.'"');
                }
            }
        }
    }

    public function down(): void
    {
        foreach (['catalog_prices', 'catalog_versions', 'catalog_models', 'catalog_brands', 'catalog_import'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
