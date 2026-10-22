<?php

namespace Tests\Unit\Support;

use App\Support\EmailList;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class EmailListTest extends TestCase
{
    /**
     * @return array<string, array{?string, list<string>}>
     */
    public static function rawLists(): array
    {
        return [
            'null' => [null, []],
            'empty' => ['', []],
            'blank' => ['  ,  ', []],
            'single' => ['a@x.com', ['a@x.com']],
            'several trimmed' => [' a@x.com , b@x.com', ['a@x.com', 'b@x.com']],
            'empty entries removed' => ['a@x.com,,b@x.com,', ['a@x.com', 'b@x.com']],
        ];
    }

    /**
     * @param  list<string>  $expected
     */
    #[DataProvider('rawLists')]
    public function test_parse(?string $raw, array $expected): void
    {
        $this->assertSame($expected, EmailList::parse($raw));
    }
}
