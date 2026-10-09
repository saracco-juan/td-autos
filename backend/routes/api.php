<?php

use App\Http\Controllers\DiagnosticoController;
use App\Http\Controllers\InspeccionController;
use App\Http\Controllers\ProfileController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::put('/user', [ProfileController::class, 'update']);

    Route::get('/diagnostico', [DiagnosticoController::class, 'show']);
    Route::put('/diagnostico', [DiagnosticoController::class, 'save']);

    Route::get('/vehiculos/{vehiculo}/inspeccion', [InspeccionController::class, 'show']);
    Route::put('/vehiculos/{vehiculo}/inspeccion/items/{codigo}', [InspeccionController::class, 'toggle']);
    Route::post('/vehiculos/{vehiculo}/inspeccion/finalizar', [InspeccionController::class, 'finish']);
});
