<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(fn () => $this->mergeDuplicates());

        // One checklist per user and vehicle: the item marks hang from that single row.
        Schema::table('checklist_inspeccion', function (Blueprint $table) {
            $table->unique(['usuario_id', 'vehiculo_id']);
        });
    }

    public function down(): void
    {
        Schema::table('checklist_inspeccion', function (Blueprint $table) {
            $table->dropUnique(['usuario_id', 'vehiculo_id']);
        });
    }

    // Before the index existed every tick could insert a new checklist: fold each group of
    // duplicates into its oldest row so the index can be created over real data.
    private function mergeDuplicates(): void
    {
        $groups = DB::table('checklist_inspeccion')
            ->select('usuario_id', 'vehiculo_id')
            ->whereNotNull('usuario_id')
            ->whereNotNull('vehiculo_id')
            ->groupBy('usuario_id', 'vehiculo_id')
            ->havingRaw('count(*) > 1')
            ->get();

        foreach ($groups as $group) {
            $checklists = DB::table('checklist_inspeccion')
                ->where('usuario_id', $group->usuario_id)
                ->where('vehiculo_id', $group->vehiculo_id)
                ->orderBy('id')
                ->get();
            $keptId = $checklists->first()->id;
            $ids = $checklists->pluck('id')->all();
            $latest = $checklists->sortBy([['actualizado_en', 'desc'], ['id', 'desc']])->first();

            // One mark per code, with the earliest timestamp.
            $earliest = [];
            foreach (DB::table('item_inspeccion_completado')->whereIn('checklist_id', $ids)->get() as $item) {
                if (! isset($earliest[$item->item_codigo]) || $item->completado_en < $earliest[$item->item_codigo]) {
                    $earliest[$item->item_codigo] = $item->completado_en;
                }
            }

            DB::table('item_inspeccion_completado')->whereIn('checklist_id', $ids)->delete();
            foreach ($earliest as $codigo => $completadoEn) {
                DB::table('item_inspeccion_completado')->insert([
                    'checklist_id' => $keptId,
                    'item_codigo' => $codigo,
                    'completado_en' => $completadoEn,
                ]);
            }

            DB::table('checklist_inspeccion')->where('id', $keptId)->update([
                'estado' => $latest->estado,
                'actualizado_en' => $latest->actualizado_en,
            ]);
            DB::table('checklist_inspeccion')->whereIn('id', array_diff($ids, [$keptId]))->delete();
        }
    }
};
