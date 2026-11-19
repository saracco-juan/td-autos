import { Link, type LinkProps } from 'react-router'
import { buttonClassName, type ButtonVariant } from './buttonClassName'

export default function ButtonLink({ variant, className, ...props }: LinkProps & { variant?: ButtonVariant }) {
  return <Link {...props} className={buttonClassName(variant, className)} />
}
