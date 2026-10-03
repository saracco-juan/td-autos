<?php

namespace Tests\Unit\Rules;

use App\Rules\StrongPassword;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class StrongPasswordTest extends TestCase
{
    /**
     * @return list<string>
     */
    private function errorsFor(string $password): array
    {
        $validator = Validator::make(
            ['password' => $password],
            ['password' => [new StrongPassword]],
        );

        return $validator->errors()->get('password');
    }

    public function test_seven_characters_fail_and_eight_pass(): void
    {
        $this->assertSame([StrongPassword::MESSAGE_MIN_LENGTH], $this->errorsFor('Abcdef1'));
        $this->assertSame([], $this->errorsFor('Abcdefg1'));
    }

    public function test_length_is_counted_in_code_points(): void
    {
        $this->assertSame([StrongPassword::MESSAGE_MIN_LENGTH], $this->errorsFor('Ñandú12'));
    }

    public function test_each_missing_composition_rule_fails_with_its_own_message(): void
    {
        $this->assertSame([StrongPassword::MESSAGE_UPPERCASE], $this->errorsFor('abcdefg1'));
        $this->assertSame([StrongPassword::MESSAGE_LOWERCASE], $this->errorsFor('ABCDEFG1'));
        $this->assertSame([StrongPassword::MESSAGE_NUMBER], $this->errorsFor('Abcdefgh'));
    }

    public function test_accented_letters_count_by_unicode_category(): void
    {
        $this->assertSame([], $this->errorsFor('Ñandú123'));
        $this->assertSame([StrongPassword::MESSAGE_LOWERCASE], $this->errorsFor('ÑANDÚ123'));
        $this->assertSame([StrongPassword::MESSAGE_UPPERCASE], $this->errorsFor('ñandú123'));
    }

    public function test_all_unmet_requirements_are_reported_together(): void
    {
        $this->assertSame([
            StrongPassword::MESSAGE_MIN_LENGTH,
            StrongPassword::MESSAGE_UPPERCASE,
            StrongPassword::MESSAGE_NUMBER,
        ], $this->errorsFor('abc'));
    }
}
