import { PASSWORD_RULES, unmetPasswordRules } from '../../../features/auth/passwordRules'
import {
  validateEmail,
  validateLoginForm,
  validateNewPassword,
  validateRegisterForm,
} from '../../../features/auth/validation'

describe('validateEmail', () => {
  it('requires a value', () => {
    expect(validateEmail('   ')).toEqual(['El email es obligatorio.'])
  })

  it('rejects an address without a domain', () => {
    expect(validateEmail('ana@example')).toEqual(['Ingresá un email válido.'])
    expect(validateEmail('ana example@x.co')).toEqual(['Ingresá un email válido.'])
  })

  it('rejects a missing local part, a second @ or a dot at the edge of the domain', () => {
    for (const email of ['@example.com', 'ana@b@example.com', 'ana@.com', 'ana@example.']) {
      expect(validateEmail(email)).toEqual(['Ingresá un email válido.'])
    }
  })

  it('accepts subdomains and a trailing dot after a valid domain', () => {
    expect(validateEmail('ana@mail.example.com.ar')).toBeUndefined()
    expect(validateEmail('ana@a.b.')).toBeUndefined()
  })

  it('answers quickly on long input without a valid domain', () => {
    const started = Date.now()
    expect(validateEmail(`a@${'a'.repeat(50_000)}`)).toEqual(['Ingresá un email válido.'])
    expect(Date.now() - started).toBeLessThan(200)
  })

  it('accepts a plausible address, ignoring surrounding spaces', () => {
    expect(validateEmail(' ana@example.com ')).toBeUndefined()
  })
})

describe('password rules', () => {
  it('lists the four checklist labels in order', () => {
    expect(PASSWORD_RULES.map((rule) => rule.label)).toEqual([
      'Al menos 8 caracteres',
      'Una letra mayúscula',
      'Una letra minúscula',
      'Un número',
    ])
  })

  it('reports every unmet rule', () => {
    expect(unmetPasswordRules('')).toEqual(['min_length', 'uppercase', 'lowercase', 'number'])
    expect(unmetPasswordRules('abcdefgh')).toEqual(['uppercase', 'number'])
    expect(unmetPasswordRules('Abcdefg1')).toEqual([])
  })
})

describe('validateNewPassword', () => {
  it('TC-04: returns the message of each unmet rule', () => {
    expect(validateNewPassword('abc', 'abc').password).toEqual([
      'La contraseña debe tener al menos 8 caracteres.',
      'La contraseña debe incluir al menos una letra mayúscula.',
      'La contraseña debe incluir al menos un número.',
    ])
  })

  it('flags a confirmation that does not match', () => {
    expect(validateNewPassword('Abcdefg1', 'Abcdefg2')).toEqual({
      passwordConfirmation: ['Las contraseñas no coinciden.'],
    })
  })

  it('accepts a strong password that matches its confirmation', () => {
    expect(validateNewPassword('Abcdefg1', 'Abcdefg1')).toEqual({})
  })
})

describe('validateLoginForm', () => {
  it('requires email and password', () => {
    expect(validateLoginForm({ email: '', password: '' })).toEqual({
      email: ['El email es obligatorio.'],
      password: ['La contraseña es obligatoria.'],
    })
  })

  it('does not apply strength rules to an existing password', () => {
    expect(validateLoginForm({ email: 'ana@example.com', password: 'x' })).toEqual({})
  })
})

describe('validateRegisterForm', () => {
  const valid = { name: 'Ana Pérez', email: 'ana@example.com', password: 'Abcdefg1', passwordConfirmation: 'Abcdefg1' }

  it('accepts valid values', () => {
    expect(validateRegisterForm(valid)).toEqual({})
  })

  it('requires the name and checks email and password', () => {
    expect(validateRegisterForm({ ...valid, name: ' ', email: 'x', password: 'abc', passwordConfirmation: '' })).toEqual({
      name: ['El nombre es obligatorio.'],
      email: ['Ingresá un email válido.'],
      password: [
        'La contraseña debe tener al menos 8 caracteres.',
        'La contraseña debe incluir al menos una letra mayúscula.',
        'La contraseña debe incluir al menos un número.',
      ],
      passwordConfirmation: ['Las contraseñas no coinciden.'],
    })
  })
})
