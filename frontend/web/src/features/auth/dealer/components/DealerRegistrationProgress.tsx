import { DEALER_REGISTRATION_STEPS } from '../model/dealerRegistrationSteps'
import FormProgress from '../../../../components/FormProgress/FormProgress'

type Props = Readonly<{ step: number; instant?: boolean }>

export default function DealerRegistrationProgress({ step, instant = false }: Props) {
  return <FormProgress ariaLabel="Registro de concesionaria" labels={DEALER_REGISTRATION_STEPS.map(({ title }) => title)} step={step} instant={instant} />
}
