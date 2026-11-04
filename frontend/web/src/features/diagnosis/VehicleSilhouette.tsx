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
    body: 'M14 64Q13 54 21 50L48 44 73 29Q84 22 98 22H123Q139 23 151 35L165 45 204 49Q219 51 224 61V70Q221 74 210 74H199C197 49 164 49 162 74H73C71 49 38 49 36 74L19 72Q14 71 14 64Z',
    windows: 'M61 43 79 32Q86 28 100 28H106V43ZM113 28H123Q133 29 142 37L149 43H113Z',
    details: 'M109 49v20M81 49h8M129 49h8',
    wheels: [55, 181],
  },
  hatchback: {
    body: 'M28 65V51Q28 43 33 35L43 25Q48 21 60 21H112Q129 22 140 34L151 44 190 49Q206 53 212 61V70Q211 74 198 74H186C184 49 153 49 151 74H73C71 49 40 49 38 74L32 73Q28 72 28 65Z',
    windows: 'M39 43 48 30Q53 27 62 27H85V43ZM92 27H111Q124 28 134 38L139 43H92Z',
    details: 'M89 49v20M100 49h8',
    wheels: [56, 169],
  },
  suv: {
    body: 'M18 65V54Q18 45 26 34L42 21Q51 13 65 13H119Q138 14 151 30L163 43 197 48Q216 52 222 61V71Q220 75 208 75H198C195 47 160 47 157 75H76C73 47 38 47 35 75L23 72Q18 71 18 65Z',
    windows: 'M31 43 46 26Q51 21 60 21V43ZM67 21H101V43H67ZM108 21H119Q131 22 142 35L149 43H108Z',
    details: 'M104 49v20M69 49v20M79 49h8M122 49h8',
    wheels: [56, 178],
  },
  pickup: {
    body: 'M13 65V43Q13 40 17 40H88V25Q88 20 95 20H132Q140 20 146 29L159 43 202 47Q217 50 225 59V71Q223 76 212 76H199C196 47 161 47 158 76H77C74 47 39 47 36 76L18 73Q13 72 13 65Z',
    windows: 'M96 27H113V43H96ZM120 27H132Q136 27 139 33L147 43H120Z',
    details: 'M88 45v25M117 49v21M130 49h8M19 46h61',
    wheels: [57, 179],
  },
  van: {
    body: 'M17 65 20 29Q21 17 35 15H131Q145 15 155 28L172 47 204 52Q219 55 224 64V72Q222 76 210 76H199C197 51 164 51 162 76H74C72 51 39 51 37 76L22 73Q17 72 17 65Z',
    windows: 'M32 23H66V46H27ZM73 23H109V46H73ZM116 23H131Q140 23 148 34L157 46H116Z',
    details: 'M112 52v18M69 52v18M82 52h8M128 52h8',
    wheels: [56, 181],
  },
  wagon: {
    body: 'M14 64 19 32Q20 24 31 24H126Q140 24 150 36L160 45 206 49Q219 52 224 61V70Q223 74 210 74H199C197 49 164 49 162 74H74C72 49 39 49 37 74L20 72Q14 71 14 64Z',
    windows: 'M29 31H65V44H25ZM72 31H108V44H72ZM115 31H126Q134 31 141 38L148 44H115Z',
    details: 'M111 50v19M69 50v19M82 50h8M128 50h8',
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
          {sport ? <>
            <path className={styles.spokes} d={`M${x} 61v16m-8-8h16m-13.5-5.5 11 11m-11 0 11-11`} />
            <circle className={styles.hub} cx={x} cy="69" r="2" />
          </> : null}
        </g>
      ))}
      {sport ? <path className={styles.headlight} d="m197 51 17 5-12 1-9-4Z" /> : null}
    </svg>
  )
}
