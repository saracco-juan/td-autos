<?php

use App\Http\Middleware\EnsureDealerIsActive;
use App\Http\Middleware\EnsureEmailIsVerified;
use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\EnsureUserIsDealer;
use App\Http\Middleware\RedirectIfAuthenticated;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->api(prepend: [
            EnsureFrontendRequestsAreStateful::class,
        ]);

        $middleware->alias([
            'verified' => EnsureEmailIsVerified::class,
            'guest' => RedirectIfAuthenticated::class,
            'dealer' => EnsureUserIsDealer::class,
            'dealer.active' => EnsureDealerIsActive::class,
            'admin' => EnsureUserIsAdmin::class,
        ]);

        // Check the role before resolving route models, so a non-admin never learns which ids exist.
        $middleware->prependToPriorityList(SubstituteBindings::class, EnsureUserIsAdmin::class);

        //
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
