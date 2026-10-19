import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import AuthScreen from '../../components/AuthScreen'
import Button from '../../components/Button'
import TextField from '../../components/TextField'
import { HttpError } from '../../lib/http'
import { colors } from '../../theme/tokens'
import { requestPasswordReset } from './api'
import type { FieldErrors } from './types'
import { validateEmail } from './validation'

const HELPER = 'Si existe una cuenta asociada, recibirás instrucciones por email.'
const GENERIC_ERROR = 'No se pudo enviar la solicitud. Intentá nuevamente.'

type ValidationBody = { errors?: { email?: string[] } }

export default function RecoveryScreen() {
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [confirmation, setConfirmation] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    const emailErrors = validateEmail(email)
    setErrors(emailErrors ? { email: emailErrors } : {})
    setFormError(undefined)
    setConfirmation(undefined)
    if (emailErrors) return

    setSubmitting(true)
    try {
      setConfirmation(await requestPasswordReset(email.trim()))
    } catch (error) {
      const serverMessages = error instanceof HttpError && error.status === 422 ? (error.body as ValidationBody | undefined)?.errors?.email : undefined
      if (serverMessages?.length) setErrors({ email: serverMessages })
      else setFormError(GENERIC_ERROR)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthScreen title="Recuperá tu contraseña">
      {confirmation ? <Alert variant="success">{confirmation}</Alert> : null}
      {formError ? <Alert variant="error">{formError}</Alert> : null}
      <View style={styles.form}>
        <TextField
          label="Email"
          value={email}
          onChangeText={(value) => {
            setEmail(value)
            setErrors({})
          }}
          errors={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={() => void submit()}
        />
        <Button
          label="SOLICITAR RECUPERACIÓN"
          busyLabel="SOLICITANDO…"
          busy={submitting}
          variant="primary"
          onPress={() => void submit()}
        />
      </View>
      {confirmation ? null : <Text style={styles.helper}>{HELPER}</Text>}
      <Button label="VOLVER AL ACCESO" onPress={() => router.replace('/login')} />
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  form: { gap: 24 },
  helper: { color: colors.textSecondary, fontSize: 12, textAlign: 'center' },
})
