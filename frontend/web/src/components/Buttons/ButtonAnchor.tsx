import type { ComponentProps } from 'react'
import { buttonClassName, type ButtonVariant } from './buttonClassName'

export default function ButtonAnchor({ variant, className, ...props }: ComponentProps<'a'> & { variant?: ButtonVariant }) {
  return <a {...props} className={buttonClassName(variant, className)} />
}
