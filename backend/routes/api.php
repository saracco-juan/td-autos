<?php

use App\Http\Controllers\Admin\ComprobanteController as AdminComprobanteController;
use App\Http\Controllers\Admin\ConcesionariaController as AdminConcesionariaController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\BusquedaController;
use App\Http\Controllers\ConcesionariaVehiculoController;
use App\Http\Controllers\ConcesionariaVehiculoImportController;
use App\Http\Controllers\DiagnosticoController;
use App\Http\Controllers\InspeccionController;
use App\Http\Controllers\Mobile\MobileAuthController;
use App\Http\Controllers\Mobile\MobileGoogleController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RecomendacionesController;
use App\Http\Controllers\SuscripcionController;
use App\Http\Controllers\TransferenciaController;
use App\Http\Controllers\VehiculoCostosController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Token API for the mobile app (stateless: bearer tokens, no session or CSRF).
Route::prefix('mobile')->name('mobile.')->group(function () {
    Route::post('/register', [MobileAuthController::class, 'register'])->name('register');
    Route::post('/login', [MobileAuthController::class, 'login'])->name('login');
    Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])->name('password.email');
    Route::post('/google/exchange', [MobileGoogleController::class, 'exchange'])->name('google.exchange');
    Route::post('/logout', [MobileAuthController::class, 'logout'])->middleware('auth:sanctum')->name('logout');
});

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::put('/user', [ProfileController::class, 'update']);

    Route::get('/busqueda', [BusquedaController::class, 'index']);

    Route::get('/diagnostico', [DiagnosticoController::class, 'show']);
    Route::put('/diagnostico', [DiagnosticoController::class, 'save']);

    Route::get('/recomendaciones', [RecomendacionesController::class, 'index']);

    Route::get('/vehiculos/{id}/costos', [VehiculoCostosController::class, 'show']);

    Route::get('/vehiculos/{vehiculo}/inspeccion', [InspeccionController::class, 'show']);
    Route::put('/vehiculos/{vehiculo}/inspeccion/items/{codigo}', [InspeccionController::class, 'toggle']);
    Route::post('/vehiculos/{vehiculo}/inspeccion/finalizar', [InspeccionController::class, 'finish']);

    Route::get('/transferencia', [TransferenciaController::class, 'show']);
    Route::put('/transferencia/items/{codigo}', [TransferenciaController::class, 'toggle']);
    Route::post('/transferencia/finalizar', [TransferenciaController::class, 'finish']);

    // Reachable by a pending dealer too: it is how the first payment is sent (RF16, RF17).
    Route::middleware('dealer')->prefix('concesionaria/suscripcion')->group(function () {
        Route::get('/', [SuscripcionController::class, 'show']);
        Route::post('/comprobantes', [SuscripcionController::class, 'storeComprobante']);
    });

    Route::middleware('dealer.active')->prefix('concesionaria/vehiculos')->group(function () {
        Route::post('/importar/vista-previa', [ConcesionariaVehiculoImportController::class, 'preview']);
        Route::post('/importar', [ConcesionariaVehiculoImportController::class, 'import']);
        Route::get('/', [ConcesionariaVehiculoController::class, 'index']);
        Route::post('/', [ConcesionariaVehiculoController::class, 'store']);
        Route::get('/{id}', [ConcesionariaVehiculoController::class, 'show'])->whereNumber('id');
        Route::post('/{id}', [ConcesionariaVehiculoController::class, 'update'])->whereNumber('id');
        Route::delete('/{id}', [ConcesionariaVehiculoController::class, 'destroy'])->whereNumber('id');
    });

    // Administration area (RF19, CU-17).
    Route::middleware('admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/concesionarias', [AdminConcesionariaController::class, 'index'])->name('concesionarias.index');
        Route::get('/concesionarias/{id}', [AdminConcesionariaController::class, 'show'])
            ->whereNumber('id')->name('concesionarias.show');
        Route::put('/concesionarias/{id}', [AdminConcesionariaController::class, 'update'])
            ->whereNumber('id')->name('concesionarias.update');
        Route::delete('/concesionarias/{id}', [AdminConcesionariaController::class, 'destroy'])
            ->whereNumber('id')->name('concesionarias.destroy');
        Route::get('/comprobantes/{comprobante}', [AdminComprobanteController::class, 'show'])
            ->whereNumber('comprobante')->name('comprobantes.show');
        Route::get('/comprobantes/{comprobante}/archivo', [AdminComprobanteController::class, 'file'])
            ->whereNumber('comprobante')->name('comprobantes.archivo');
        Route::post('/comprobantes/{comprobante}/aprobar', [AdminComprobanteController::class, 'approve'])
            ->whereNumber('comprobante')->name('comprobantes.aprobar');
        Route::post('/comprobantes/{comprobante}/rechazar', [AdminComprobanteController::class, 'reject'])
            ->whereNumber('comprobante')->name('comprobantes.rechazar');
    });
});
