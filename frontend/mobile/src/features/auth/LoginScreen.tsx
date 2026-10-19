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
import type { FieldErrors } from './types'
import { useAuth } from './useAuth'
import { useGoogleSignIn } from './useGoogleSignIn'
import { validateLoginForm, type LoginFormValues } from './validation'

const GENERIC_ERROR = 'No se pudo iniciar sesión. Intentá nuevamente.'

type RefusalBody = { message?: string; errors?: { email?: string[] } }

// Credential failures arrive under `email` but are never tied to a field: they do not reveal which one is wrong.
// A 403 (account that is not a buyer) carries its own message.
function formErrorFrom(error: unknown): string {
  if (!(error instanceof HttpError)) return GENERIC_ERROR
  const body = error.body as RefusalBody | undefined
  if (error.status === 422) return body?.errors?.email?.[0] ?? GENERIC_ERROR
  if (error.status === 403) return body?.message ?? GENERIC_ERROR
  return GENERIC_ERROR
}

export default function LoginScreen() {
  const { login } = useAuth()
  const google = useGoogleSignIn('login')
  const [values, setValues] = useState<LoginFormValues>({ email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  const change = (field: keyof LoginFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async () => {
    const validationErrors = validateLoginForm(values)
    setErrors(validationErrors)
    setFormError(undefined)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    try {
      await login({ email: values.email.trim(), password: values.password })
    } catch (error) {
      setFormError(formErrorFrom(error))
      setSubmitting(false)
    }
  }

  const alertMessage = formError ?? google.error

  return (
    <AuthScreen title="Ingresá a tu cuenta" subtitle="Accedé para guardar tus favoritos.">
      {alertMessage ? <Alert variant="error">{alertMessage}</Alert> : null}
      <View style={styles.form}>
        <View style={styles.fields}>
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
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
        </View>
        <Button label="INGRESAR" busyLabel="INGRESANDO…" busy={submitting} variant="primary" onPress={() => void submit()} />
      </View>
      <GoogleButton busy={google.busy} onPress={() => void google.start()} />
      <View style={styles.links}>
        <LinkPrompt prompt="¿No tenés cuenta?">
          <TextLink href="/registro">Crear cuenta</TextLink>
        </LinkPrompt>
        <TextLink href="/recuperar" subtle>
          ¿Olvidaste tu contraseña?
        </TextLink>
      </View>
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  form: { gap: 24 },
  fields: { gap: 16 },
  links: { alignItems: 'center', gap: 22 },
})
