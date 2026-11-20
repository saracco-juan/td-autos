import { fullName, profilePayload } from '@shared/profile/form'
import { useBuyerTabBarSpace } from '../../components/BuyerTabIndicator'
import { useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import PurchaseProgress from './PurchaseProgress'
import { archivo } from '../../theme/archivo'
import useReduceMotion from '../../lib/useReduceMotion'

import Alert from '../../components/Alert'
import Feedback from '../../components/Feedback'
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
const SERVER_FIELDS: ProfileFieldName[] = ['name']

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
  return { name: fullName(user), apellido: '' }
}

export default function ProfileScreen() {
  const router = useRouter()
  const reduceMotion = useReduceMotion()
  const [editing, setEditing] = useState(false)
  const closeEditor = () => { if (!saving) setEditing(false) }
  const barSpace = useBuyerTabBarSpace()
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
    const validationErrors = validateProfileForm(profilePayload(values.name, user))
    setErrors(validationErrors)
    setSaveError(false)
    setSaved(false)
    if (Object.keys(validationErrors).length > 0) return

    setSaving(true)
    try {
      await updateProfile(profilePayload(values.name, user))
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
    <View style={styles.screen}>
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: barSpace + 24 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Perfil
        </Text>
        <Text style={[styles.name, archivo(true)]}>{[user?.name, user?.apellido].filter(Boolean).join(' ') || 'Tu cuenta'}</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>
        <Text style={styles.subtitle}>Comprador · {user?.perfil_completo ? 'Perfil completo' : 'Datos por completar'}</Text>
        <Pressable accessibilityRole="button" onPress={() => { setValues(valuesFrom(user)); setErrors({}); setSaved(false); setSaveError(false); setEditing(true) }} style={styles.edit}>
          <Ionicons name="pencil-outline" size={15} color={colors.textPrimary} /><Text style={archivo(true)}>Editar datos</Text>
        </Pressable>
      </View>
      {user?.perfil_completo === false ? <Alert variant="warning">{INCOMPLETE_NOTICE}</Alert> : null}
      <PurchaseProgress />
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, archivo(true)]}>Seguí con tu búsqueda</Text>
        <Pressable accessibilityRole="link" onPress={() => router.navigate('/')} style={styles.route}>
          <View style={styles.routeText}><Text style={archivo(true)}>Tu diagnóstico</Text><Text style={styles.subtitle}>{user?.tiene_diagnostico ? 'Realizado · Revisar preferencias' : 'Contanos qué auto necesitás'}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.navigate('/favoritos')} style={styles.route}>
          <View style={styles.routeText}><Text style={archivo(true)}>Tus favoritos</Text><Text style={styles.subtitle}>Volvé a los autos que guardaste</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
      <Modal visible={editing} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={closeEditor}>
      <KeyboardAvoidingView accessibilityViewIsModal style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.dialog}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.card}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, archivo(true)]}>Datos personales</Text>
        <TextField
          label="Nombre completo"
          value={values.name}
          onChangeText={handleChange('name')}
          errors={errors.name}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
        />
        {/* Shown for reference only: the email is the login identity and is never sent. */}
        <TextField label="Email" value={user?.email ?? ''} onChangeText={() => undefined} readOnly />
        <Button
          label="GUARDAR CAMBIOS"
          busyLabel="GUARDANDO…"
          busy={saving}
          variant="solidPrimary"
          onPress={() => void handleSave()}
        />
        <Button label="CANCELAR" disabled={saving} onPress={closeEditor} />
      </ScrollView>
      </View>
      <Feedback message={saveError ? SAVE_ERROR : saved ? SUCCESS_MESSAGE : undefined} variant={saveError ? 'error' : 'success'} onRetry={saving ? undefined : handleSave} />
      </KeyboardAvoidingView>
      </Modal>
      <View>
        <Pressable accessibilityRole="button" accessibilityLabel="CERRAR SESIÓN" disabled={loggingOut}
          accessibilityState={{ busy: loggingOut, disabled: loggingOut }} onPress={() => void handleLogout()} style={styles.edit}>
          <Text style={{ color: colors.actionDanger }}>{loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</Text>
        </Pressable>
      </View>
    </ScrollView>
    <Feedback message={logoutError ? LOGOUT_ERROR : undefined} variant="error" bottom={barSpace} onRetry={loggingOut ? undefined : handleLogout} />
    </View>
  )
}

const styles = StyleSheet.create({
  name: { fontSize: 26, marginTop: 16, color: colors.textPrimary },
  sectionTitle: { fontSize: 21, color: colors.textPrimary },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, alignSelf: 'flex-start' },
  route: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.borderDefault },
  routeText: { flex: 1, gap: 5 },
  overlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#241f1c66' },
  dialog: { maxHeight: '90%', borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, paddingBottom: 24, gap: 24 },
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
