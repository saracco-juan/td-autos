import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import Alert from '../../components/Alert'
import AuthScreen from '../../components/AuthScreen'
import Button from '../../components/Button'
import PasswordField from '../../components/PasswordField'
import TextField from '../../components/TextField'
import TextLink, { LinkPrompt } from '../../components/TextLink'
import { HttpError } from '../../lib/http'
import GoogleButton from './GoogleButton'
import PasswordRequirements from './PasswordRequirements'
import type { FieldErrors } from './types'
import { useAuth } from './useAuth'
import { useGoogleSignIn } from './useGoogleSignIn'
import { validateRegisterForm, type RegisterFormValues } from './validation'

const GENERIC_ERROR = 'No se pudo completar el registro. Intentá nuevamente.'
const SERVER_FIELDS = ['name', 'email', 'password'] as const

type ValidationBody = { errors?: Partial<Record<string, string[]>> }

function fieldErrorsFromServer(body: ValidationBody | undefined): FieldErrors {
  const errors: FieldErrors = {}
  for (const field of SERVER_FIELDS) {
    const messages = body?.errors?.[field]
    if (messages && messages.length > 0) errors[field] = messages
  }
  return errors
}

const EMPTY: RegisterFormValues = { name: '', email: '', password: '', passwordConfirmation: '' }

export default function RegisterScreen() {
  const { register } = useAuth()
  const google = useGoogleSignIn('registro')
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  const change = (field: keyof RegisterFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async () => {
    const validationErrors = validateRegisterForm(values)
    setErrors(validationErrors)
    setFormError(undefined)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    try {
      await register({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        passwordConfirmation: values.passwordConfirmation,
      })
    } catch (error) {
      const serverErrors =
        error instanceof HttpError && error.status === 422 ? fieldErrorsFromServer(error.body as ValidationBody) : {}
      setErrors(serverErrors)
      if (Object.keys(serverErrors).length === 0) setFormError(GENERIC_ERROR)
      setSubmitting(false)
    }
  }

  const alertMessage = formError ?? google.error

  return (
    <AuthScreen title="Registrá tu cuenta" subtitle="Por favor, introducí tus datos para registrarte.">
      {alertMessage ? <Alert variant="error">{alertMessage}</Alert> : null}
      <View style={styles.form}>
        <View style={styles.fields}>
          <TextField
            label="Nombre completo"
            value={values.name}
            onChangeText={change('name')}
            errors={errors.name}
            autoComplete="name"
            textContentType="name"
          />
          <TextField
            label="Email"
            value={values.email}
            onChangeText={change('email')}
            errors={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <PasswordField
            label="Contraseña"
            value={values.password}
            onChangeText={change('password')}
            errors={errors.password}
            autoComplete="new-password"
            textContentType="newPassword"
            hint={<PasswordRequirements password={values.password} />}
          />
          <PasswordField
            label="Confirmar contraseña"
            value={values.passwordConfirmation}
            onChangeText={change('passwordConfirmation')}
            errors={errors.passwordConfirmation}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
        </View>
        <Button
          label="CREAR CUENTA"
          busyLabel="CREANDO CUENTA…"
          busy={submitting}
          variant="primary"
          onPress={() => void submit()}
        />
      </View>
      <GoogleButton busy={google.busy} onPress={() => void google.start()} />
      <View style={styles.links}>
        <LinkPrompt prompt="¿Ya tenés cuenta?">
          <TextLink href="/login">Iniciar sesión</TextLink>
        </LinkPrompt>
      </View>
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  form: { gap: 24 },
  fields: { gap: 16 },
  links: { alignItems: 'center' },
})
