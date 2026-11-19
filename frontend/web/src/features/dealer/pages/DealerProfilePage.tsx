import { useEffect, useState } from 'react'
import ErrorState from '../../../components/ErrorState/ErrorState'
import SessionLoading from '../../auth/session/components/SessionLoading'
import { fetchDealerProfile } from '../api/profile'
import DealerProfileForm from '../components/DealerProfileForm'
import type { DealerProfile } from '../model/profile'

export default function DealerProfilePage() {
  const [profile, setProfile] = useState<DealerProfile>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    fetchDealerProfile().then(
      (data) => { if (active) setProfile(data) },
      () => { if (active) setFailed(true) },
    )
    return () => { active = false }
  }, [attempt])

  if (failed) return <ErrorState kind="server" onRetry={() => { setFailed(false); setAttempt(attempt + 1) }} />
  if (!profile) return <SessionLoading />
  return <DealerProfileForm profile={profile} />
}
