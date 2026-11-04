import styles from './VehicleSilhouette.module.css'

export type VehicleShape = 'sport' | 'sedan' | 'hatchback' | 'suv' | 'pickup' | 'van' | 'wagon'

// Side profiles share a baseline and wheel treatment; roof and overhangs identify each body.
const profiles: Record<VehicleShape, { body: string; windows: string; details: string; wheels: [number, number] }> = {
  sport: {
    body: 'M12 61 16 46Q19 40 34 38L63 34Q78 24 96 23L111 24Q129 27 147 40L184 45Q211 49 224 58L223 67 210 71H198C196 46 162 46 160 72H76C74 46 40 46 38 72L17 70Z',
    windows: 'M71 35Q85 26 99 27L110 28Q123 30 136 40L82 39Z',
    details: 'M143 44 121 62 81 67M78 42 75 58M88 43l-2 3h10M19 47h15M144 43l10 1M80 72h78',
    wheels: [57, 179],
  },
  sedan: {
    body: 'M14 62 17 48 48 43 77 24Q83 21 93 21H128Q137 21 145 28L166 43 210 48 224 58 224 70 209 74H199C197 49 164 49 162 74H73C71 49 38 49 36 74L17 71Z',
    windows: 'M60 43 81 28H105V43ZM112 28H128Q132 28 138 33L151 43H112Z',
    details: 'M107 48v21M77 49h10M127 49h10M20 54h13M207 54h11M77 73h81',
    wheels: [55, 181],
  },
  hatchback: {
    body: 'M27 65 29 45 42 20Q44 17 50 17H119Q130 17 138 27L154 43 196 48 212 58V71L199 74H186C184 49 153 49 151 74H73C71 49 40 49 38 74L29 71Z',
    windows: 'M39 42 47 24H82V42ZM89 24H119Q124 24 130 31L140 42H89Z',
    details: 'M87 47v23M99 48h10M49 48h10M30 48v12M194 54h11M77 73h70',
    wheels: [56, 169],
  },
  suv: {
    body: 'M15 64 18 25Q18 18 27 18H129Q140 18 149 30L164 43 207 46 223 57V72L210 76H198C195 47 160 47 157 76H76C73 47 38 47 35 76L17 73Z',
    windows: 'M26 26H61V42H24ZM68 26H105V42H68ZM112 26H129Q135 26 141 34L149 42H112Z',
    details: 'M23 14h108M108 47v22M70 47v22M82 48h10M125 48h10M81 76h72M205 53h12',
    wheels: [56, 178],
  },
  pickup: {
    body: 'M13 62V40H89V24Q89 19 96 19H132Q139 19 145 27L159 43 204 46 225 57V72L212 76H199C196 47 161 47 158 76H77C74 47 39 47 36 76L14 73Z',
    windows: 'M97 26H113V43H97ZM120 26H132Q135 26 139 32L148 43H120Z',
    details: 'M89 44v27M117 48v23M101 49h8M130 49h8M18 46h63M17 39h66M81 76h72M205 53h12',
    wheels: [57, 179],
  },
  van: {
    body: 'M16 67V20Q16 13 25 13H151Q159 13 164 22L180 47 212 52 224 61V73L210 76H199C197 51 164 51 162 76H74C72 51 39 51 37 76L17 73Z',
    windows: 'M133 22H150Q153 22 157 29L167 47H133Z',
    details: 'M122 21v49M127 53h9M30 25h78v28H30ZM83 24v28M17 59h9M210 58h8M79 76h77',
    wheels: [56, 181],
  },
  wagon: {
    body: 'M13 64 18 27Q19 22 28 22H130Q138 22 146 31L160 44 208 49 224 59V71L210 74H199C197 49 164 49 162 74H74C72 49 39 49 37 74L15 71Z',
    windows: 'M26 29H65V43H23ZM72 29H108V43H72ZM115 29H130Q135 29 140 35L148 43H115Z',
    details: 'M26 18h105M111 48v22M69 48v22M82 49h10M128 49h10M78 74h80M209 55h9',
    wheels: [56, 181],
  },
}

export default function VehicleSilhouette({ shape, className = '' }: { shape: VehicleShape; className?: string }) {
  const profile = profiles[shape]
  const sport = shape === 'sport'

  return (
    <svg viewBox="0 0 240 96" className={`${styles.figure} ${sport ? styles.sport : ''} ${className}`}
      aria-hidden="true" focusable="false">
      <path className={styles.body} d={profile.body} />
      <path className={styles.windows} d={profile.windows} />
      <path className={styles.details} d={profile.details} />
      {profile.wheels.map((x) => (
        <g key={x}>
          <circle className={styles.tire} cx={x} cy="69" r="14" />
          <circle className={styles.rim} cx={x} cy="69" r="8" />
          <path className={styles.spokes} d={`M${x} 61v16m-8-8h16m-13.5-5.5 11 11m-11 0 11-11`} />
          <circle className={styles.hub} cx={x} cy="69" r="2" />
        </g>
      ))}
      {sport ? <path className={styles.headlight} d="m197 51 17 5-12 1-9-4Z" /> : null}
    </svg>
  )
}
