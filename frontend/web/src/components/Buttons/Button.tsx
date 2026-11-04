import type { ComponentProps } from 'react'
import { buttonClassName, type ButtonVariant } from './buttonClassName'

type Props = ComponentProps<'button'> & { variant?: ButtonVariant }

// Native props preserve submit behavior, disabled states, accessibility and refs.
export default function Button({ variant, className, ...props }: Props) {
  return <button {...props} className={buttonClassName(variant, className)} />
}
