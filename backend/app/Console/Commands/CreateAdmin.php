<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Rules\StrongPassword;
use App\Support\Email;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/**
 * Creates an administrator account. There is no public sign-up for administrators.
 */
class CreateAdmin extends Command
{
    protected $signature = 'admin:create
        {--name= : Nombre del administrador}
        {--email= : Email con el que va a ingresar}
        {--password= : Contraseña (si se omite, se pide sin mostrarla)}';

    protected $description = 'Create an administrator account';

    public function handle(): int
    {
        $name = trim((string) ($this->option('name') ?? $this->ask('Nombre')));
        $email = Email::normalize((string) ($this->option('email') ?? $this->ask('Email')));
        $password = (string) ($this->option('password') ?? $this->secret('Contraseña'));

        $validator = Validator::make(compact('name', 'email', 'password'), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', new StrongPassword],
        ], [
            'name.required' => 'El nombre es obligatorio.',
            'name.max' => 'El nombre no puede superar los 255 caracteres.',
            'email.required' => 'El email es obligatorio.',
            'email.email' => 'El email no tiene un formato válido.',
            'email.max' => 'El email no puede superar los 255 caracteres.',
            'email.unique' => 'El email ya está en uso.',
            'password.required' => 'La contraseña es obligatoria.',
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        $admin = new User(['name' => $name, 'email' => $email, 'password' => $password]);
        // Created by whoever runs the console, so the email needs no verification link.
        $admin->forceFill(['rol' => User::ROL_ADMINISTRADOR, 'email_verified_at' => now()])->save();

        $this->info("Administrador creado: {$admin->email}");

        return self::SUCCESS;
    }
}
