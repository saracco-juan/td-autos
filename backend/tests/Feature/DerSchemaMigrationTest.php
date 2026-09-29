<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\PostgresConnection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DerSchemaMigrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Never use the application database, even when DB_URL points to Supabase.
        config([
            'database.default' => 'der_test',
            'database.connections.der_test' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => true,
            ],
        ]);
        DB::purge('der_test');
    }

    public function test_der_columns_nullability_and_constraints_match_the_diagram(): void
    {
        $this->artisan('migrate', ['--database' => 'der_test', '--force' => true])->assertSuccessful();

        foreach ($this->expectedSchema() as $table => $expected) {
            $this->assertSame($expected['columns'], Schema::getColumnListing($table), $table);
            $columns = collect(Schema::getColumns($table))->keyBy('name');
            foreach ($expected['columns'] as $name) {
                $this->assertSame(in_array($name, $expected['nullable'], true), $columns[$name]['nullable'], "$table.$name");
            }

            $indexes = collect(Schema::getIndexes($table));
            $this->assertSame($expected['primary'], $indexes->firstWhere('primary', true)['columns'], $table);
            $unique = $indexes->filter(fn ($index) => $index['unique'] && ! $index['primary'])->pluck('columns')->all();
            $this->assertEqualsCanonicalizing($expected['unique'], $unique, $table);

            $foreignKeys = Schema::getForeignKeys($table);
            $this->assertCount(count($expected['foreign']), $foreignKeys, $table);
            foreach ($foreignKeys as $foreign) {
                $column = $foreign['columns'][0];
                $this->assertSame($expected['foreign'][$column], $foreign['foreign_table'].'.'.$foreign['foreign_columns'][0], "$table.$column");
                $this->assertSame('no action', strtolower($foreign['on_delete']));
            }
        }

        $this->assertTrue(Schema::hasTable('users'));
        $this->assertTrue(Schema::hasColumn('users', 'auth_subject'));
        $this->assertFalse(Schema::hasTable('usuario'));
    }

    public function test_der_migrations_roll_back_without_removing_existing_laravel_tables(): void
    {
        $this->artisan('migrate', ['--database' => 'der_test', '--force' => true])->assertSuccessful();
        $this->artisan('migrate:rollback', [
            '--database' => 'der_test',
            '--step' => 18,
            '--force' => true,
        ])->assertSuccessful();

        foreach (array_keys($this->expectedSchema()) as $table) {
            $this->assertSame($table === 'users', Schema::hasTable($table), $table);
        }
        foreach (['users', 'password_reset_tokens', 'sessions', 'cache', 'jobs', 'personal_access_tokens'] as $table) {
            $this->assertTrue(Schema::hasTable($table), $table);
        }

        $this->artisan('migrate', ['--database' => 'der_test', '--force' => true])->assertSuccessful();
        foreach (array_keys($this->expectedSchema()) as $table) {
            $this->assertTrue(Schema::hasTable($table), $table);
        }
    }

    public function test_postgresql_types_compile_without_a_database_connection(): void
    {
        $connection = new PostgresConnection(function () {
            throw new \LogicException('This test must never open a database connection.');
        });
        $originalSchema = Schema::getFacadeRoot();
        Schema::swap($connection->getSchemaBuilder());

        $types = [
            'tipo_carroceria' => ['id' => 'serial not null', 'nombre' => 'varchar(100) not null'],
            'concesionaria' => ['id' => 'serial not null', 'usuario_id' => 'bigint null', 'nombre' => 'varchar(150) not null', 'responsable_dni' => 'varchar(20) null', 'telefono_publico' => 'varchar(30) null', 'telefono_responsable' => 'varchar(30) null', 'direccion' => 'varchar(255) null', 'localidad' => 'varchar(100) null', 'provincia' => 'varchar(100) null', 'estado_alta' => 'varchar(50) null', 'creada_en' => 'timestamp(0) without time zone not null'],
            'vehiculo' => ['id' => 'serial not null', 'origen' => 'varchar(50) not null', 'tipo_carroceria_id' => 'integer null', 'marca' => 'varchar(100) null', 'modelo' => 'varchar(100) null', 'version' => 'varchar(100) null', 'anio' => 'integer null', 'kilometraje' => 'integer null', 'precio' => 'decimal(12, 2) null', 'moneda' => 'varchar(10) null', 'combustible' => 'varchar(50) null', 'transmision' => 'varchar(50) null', 'motor' => 'varchar(100) null', 'potencia' => 'integer null', 'ubicacion' => 'varchar(150) null'],
            'diagnostico' => ['id' => 'serial not null', 'usuario_id' => 'bigint null', 'presupuesto_maximo' => 'decimal(12, 2) null', 'uso_principal' => 'varchar(100) null', 'pasajeros' => 'integer null', 'transmision_preferida' => 'varchar(50) null', 'prioridad_comprador' => 'varchar(50) null', 'estado' => 'varchar(50) null', 'estado_fuente_externa' => 'varchar(50) null', 'calculado_en' => 'timestamp(0) without time zone null', 'actualizado_en' => 'timestamp(0) without time zone null'],
            'diagnostico_carroceria' => ['diagnostico_id' => 'integer not null', 'tipo_carroceria_id' => 'integer not null'],
            'suscripcion' => ['id' => 'serial not null', 'concesionaria_id' => 'integer null', 'estado' => 'varchar(50) not null', 'vigente_desde' => 'date not null', 'vigente_hasta' => 'date null', 'gracia_hasta' => 'date null', 'inactiva_desde' => 'date null', 'retencion_hasta' => 'date null'],
            'checklist_inspeccion' => ['id' => 'serial not null', 'usuario_id' => 'bigint null', 'vehiculo_id' => 'integer null', 'estado' => 'varchar(50) not null', 'actualizado_en' => 'timestamp(0) without time zone not null'],
            'vehiculo_concesionaria' => ['vehiculo_id' => 'integer not null', 'concesionaria_id' => 'integer null', 'patente_normalizada' => 'varchar(50) null', 'visible' => 'boolean not null', 'ocultado_en' => 'timestamp(0) without time zone null', 'eliminar_desde' => 'timestamp(0) without time zone null'],
            'checklist_transferencia' => ['id' => 'serial not null', 'usuario_id' => 'bigint null', 'vehiculo_id' => 'integer null', 'estado' => 'varchar(50) not null', 'actualizado_en' => 'timestamp(0) without time zone not null'],
            'foto_vehiculo' => ['id' => 'serial not null', 'vehiculo_id' => 'integer null', 'ubicacion_archivo' => 'varchar(500) not null', 'orden' => 'integer not null'],
            'publicacion_externa' => ['vehiculo_id' => 'integer not null', 'marketplace' => 'varchar(100) not null', 'external_id' => 'varchar(255) null', 'url_original' => 'varchar(500) null'],
            'favorito' => ['usuario_id' => 'bigint not null', 'vehiculo_id' => 'integer not null', 'fecha_guardado' => 'timestamp(0) without time zone not null'],
            'comprobante_pago' => ['id' => 'serial not null', 'suscripcion_id' => 'integer null', 'revisado_por_admin_id' => 'bigint null', 'periodo_desde' => 'date not null', 'periodo_hasta' => 'date not null', 'archivo_url' => 'varchar(500) not null', 'estado' => 'varchar(50) not null', 'motivo_rechazo' => 'varchar(500) null', 'fecha_de_pago' => 'timestamp(0) without time zone null', 'fecha_revision' => 'timestamp(0) without time zone null'],
            'item_inspeccion_completado' => ['checklist_id' => 'integer not null', 'item_codigo' => 'varchar(100) not null', 'completado_en' => 'timestamp(0) without time zone not null'],
            'etapa_transferencia_completada' => ['seguimiento_id' => 'integer not null', 'etapa_codigo' => 'varchar(100) not null', 'completada_en' => 'timestamp(0) without time zone not null'],
            'recomendacion' => ['id' => 'serial not null', 'diagnostico_id' => 'integer null', 'vehiculo_id' => 'integer null', 'posicion' => 'integer not null', 'puntaje_total' => 'decimal(10, 4) not null', 'generada_en' => 'timestamp(0) without time zone not null'],
            'lead' => ['id' => 'serial not null', 'comprador_usuario_id' => 'bigint null', 'vehiculo_concesionaria_id' => 'integer null', 'generado_en' => 'timestamp(0) without time zone not null'],
        ];

        try {
            $identityMigration = require database_path('migrations/2026_09_29_000001_add_der_identity_fields_to_users_table.php');
            $queries = $connection->pretend(fn () => $identityMigration->up());
            $sql = implode("\n", array_column($queries, 'query'));
            foreach ([
                '"auth_subject" varchar(255) null',
                '"apellido" varchar(100) null',
                '"telefono" varchar(30) null',
                '"rol" varchar(50) not null default \'comprador\'',
                '"activo" boolean not null default \'1\'',
                'alter column "password" drop not null',
            ] as $definition) {
                $this->assertStringContainsString($definition, $sql);
            }
            foreach (glob(database_path('migrations/2026_09_29_*_create_*_table.php')) as $path) {
                $migration = require $path;
                $queries = $connection->pretend(fn () => $migration->up());
                $sql = implode("\n", array_column($queries, 'query'));
                preg_match('/_create_(.+)_table.php$/', $path, $matches);
                foreach ($types[$matches[1]] as $column => $definition) {
                    $this->assertStringContainsString('"'.$column.'" '.$definition, $sql);
                }
            }
        } finally {
            Schema::swap($originalSchema);
        }
    }

    public function test_google_ready_user_links_to_domain_entities_without_a_second_identity(): void
    {
        $this->artisan('migrate', ['--database' => 'der_test', '--force' => true])->assertSuccessful();

        $user = new User;
        $user->name = 'Google User';
        $user->email = 'google@example.test';
        $user->password = null;
        $user->auth_subject = 'google-stable-subject';
        $user->save();
        $user->refresh();

        $this->assertNull($user->password);
        $this->assertNull($user->apellido);
        $this->assertSame('comprador', $user->rol);
        $this->assertTrue($user->activo);
        $this->assertNotNull($user->created_at);
        $this->assertFalse(Schema::hasTable('usuario'));

        DB::table('diagnostico')->insert(['usuario_id' => $user->id]);
        $vehicleId = DB::table('vehiculo')->insertGetId(['origen' => 'concesionaria']);
        DB::table('favorito')->insert([
            'usuario_id' => $user->id,
            'vehiculo_id' => $vehicleId,
            'fecha_guardado' => now(),
        ]);
        $this->assertDatabaseHas('diagnostico', ['usuario_id' => $user->id], 'der_test');
        $this->assertDatabaseHas('favorito', ['usuario_id' => $user->id], 'der_test');

        foreach (['rol', 'activo', 'auth_subject'] as $attribute) {
            $this->assertFalse($user->isFillable($attribute));
        }
    }

    public function test_identity_downgrade_refuses_null_passwords_before_changing_users(): void
    {
        $this->artisan('migrate', ['--database' => 'der_test', '--force' => true])->assertSuccessful();
        DB::table('users')->insert([
            'name' => 'Google User',
            'email' => 'google@example.test',
            'password' => null,
            'auth_subject' => 'stable-google-subject',
        ]);
        $migration = require database_path('migrations/2026_09_29_000001_add_der_identity_fields_to_users_table.php');

        try {
            $migration->down();
            $this->fail('Downgrade must refuse users without passwords.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('users with null passwords', $exception->getMessage());
        }

        $this->assertTrue(Schema::hasColumn('users', 'auth_subject'));
        $this->assertDatabaseHas('users', [
            'email' => 'google@example.test',
            'password' => null,
            'auth_subject' => 'stable-google-subject',
        ], 'der_test');
        $this->assertTrue(collect(Schema::getColumns('users'))->firstWhere('name', 'password')['nullable']);
    }

    public function test_existing_users_survive_identity_upgrade_and_downgrade(): void
    {
        $this->artisan('migrate', [
            '--database' => 'der_test',
            '--path' => 'database/migrations/0001_01_01_000000_create_users_table.php',
            '--force' => true,
        ])->assertSuccessful();
        $userId = DB::table('users')->insertGetId([
            'name' => 'Existing User',
            'email' => 'existing@example.test',
            'password' => 'existing-hash',
        ]);
        $migration = require database_path('migrations/2026_09_29_000001_add_der_identity_fields_to_users_table.php');
        $migration->up();

        $this->assertDatabaseHas('users', [
            'id' => $userId,
            'name' => 'Existing User',
            'password' => 'existing-hash',
            'rol' => 'comprador',
            'activo' => true,
        ], 'der_test');

        $migration->down();
        $this->assertFalse(Schema::hasColumn('users', 'auth_subject'));
        $this->assertFalse(collect(Schema::getColumns('users'))->firstWhere('name', 'password')['nullable']);
        $this->assertDatabaseHas('users', [
            'id' => $userId,
            'name' => 'Existing User',
            'password' => 'existing-hash',
        ], 'der_test');
    }

    public function test_password_registration_keeps_the_existing_api_and_safe_defaults(): void
    {
        $this->artisan('migrate', ['--database' => 'der_test', '--force' => true])->assertSuccessful();
        $this->post('/register', [
            'name' => 'Registered User',
            'email' => 'registered@example.test',
            'password' => 'valid-password',
            'password_confirmation' => 'valid-password',
            'rol' => 'admin',
            'activo' => false,
            'auth_subject' => 'untrusted-subject',
        ])->assertNoContent();

        $user = User::where('email', 'registered@example.test')->firstOrFail();
        $this->assertSame('Registered User', $user->name);
        $this->assertSame('comprador', $user->rol);
        $this->assertTrue($user->activo);
        $this->assertNull($user->auth_subject);
        $this->assertTrue(Hash::check('valid-password', $user->password));
        $this->post('/logout')->assertNoContent();
        $this->post('/login', [
            'email' => 'registered@example.test',
            'password' => 'valid-password',
        ])->assertNoContent();
        $this->assertAuthenticatedAs($user);
    }

    private function expectedSchema(): array
    {
        return [
            'users' => [
                'columns' => ['id', 'name', 'email', 'email_verified_at', 'password', 'remember_token', 'created_at', 'updated_at', 'auth_subject', 'apellido', 'telefono', 'rol', 'activo'],
                'nullable' => ['email_verified_at', 'password', 'remember_token', 'created_at', 'updated_at', 'auth_subject', 'apellido', 'telefono'],
                'primary' => ['id'],
                'unique' => [['auth_subject'], ['email']],
                'foreign' => [],
            ],
            'tipo_carroceria' => [
                'columns' => ['id', 'nombre'],
                'nullable' => [],
                'primary' => ['id'],
                'unique' => [],
                'foreign' => [],
            ],
            'concesionaria' => [
                'columns' => ['id', 'usuario_id', 'nombre', 'responsable_dni', 'telefono_publico', 'telefono_responsable', 'direccion', 'localidad', 'provincia', 'estado_alta', 'creada_en'],
                'nullable' => ['usuario_id', 'responsable_dni', 'telefono_publico', 'telefono_responsable', 'direccion', 'localidad', 'provincia', 'estado_alta'],
                'primary' => ['id'],
                'unique' => [['usuario_id']],
                'foreign' => ['usuario_id' => 'users.id'],
            ],
            'vehiculo' => [
                'columns' => ['id', 'origen', 'tipo_carroceria_id', 'marca', 'modelo', 'version', 'anio', 'kilometraje', 'precio', 'moneda', 'combustible', 'transmision', 'motor', 'potencia', 'ubicacion'],
                'nullable' => ['tipo_carroceria_id', 'marca', 'modelo', 'version', 'anio', 'kilometraje', 'precio', 'moneda', 'combustible', 'transmision', 'motor', 'potencia', 'ubicacion'],
                'primary' => ['id'],
                'unique' => [],
                'foreign' => ['tipo_carroceria_id' => 'tipo_carroceria.id'],
            ],
            'diagnostico' => [
                'columns' => ['id', 'usuario_id', 'presupuesto_maximo', 'uso_principal', 'pasajeros', 'transmision_preferida', 'prioridad_comprador', 'estado', 'estado_fuente_externa', 'calculado_en', 'actualizado_en'],
                'nullable' => ['usuario_id', 'presupuesto_maximo', 'uso_principal', 'pasajeros', 'transmision_preferida', 'prioridad_comprador', 'estado', 'estado_fuente_externa', 'calculado_en', 'actualizado_en'],
                'primary' => ['id'],
                'unique' => [['usuario_id']],
                'foreign' => ['usuario_id' => 'users.id'],
            ],
            'diagnostico_carroceria' => [
                'columns' => ['diagnostico_id', 'tipo_carroceria_id'],
                'nullable' => [],
                'primary' => ['diagnostico_id', 'tipo_carroceria_id'],
                'unique' => [],
                'foreign' => ['diagnostico_id' => 'diagnostico.id', 'tipo_carroceria_id' => 'tipo_carroceria.id'],
            ],
            'suscripcion' => [
                'columns' => ['id', 'concesionaria_id', 'estado', 'vigente_desde', 'vigente_hasta', 'gracia_hasta', 'inactiva_desde', 'retencion_hasta'],
                'nullable' => ['concesionaria_id', 'vigente_hasta', 'gracia_hasta', 'inactiva_desde', 'retencion_hasta'],
                'primary' => ['id'],
                'unique' => [['concesionaria_id']],
                'foreign' => ['concesionaria_id' => 'concesionaria.id'],
            ],
            'checklist_inspeccion' => [
                'columns' => ['id', 'usuario_id', 'vehiculo_id', 'estado', 'actualizado_en'],
                'nullable' => ['usuario_id', 'vehiculo_id'],
                'primary' => ['id'],
                'unique' => [],
                'foreign' => ['usuario_id' => 'users.id', 'vehiculo_id' => 'vehiculo.id'],
            ],
            'vehiculo_concesionaria' => [
                'columns' => ['vehiculo_id', 'concesionaria_id', 'patente_normalizada', 'visible', 'ocultado_en', 'eliminar_desde'],
                'nullable' => ['concesionaria_id', 'patente_normalizada', 'ocultado_en', 'eliminar_desde'],
                'primary' => ['vehiculo_id'],
                'unique' => [['patente_normalizada']],
                'foreign' => ['vehiculo_id' => 'vehiculo.id', 'concesionaria_id' => 'concesionaria.id'],
            ],
            'checklist_transferencia' => [
                'columns' => ['id', 'usuario_id', 'vehiculo_id', 'estado', 'actualizado_en'],
                'nullable' => ['usuario_id', 'vehiculo_id'],
                'primary' => ['id'],
                'unique' => [],
                'foreign' => ['usuario_id' => 'users.id', 'vehiculo_id' => 'vehiculo.id'],
            ],
            'foto_vehiculo' => [
                'columns' => ['id', 'vehiculo_id', 'ubicacion_archivo', 'orden'],
                'nullable' => ['vehiculo_id'],
                'primary' => ['id'],
                'unique' => [],
                'foreign' => ['vehiculo_id' => 'vehiculo.id'],
            ],
            'publicacion_externa' => [
                'columns' => ['vehiculo_id', 'marketplace', 'external_id', 'url_original'],
                'nullable' => ['external_id', 'url_original'],
                'primary' => ['vehiculo_id'],
                'unique' => [['external_id']],
                'foreign' => ['vehiculo_id' => 'vehiculo.id'],
            ],
            'favorito' => [
                'columns' => ['usuario_id', 'vehiculo_id', 'fecha_guardado'],
                'nullable' => [],
                'primary' => ['usuario_id', 'vehiculo_id'],
                'unique' => [],
                'foreign' => ['usuario_id' => 'users.id', 'vehiculo_id' => 'vehiculo.id'],
            ],
            'comprobante_pago' => [
                'columns' => ['id', 'suscripcion_id', 'revisado_por_admin_id', 'periodo_desde', 'periodo_hasta', 'archivo_url', 'estado', 'motivo_rechazo', 'fecha_de_pago', 'fecha_revision'],
                'nullable' => ['suscripcion_id', 'revisado_por_admin_id', 'motivo_rechazo', 'fecha_de_pago', 'fecha_revision'],
                'primary' => ['id'],
                'unique' => [],
                'foreign' => ['suscripcion_id' => 'suscripcion.id', 'revisado_por_admin_id' => 'users.id'],
            ],
            'item_inspeccion_completado' => [
                'columns' => ['checklist_id', 'item_codigo', 'completado_en'],
                'nullable' => [],
                'primary' => ['checklist_id', 'item_codigo'],
                'unique' => [],
                'foreign' => ['checklist_id' => 'checklist_inspeccion.id'],
            ],
            'etapa_transferencia_completada' => [
                'columns' => ['seguimiento_id', 'etapa_codigo', 'completada_en'],
                'nullable' => [],
                'primary' => ['seguimiento_id', 'etapa_codigo'],
                'unique' => [],
                'foreign' => ['seguimiento_id' => 'checklist_transferencia.id'],
            ],
            'recomendacion' => [
                'columns' => ['id', 'diagnostico_id', 'vehiculo_id', 'posicion', 'puntaje_total', 'generada_en'],
                'nullable' => ['diagnostico_id', 'vehiculo_id'],
                'primary' => ['id'],
                'unique' => [],
                'foreign' => ['diagnostico_id' => 'diagnostico.id', 'vehiculo_id' => 'vehiculo.id'],
            ],
            'lead' => [
                'columns' => ['id', 'comprador_usuario_id', 'vehiculo_concesionaria_id', 'generado_en'],
                'nullable' => ['comprador_usuario_id', 'vehiculo_concesionaria_id'],
                'primary' => ['id'],
                'unique' => [],
                'foreign' => ['comprador_usuario_id' => 'users.id', 'vehiculo_concesionaria_id' => 'vehiculo_concesionaria.vehiculo_id'],
            ],
        ];
    }
}
