<?php

namespace App\Console\Commands;

use App\Services\Subscription\SubscriptionLifecycle;
use Illuminate\Console\Command;

/**
 * Inactivates the subscriptions whose grace period is over and hides their vehicles (RF20, RF26), then
 * deletes the hidden vehicles whose 30-day retention ended (RF27).
 * Scheduled hourly; the access gate also evaluates the dates, so the block never waits for it.
 */
class ProcessSubscriptions extends Command
{
    protected $signature = 'suscripciones:procesar';

    protected $description = 'Inactivate subscriptions past their grace period, hide their vehicles and delete those past retention';

    public function handle(SubscriptionLifecycle $lifecycle): int
    {
        $this->info('Suscripciones inactivadas: '.$lifecycle->process());
        $this->info('Vehículos eliminados: '.$lifecycle->purgeExpiredVehicles());

        return self::SUCCESS;
    }
}
