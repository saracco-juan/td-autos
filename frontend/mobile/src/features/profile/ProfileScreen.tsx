import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import Alert from '../../components/Alert'
import Button from '../../components/Button'
import TextField from '../../components/TextField'
import { HttpError } from '../../lib/http'
import { colors, radii, shadows } from '../../theme/tokens'
import type { User } from '../auth/types'
import { useAuth } from '../auth/useAuth'
import type { ProfileFieldErrors, ProfileFieldName, ProfileValues } from './types'
import { validateProfileForm } from './validation'

const INCOMPLETE_NOTICE = 'Tu perfil está incompleto. Completá los datos obligatorios.'
const SUCCESS_MESSAGE = 'Los cambios se guardaron.'
const SAVE_ERROR = 'No se pudieron guardar los cambios. Intentá nuevamente.'
const LOGOUT_ERROR = 'No se pudo cerrar la sesión. Intentá nuevamente.'
const SERVER_FIELDS: ProfileFieldName[] = ['name', 'apellido']

type ValidationBody = { errors?: Partial<Record<string, string[]>> }

function fieldErrorsFromServer(body: ValidationBody | undefined): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {}
  for (const field of SERVER_FIELDS) {
    const messages = body?.errors?.[field]
    if (messages && messages.length > 0) errors[field] = messages
  }
  return errors
}

function valuesFrom(user: User | null): ProfileValues {
  return { name: user?.name ?? '', apellido: user?.apellido ?? '' }
}

export default function ProfileScreen() {
  const { user, updateProfile, logout } = useAuth()
  const [values, setValues] = useState(() => valuesFrom(user))
  const [loadedUser, setLoadedUser] = useState(user)
  const [errors, setErrors] = useState<ProfileFieldErrors>({})
  const [saveError, setSaveError] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState(false)

  // The form follows the session user: when it changes (e.g. after a save), reload the fields from it.
  if (user !== loadedUser) {
    setLoadedUser(user)
    setValues(valuesFrom(user))
  }

  const handleChange = (field: ProfileFieldName) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSaved(false)
  }

  const handleSave = async () => {
    const validationErrors = validateProfileForm(values)
    setErrors(validationErrors)
    setSaveError(false)
    setSaved(false)
    if (Object.keys(validationErrors).length > 0) return

    setSaving(true)
    try {
      await updateProfile({ name: values.name.trim(), apellido: values.apellido.trim() })
      setSaved(true)
    } catch (error) {
      const serverErrors =
        error instanceof HttpError && error.status === 422
          ? fieldErrorsFromServer(error.body as ValidationBody | undefined)
          : {}
      setErrors(serverErrors)
      if (Object.keys(serverErrors).length === 0) setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    setLogoutError(false)
    try {
      await logout()
    } catch {
      // The session is still alive on the server: stay here so the user can try again.
      setLoggingOut(false)
      setLogoutError(true)
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Perfil
        </Text>
        <Text style={styles.subtitle}>Datos personales</Text>
      </View>
      {user?.perfil_completo === false ? <Alert variant="warning">{INCOMPLETE_NOTICE}</Alert> : null}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>DATOS PERSONALES</Text>
        {saved ? <Alert variant="success">{SUCCESS_MESSAGE}</Alert> : null}
        {saveError ? <Alert variant="error">{SAVE_ERROR}</Alert> : null}
        <TextField
          label="Nombre"
          value={values.name}
          onChangeText={handleChange('name')}
          errors={errors.name}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
        />
        <TextField
          label="Apellido"
          value={values.apellido}
          onChangeText={handleChange('apellido')}
          errors={errors.apellido}
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
        />
        {/* Shown for reference only: the email is the login identity and is never sent. */}
        <TextField label="Email" value={user?.email ?? ''} onChangeText={() => undefined} readOnly />
        <Button
          label="GUARDAR CAMBIOS"
          busyLabel="GUARDANDO…"
          busy={saving}
          variant="primary"
          onPress={() => void handleSave()}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>PRIVACIDAD Y SESIÓN</Text>
        {logoutError ? <Alert variant="error">{LOGOUT_ERROR}</Alert> : null}
        <Button
          label="CERRAR SESIÓN"
          busyLabel="CERRANDO SESIÓN…"
          busy={loggingOut}
          onPress={() => void handleLogout()}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 24, gap: 20 },
  header: { gap: 4 },
  title: { color: colors.textPrimary, fontSize: 32, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14 },
  card: {
    gap: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
})
