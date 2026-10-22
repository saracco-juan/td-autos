<?php

use App\Http\Controllers\Internal\SubscriptionCronController;
use Illuminate\Support\Facades\Route;

/*
| Machine-to-machine endpoints, loaded without the web (session, CSRF) or api groups.
| Each one authenticates with the CRON_SECRET bearer token.
*/

Route::post('/cron/subscriptions', SubscriptionCronController::class)
    ->middleware('throttle:10,1')
    ->name('internal.cron.subscriptions');
