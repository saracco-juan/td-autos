<?php

use App\Http\Controllers\Internal\CalculatorCronController;
use App\Http\Controllers\Internal\CalculatorReviewCronController;
use App\Http\Controllers\Internal\DnrpaCronController;
use App\Http\Controllers\Internal\SubscriptionCronController;
use Illuminate\Support\Facades\Route;

/*
| Machine-to-machine endpoints, loaded without the web (session, CSRF) or api groups.
| Each one authenticates with the CRON_SECRET bearer token.
*/

Route::post('/cron/subscriptions', SubscriptionCronController::class)
    ->middleware('throttle:10,1')
    ->name('internal.cron.subscriptions');

Route::post('/cron/calculadora', CalculatorCronController::class)
    ->middleware('throttle:10,1')
    ->name('internal.cron.calculadora');

Route::post('/cron/calculadora-revision', CalculatorReviewCronController::class)
    ->middleware('throttle:10,1')
    ->name('internal.cron.calculadora-revision');

Route::post('/cron/dnrpa', DnrpaCronController::class)
    ->middleware('throttle:10,1')
    ->name('internal.cron.dnrpa');
