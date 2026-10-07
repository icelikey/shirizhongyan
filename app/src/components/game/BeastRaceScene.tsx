import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { BeastRaceRoomView } from '@contracts/gameSdk'
import type { RaceReveal } from '@contracts/beastRace'
import { cn } from '@/lib/utils'

type RaceState = NonNullable<BeastRaceRoomView['race']>
type RacerState = RaceState['racers'][number]

export interface BeastRaceSceneProps {
  race: RaceState
  reveal: RaceReveal | null
  mySeat: number | null
  className?: string
}

const LANE_X = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5]
const RACER_COLORS = [0xe3c27c, 0x9b7fe8, 0x5cd6c0, 0xe06b77, 0x78a9e8, 0xf0a56b]
const TRACK_START_Z = 8.8
const TRACK_FINISH_Z = -10.8
const TRACK_LENGTH_Z = TRACK_START_Z - TRACK_FINISH_Z

const BEAST_NAMES: Record<string, string> = {
  crane: '鹤',
  fox: '狐',
  carp: '鲤',
  ape: '猿',
  wolf: '狼',
  turtle: '龟',
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if (material && typeof material.dispose === 'function') material.dispose()
    }
  })
}

function makeMaterial(color: number, emissive = 0x000000, intensity = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.58,
    metalness: 0.3,
  })
}

function createBeast(racer: RacerState, index: number) {
  const color = RACER_COLORS[index % RACER_COLORS.length]
  const group = new THREE.Group()
  group.name = `racer-${racer.seat}`
  group.userData.seat = racer.seat

  const aura = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.045, 8, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.88 }),
  )
  aura.rotation.x = Math.PI / 2
  aura.position.y = 0.08
  aura.name = 'aura'
  group.add(aura)

  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.43, 1),
    makeMaterial(color, color, 0.32),
  )
  body.scale.set(1.32, 0.96, 1.5)
  body.position.y = 0.56
  body.castShadow = true
  group.add(body)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.29, 18, 12),
    makeMaterial(0xf5e6c2, color, 0.12),
  )
  head.position.set(0, 0.92, -0.24)
  head.scale.set(0.92, 1.08, 1.05)
  head.castShadow = true
  group.add(head)

  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x17101f })
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), eyeMaterial)
    eye.position.set(side * 0.105, 0.98, -0.48)
    group.add(eye)
  }

  const earMaterial = makeMaterial(color, color, 0.1)
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 5), earMaterial)
    ear.position.set(side * 0.19, 1.17, -0.2)
    ear.rotation.z = side * -0.32
    group.add(ear)
  }

  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 16), earMaterial)
  tail.position.set(0, 0.64, 0.46)
  tail.rotation.x = Math.PI / 2
  group.add(tail)

  // 每只异兽都保留同一套可读轮廓，但用不同的晶角与尾焰拉开席位辨识度。
  const crest = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.12, 0),
    makeMaterial(0xffefc1, color, 0.65),
  )
  crest.position.set(0, 1.28, -0.06)
  crest.scale.set(0.7, 1.5, 0.7)
  crest.castShadow = true
  group.add(crest)

  const trail = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.52, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.42, depthWrite: false }),
  )
  trail.rotation.x = -Math.PI / 2
  trail.position.set(0, 0.48, 0.66)
  trail.scale.set(0.72 + (index % 3) * 0.14, 0.72 + (index % 2) * 0.12, 1)
  group.add(trail)

  const beacon = new THREE.PointLight(color, 0.8, 2.8, 2)
  beacon.position.set(0, 0.9, 0)
  group.add(beacon)

  const name = new THREE.Mesh(
    new THREE.RingGeometry(0.11, 0.16, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
  )
  name.rotation.x = -Math.PI / 2
  name.position.y = 0.06
  group.add(name)

  group.position.x = LANE_X[index % LANE_X.length]
  group.position.y = 0.18
  return group
}

function addTrack(scene: THREE.Scene, trackKinds: readonly string[]) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 34),
    new THREE.MeshStandardMaterial({ color: 0x0e1823, roughness: 0.92, metalness: 0.05 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.35
  ground.receiveShadow = true
  scene.add(ground)

  const track = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.42, 24.6),
    new THREE.MeshStandardMaterial({ color: 0x213c3b, roughness: 0.78, metalness: 0.12 }),
  )
  track.position.y = -0.08
  track.receiveShadow = true
  scene.add(track)

  const edgeMaterial = makeMaterial(0x5f3f54, 0x8b4a57, 0.28)
  for (const x of [-3.7, 3.7]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.56, 25.3), edgeMaterial)
    edge.position.set(x, 0.05, 0)
    edge.castShadow = true
    edge.receiveShadow = true
    scene.add(edge)

    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 25.3, 8),
      new THREE.MeshBasicMaterial({ color: 0xb45f83, transparent: true, opacity: 0.9 }),
    )
    rail.rotation.x = Math.PI / 2
    rail.position.set(x, 0.5, 0)
    scene.add(rail)
  }

  const laneMaterial = new THREE.MeshBasicMaterial({ color: 0xf8e9c0, transparent: true, opacity: 0.16 })
  for (const x of [-2, -1, 0, 1, 2]) {
    for (let z = -10.5; z < 10.5; z += 1.35) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.58), laneMaterial)
      marker.position.set(x, 0.16, z)
      scene.add(marker)
    }
  }

  const milestoneMaterial = new THREE.MeshBasicMaterial({ color: 0x9b7fe8, transparent: true, opacity: 0.4 })
  for (let i = 1; i < 6; i += 1) {
    const z = TRACK_START_Z - (TRACK_LENGTH_Z * i) / 6
    const gate = new THREE.Mesh(new THREE.BoxGeometry(7.15, 0.025, 0.08), milestoneMaterial)
    gate.position.set(0, 0.19, z)
    scene.add(gate)
  }

  const tileColors: Record<string, number> = {
    headwind: 0x8ca8ff,
    marsh: 0x58c3a4,
    current: 0x54d6df,
    fog: 0xa987e8,
    fork: 0xffc56e,
    thundercloud: 0xf06f8c,
    cache: 0xe3c27c,
  }
  for (let index = 0; index < trackKinds.length; index += 1) {
    const kind = trackKinds[index]
    const color = tileColors[kind]
    if (!color) continue
    const z = TRACK_START_Z - (TRACK_LENGTH_Z * index) / Math.max(trackKinds.length - 1, 1)
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(6.8, 0.34),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false }),
    )
    strip.rotation.x = -Math.PI / 2
    strip.position.set(0, 0.185, z)
    scene.add(strip)
    const sigil = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.032, 6, 18),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82 }),
    )
    sigil.rotation.x = -Math.PI / 2
    sigil.position.set(0, 0.22, z)
    scene.add(sigil)
  }

  for (let index = 0; index < LANE_X.length; index += 1) {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.08, 1.18),
      new THREE.MeshStandardMaterial({
        color: RACER_COLORS[index],
        emissive: RACER_COLORS[index],
        emissiveIntensity: 0.28,
        transparent: true,
        opacity: 0.82,
        roughness: 0.45,
        metalness: 0.35,
      }),
    )
    pad.position.set(LANE_X[index], 0.18, TRACK_START_Z + 0.12)
    pad.receiveShadow = true
    scene.add(pad)
  }

  const finishMaterial = new THREE.MeshStandardMaterial({
    color: 0xe3c27c,
    emissive: 0x9d5e25,
    emissiveIntensity: 0.7,
    metalness: 0.8,
    roughness: 0.25,
  })
  for (const x of [-3.2, 3.2]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.23, 2.9, 12), finishMaterial)
    pillar.position.set(x, 1.28, TRACK_FINISH_Z)
    pillar.castShadow = true
    scene.add(pillar)
  }
  const finishBeam = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.22, 0.22), finishMaterial)
  finishBeam.position.set(0, 2.58, TRACK_FINISH_Z)
  finishBeam.castShadow = true
  scene.add(finishBeam)

  const finishLight = new THREE.PointLight(0xe3c27c, 3.2, 7)
  finishLight.position.set(0, 1.6, TRACK_FINISH_Z + 0.4)
  scene.add(finishLight)
}

function addRuins(scene: THREE.Scene) {
  const ruinMaterial = new THREE.MeshStandardMaterial({ color: 0x291c35, roughness: 0.95, metalness: 0.12 })
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x513c89, transparent: true, opacity: 0.45 })
  for (let i = 0; i < 22; i += 1) {
    const side = i % 2 === 0 ? -1 : 1
    const z = -12 + ((i * 7) % 24)
    const height = 0.5 + ((i * 13) % 10) / 10
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + (i % 3) * 0.11, 0), ruinMaterial)
    rock.position.set(side * (5.2 + (i % 4) * 0.5), height * 0.45, z)
    rock.scale.y = 1 + height
    rock.rotation.set(i * 0.4, i * 0.8, i * 0.2)
    rock.castShadow = true
    scene.add(rock)
    if (i % 4 === 0) {
      const rune = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 6, 18), glowMaterial)
      rune.position.set(rock.position.x, rock.position.y + 0.52, rock.position.z)
      rune.rotation.y = Math.PI / 2
      scene.add(rune)
    }
  }
}

function addAtmosphere(scene: THREE.Scene) {
  const count = 130
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const angle = i * 2.39996
    const radius = 5.5 + (i % 17) * 0.2
    positions[i * 3] = Math.cos(angle) * radius
    positions[i * 3 + 1] = 0.2 + (i % 11) * 0.23
    positions[i * 3 + 2] = -13 + (i % 29) * 0.9
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xd6a5ff, size: 0.075, transparent: true, opacity: 0.7, depthWrite: false }),
  )
  points.name = 'world-ash'
  scene.add(points)

  const worldRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.4, 0.025, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0x8c74d8, transparent: true, opacity: 0.5 }),
  )
  worldRing.position.set(0, 4.8, -4.5)
  worldRing.rotation.x = Math.PI / 2.25
  scene.add(worldRing)

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x33294a, transparent: true, opacity: 0.85 }),
  )
  moon.position.set(-6.5, 5.3, -9)
  scene.add(moon)
}

function progressOf(racer: RacerState, trackLength: number) {
  return Math.min(1, Math.max(0, racer.visiblePosition / Math.max(trackLength, 1)))
}

export default function BeastRaceScene({ race, reveal, mySeat, className }: BeastRaceSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const raceRef = useRef(race)
  const revealPulseRef = useRef(0)
  raceRef.current = race
  const revealKey = reveal ? `${reveal.round}:${Object.entries(reveal.positions).map(([seat, position]) => `${seat}-${position}`).join(',')}` : 'none'

  useEffect(() => {
    revealPulseRef.current = 1
  }, [revealKey])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const mount = host

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x08070f)
    scene.fog = new THREE.Fog(0x08070f, 15, 34)
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80)
    camera.position.set(0, 6.7, 13.8)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      mount.dataset.webgl = 'unsupported'
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.domElement.className = 'absolute inset-0 h-full w-full'
    renderer.domElement.setAttribute('aria-label', '金壤超能力赛马三维赛道')
    mount.appendChild(renderer.domElement)

    const ambient = new THREE.HemisphereLight(0xb8a3e8, 0x0b1015, 1.6)
    scene.add(ambient)
    const keyLight = new THREE.DirectionalLight(0xffe6ba, 3.1)
    keyLight.position.set(-6, 10, 8)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    scene.add(keyLight)
    const rimLight = new THREE.PointLight(0x8d74ff, 2.8, 18)
    rimLight.position.set(4, 4, -8)
    scene.add(rimLight)

    addTrack(scene, race.track)
    addRuins(scene)
    addAtmosphere(scene)

    const racers = race.racers.map((racer, index) => {
      const group = createBeast(racer, index)
      scene.add(group)
      return { group, racer, index }
    })
    const smoothZ = new Map(race.racers.map((racer) => [racer.seat, TRACK_START_Z - progressOf(racer, race.trackLength) * TRACK_LENGTH_Z]))
    let disposed = false
    let lastTime = 0

    function resize() {
      const width = Math.max(mount.clientWidth, 1)
      const height = Math.max(mount.clientHeight, 1)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    function animate(time: number) {
      if (disposed) return
      const delta = Math.min(0.05, (time - lastTime) / 1000 || 0.016)
      lastTime = time
      const seconds = time / 1000
      const currentRace = raceRef.current
      const leading = Math.max(...currentRace.racers.map((racer) => progressOf(racer, currentRace.trackLength)))

      for (const entry of racers) {
        const live = currentRace.racers.find((racer) => racer.seat === entry.racer.seat)
        if (!live) continue
        const target = TRACK_START_Z - progressOf(live, currentRace.trackLength) * TRACK_LENGTH_Z
        const previous = smoothZ.get(live.seat) ?? target
        const next = THREE.MathUtils.damp(previous, target, 5.2, delta)
        smoothZ.set(live.seat, next)
        entry.group.position.z = next
        entry.group.position.y = 0.18 + Math.sin(seconds * 4.2 + entry.index) * 0.04
        entry.group.rotation.y = Math.sin(seconds * 1.4 + entry.index) * 0.05
        const aura = entry.group.getObjectByName('aura')
        if (aura) {
          aura.rotation.z += delta * (1.1 + entry.index * 0.08)
          const isMine = live.seat === mySeat
          aura.scale.setScalar(isMine ? 1.12 + Math.sin(seconds * 5) * 0.06 : 1)
        }
        const body = entry.group.children[1]
        body.rotation.y += delta * (0.5 + entry.index * 0.1)
      }

      const cameraTargetZ = 0.8 - leading * 1.8
      camera.position.z = THREE.MathUtils.damp(camera.position.z, 13.8 + cameraTargetZ, 1.5, delta)
      camera.lookAt(0, 0.35, -leading * 1.6)
      const particles = scene.getObjectByName('world-ash')
      if (particles) {
        particles.rotation.y = seconds * 0.015
        particles.position.y = Math.sin(seconds * 0.35) * 0.12
      }
      revealPulseRef.current = Math.max(0, revealPulseRef.current - delta * 1.4)
      rimLight.intensity = 2.8 + revealPulseRef.current * 3.5
      renderer.render(scene, camera)
    }

    resize()
    window.addEventListener('resize', resize)
    renderer.setAnimationLoop(animate)

    return () => {
      disposed = true
      window.removeEventListener('resize', resize)
      renderer.setAnimationLoop(null)
      disposeObject(scene)
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [mySeat])

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-gold-300/20 bg-[#08070f]', className)}>
      <div ref={hostRef} className="relative h-[310px] min-h-[270px] w-full sm:h-[410px]" data-testid="beast-race-three-scene">
        <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_18%,rgba(227,194,124,.14),transparent_38%),linear-gradient(180deg,transparent_58%,rgba(8,7,15,.8))]" />
        <div className="pointer-events-none absolute left-4 top-4 z-20">
          <div className="text-[10px] tracking-[.3em] text-gold-300">金壤 · 终焉赛场</div>
          <div className="mt-1 font-serifsc text-[17px] text-bone">六兽争渡 · 三维实况</div>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-4 right-4 z-20 flex items-end justify-between gap-3 text-[10px] text-faint">
          <span>真实规则投影 · 镜头随领先者推进</span>
          <span className="font-mono">{reveal ? `第 ${reveal.round} 轮 · ${reveal.events?.length ?? 0} 条事件` : '等待第一轮揭晓'}</span>
        </div>
        <div className="pointer-events-none absolute right-4 top-4 z-20 flex flex-col items-end gap-1">
          {race.racers.map((racer, index) => (
            <div key={racer.seat} className={cn('rounded-full border px-2 py-1 text-[9px] backdrop-blur-sm', racer.seat === mySeat ? 'border-gold-100/60 bg-gold-300/15 text-gold-100' : 'border-white/10 bg-black/20 text-faint')}>
              <span className="mr-1" style={{ color: `#${RACER_COLORS[index].toString(16).padStart(6, '0')}` }}>◆</span>
              席{racer.seat + 1} · {BEAST_NAMES[racer.beastId] ?? racer.beastId}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
