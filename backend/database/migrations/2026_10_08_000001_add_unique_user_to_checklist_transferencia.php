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

        // One checklist per user: the item marks hang from that single row.
        Schema::table('checklist_transferencia', function (Blueprint $table) {
            $table->unique('usuario_id');
        });
    }

    public function down(): void
    {
        Schema::table('checklist_transferencia', function (Blueprint $table) {
            $table->dropUnique(['usuario_id']);
        });
    }

    // Before the index existed every tick could insert a new checklist: fold each group of
    // duplicates into its oldest row so the index can be created over real data.
    private function mergeDuplicates(): void
    {
        $userIds = DB::table('checklist_transferencia')
            ->whereNotNull('usuario_id')
            ->groupBy('usuario_id')
            ->havingRaw('count(*) > 1')
            ->pluck('usuario_id');

        foreach ($userIds as $userId) {
            $checklists = DB::table('checklist_transferencia')->where('usuario_id', $userId)->orderBy('id')->get();
            $keptId = $checklists->first()->id;
            $ids = $checklists->pluck('id')->all();
            $latest = $checklists->sortBy([['actualizado_en', 'desc'], ['id', 'desc']])->first();

            // One mark per code, with the earliest timestamp.
            $earliest = [];
            foreach (DB::table('etapa_transferencia_completada')->whereIn('seguimiento_id', $ids)->get() as $etapa) {
                if (! isset($earliest[$etapa->etapa_codigo]) || $etapa->completada_en < $earliest[$etapa->etapa_codigo]) {
                    $earliest[$etapa->etapa_codigo] = $etapa->completada_en;
                }
            }

            DB::table('etapa_transferencia_completada')->whereIn('seguimiento_id', $ids)->delete();
            foreach ($earliest as $codigo => $completadaEn) {
                DB::table('etapa_transferencia_completada')->insert([
                    'seguimiento_id' => $keptId,
                    'etapa_codigo' => $codigo,
                    'completada_en' => $completadaEn,
                ]);
            }

            DB::table('checklist_transferencia')->where('id', $keptId)->update([
                'estado' => $latest->estado,
                'actualizado_en' => $latest->actualizado_en,
            ]);
            DB::table('checklist_transferencia')->whereIn('id', array_diff($ids, [$keptId]))->delete();
        }
    }
};
