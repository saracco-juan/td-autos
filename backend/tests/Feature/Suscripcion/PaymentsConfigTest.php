<?php

namespace Tests\Feature\Suscripcion;

use App\Support\TransferData;
use Illuminate\Support\Env;
use Tests\TestCase;

class PaymentsConfigTest extends TestCase
{
    /**
     * @var array<string, string>
     */
    private const TRANSFER_ENV = [
        'holder' => 'TRANSFER_HOLDER',
        'cuit' => 'TRANSFER_CUIT',
        'bank' => 'TRANSFER_BANK',
        'cbu' => 'TRANSFER_CBU',
        'alias' => 'TRANSFER_ALIAS',
        'monthly_amount' => 'SUBSCRIPTION_MONTHLY_AMOUNT',
    ];

    /**
     * @return array<string, string>
     */
    private function fullTransfer(): array
    {
        return [
            'holder' => 'TD Autos SRL',
            'cuit' => '30-12345678-9',
            'bank' => 'Banco Nación',
            'cbu' => '0110000000000000000001',
            'alias' => 'tdautos.pagos',
            'monthly_amount' => '25000',
        ];
    }

    /**
     * Evaluates config/payments.php with the given environment variables set (null = unset).
     *
     * @param  array<string, ?string>  $env
     * @return array<string, mixed>
     */
    private function loadPayments(array $env): array
    {
        $repository = Env::getRepository();
        $previous = [];
        foreach ($env as $name => $value) {
            $previous[$name] = $repository->get($name);
            $value === null ? $repository->clear($name) : $repository->set($name, $value);
        }

        try {
            return require config_path('payments.php');
        } finally {
            foreach ($previous as $name => $value) {
                $value === null ? $repository->clear($name) : $repository->set($name, $value);
            }
        }
    }

    public function test_transfer_data_is_null_by_default(): void
    {
        $payments = $this->loadPayments(array_fill_keys(self::TRANSFER_ENV, null));

        foreach (array_keys(self::TRANSFER_ENV) as $key) {
            $this->assertNull($payments['transfer'][$key], $key);
        }
    }

    public function test_transfer_data_reads_each_environment_variable(): void
    {
        $env = [];
        foreach (self::TRANSFER_ENV as $key => $name) {
            $env[$name] = $this->fullTransfer()[$key];
        }

        $this->assertSame($this->fullTransfer(), $this->loadPayments($env)['transfer']);
    }

    public function test_admin_emails_default_to_an_empty_list(): void
    {
        $this->assertSame([], $this->loadPayments(['ADMIN_NOTIFICATION_EMAILS' => null])['admin_emails']);
    }

    public function test_admin_emails_are_parsed_from_the_environment(): void
    {
        $payments = $this->loadPayments(['ADMIN_NOTIFICATION_EMAILS' => ' a@x.com, b@x.com,,']);

        $this->assertSame(['a@x.com', 'b@x.com'], $payments['admin_emails']);
    }

    public function test_transfer_data_support_returns_all_values_when_complete(): void
    {
        config(['payments.transfer' => $this->fullTransfer()]);

        $this->assertSame($this->fullTransfer(), TransferData::fromConfig());
    }

    public function test_transfer_data_support_returns_null_when_any_value_is_missing(): void
    {
        foreach (array_keys(self::TRANSFER_ENV) as $missing) {
            foreach ([null, '', '  '] as $empty) {
                config(['payments.transfer' => [...$this->fullTransfer(), $missing => $empty]]);

                $this->assertNull(TransferData::fromConfig(), $missing.' = '.var_export($empty, true));
            }
        }
    }

    public function test_transfer_data_support_returns_null_when_nothing_is_configured(): void
    {
        config(['payments.transfer' => array_fill_keys(array_keys(self::TRANSFER_ENV), null)]);

        $this->assertNull(TransferData::fromConfig());
    }
}
