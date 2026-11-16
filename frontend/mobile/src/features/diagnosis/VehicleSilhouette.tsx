import Svg, { Circle, G, Path } from 'react-native-svg'

import { vehicleProfiles, type VehicleShape } from '@shared/diagnosis/vehicleSilhouettes'
import { colors } from '../../theme/tokens'

export default function VehicleSilhouette({ shape, color }: { shape: VehicleShape; color: string }) {
  const { body, windows, details, wheels } = vehicleProfiles[shape]
  const sport = shape === 'sport'
  return (
    <Svg aria-hidden width={sport ? 88 : 96} height={sport ? 35 : 40} viewBox="0 0 240 96"
      fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d={body} fill={sport ? color : 'none'} />
      <Path d={windows} fill={sport ? colors.charcoal : 'none'} strokeWidth={1.4} />
      {details ? <Path d={details} stroke={colors.charcoal} strokeWidth={1} /> : null}
      {wheels.map(x => (
        <G key={x} stroke={colors.charcoal}>
          <Circle cx={x} cy={69} r={14} fill={colors.charcoal} />
          <Circle cx={x} cy={69} r={8} fill={colors.surfaceRaised} />
        </G>
      ))}
    </Svg>
  )
}
