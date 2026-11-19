import type { MouseEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import ButtonLink from '../../../../components/Buttons/ButtonLink'

type Props = {
  to: '/login' | '/registro'
  children: ReactNode
  className?: string
  button?: boolean
}

// Both access-switch affordances share keyboard focus and motion intent.
export default function AuthSwitchLink({ to, children, className, button = false }: Props) {
  const navigate = useNavigate()
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.detail === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      navigate(to, { state: { authMotion: 'reduced', authFocus: 'title' } })
    }
  }

  return button
    ? <ButtonLink to={to} onClick={handleClick} className={className} variant="secondary">{children}</ButtonLink>
    : <Link to={to} onClick={handleClick} className={className}>{children}</Link>
}
