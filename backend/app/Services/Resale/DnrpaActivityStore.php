<?php

namespace App\Services\Resale;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/** Durable aggregate history; only refresh() may contact the external source. */
final class DnrpaActivityStore
{
    public function current(): array
    {
        $row = DB::table('dnrpa_refresh_state')->where('id', 1)->select('checked_at')
            ->selectSub(DB::table('dnrpa_activity_history')->select('payload')->orderByDesc('month')->limit(1), 'payload')->first();
        $checked = $row->checked_at ?? null;
        $snapshot = ($row->payload ?? null) === null ? null : json_decode($row->payload, true, 512, JSON_THROW_ON_ERROR);
        $stale = $snapshot !== null && ($checked === null || CarbonImmutable::parse($checked)->addDays(14)->lessThanOrEqualTo(now()));

        return ['snapshot' => $snapshot, 'checked_at' => $checked === null ? null : CarbonImmutable::parse($checked)->toISOString(),
            'stale' => $stale, 'warning' => $snapshot === null ? 'dnrpa_unavailable' : ($stale ? 'dnrpa_stale' : null)];
    }

    public function history(): array
    {
        return DB::table('dnrpa_activity_history')->orderBy('month')->pluck('payload', 'month')
            ->map(fn ($payload) => json_decode($payload, true, 512, JSON_THROW_ON_ERROR))->all();
    }

    public function refresh(): array
    {
        $now = now()->toImmutable();
        DB::table('dnrpa_refresh_state')->insertOrIgnore(['id' => 1]);
        // Atomic claim covers scheduled and manual callers, including failed attempts.
        $claimed = DB::table('dnrpa_refresh_state')->where('id', 1)
            ->where(fn ($query) => $query->whereNull('attempted_at')->orWhere('attempted_at', '<=', $now->subDays(14)))
            ->update(['attempted_at' => $now]);
        if (! $claimed) {
            return $this->current();
        }
        try {
            $previous = $this->current()['snapshot'];
            $catalog = app(AcaraPriceSource::class)->current()['snapshot'];
            if ($catalog === null) {
                throw new RuntimeException('Missing local ACARA catalog.');
            }
            // Network and parsing never hold a database transaction open.
            $snapshot = app(DnrpaActivitySource::class)->fetch($catalog, $now, $previous['activity']['window_end'] ?? null);
            DB::transaction(function () use ($snapshot, $now): void {
                $updated = DB::table('dnrpa_refresh_state')->where('id', 1)->where('attempted_at', $now)
                    ->update(['checked_at' => $now]);
                if ($updated !== 1) {
                    throw new RuntimeException('DNRPA attempt was superseded.');
                }
                if ($snapshot !== null) {
                    $snapshot['fetched_at'] = $now->toISOString();
                    DB::table('dnrpa_activity_history')->insert(['month' => $snapshot['activity']['window_end'],
                        'payload' => json_encode($snapshot, JSON_THROW_ON_ERROR)]);
                }
            });
        } catch (Throwable $error) {
            Log::warning('DNRPA refresh failed; previous history retained.', ['exception' => $error::class]);
        }

        return $this->current();
    }
}
