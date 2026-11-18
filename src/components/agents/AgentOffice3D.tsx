import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AGENTS, REST_SPOTS, type AgentStatus } from './AgentOffice'

// Mesmas zonas da planta 2D (percentagens) convertidas para o mundo 3D (20 x 12 unidades).
const wx = (x: number) => (x / 100) * 20 - 10
const wz = (y: number) => (y / 100) * 12 - 6
const seatOf = (d: { x: number; y: number }) => ({ x: wx(d.x + 4.5), z: wz(d.y + 7) + 1.1 })

const WOOD = '#8b5e3c'
const GLASS = '#93c5fd'

function Desk({ x, y, color, on }: { x: number; y: number; color: string; on: boolean }) {
  const bars = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!on || !bars.current) return
    bars.current.children.forEach((c, i) => {
      c.scale.y = 0.35 + 0.65 * Math.abs(Math.sin(clock.elapsedTime * (2 + i * 0.4) + i))
    })
  })
  const cx = wx(x + 4.5)
  const cz = wz(y + 7)
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.1, 1.6]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      {/* Ecrã virado para o lugar do agente (lado +z) */}
      <mesh position={[0, 1.2, -0.55]}>
        <boxGeometry args={[1.1, 0.7, 0.06]} />
        <meshStandardMaterial color="#0f172a" emissive={on ? color : '#000'} emissiveIntensity={on ? 0.35 : 0} />
      </mesh>
      <group ref={bars} position={[-0.4, 0.86, -0.52]}>
        {[0, 1, 2, 3].map(i => (
          <mesh key={i} position={[i * 0.25, 0.22, 0]} scale={[1, 0.6, 1]}>
            <boxGeometry args={[0.14, 0.4, 0.04]} />
            <meshStandardMaterial color={color} />
          </mesh>
        ))}
      </group>
      {/* Cadeira */}
      <mesh position={[0, 0.45, 1.1]}>
        <cylinderGeometry args={[0.32, 0.32, 0.12, 16]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    </group>
  )
}

function Person({ color, hair, status, seat, rest }: {
  color: string; hair: string; status: AgentStatus; seat: { x: number; z: number }; rest: { x: number; z: number }
}) {
  const ref = useRef<THREE.Group>(null)
  const live = useRef({ seat, rest, status, placed: false })
  live.current = { seat, rest, status, placed: live.current.placed }

  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    const l = live.current
    if (!l.placed) { g.position.set(l.seat.x, 0, l.seat.z); l.placed = true }
    const t = l.status === 'descanso' ? l.rest : l.seat
    g.position.x = THREE.MathUtils.damp(g.position.x, t.x, 2.2, dt)
    g.position.z = THREE.MathUtils.damp(g.position.z, t.z, 2.2, dt)
    g.position.y = l.status === 'trabalhando' ? Math.sin(state.clock.elapsedTime * 6) * 0.03 : 0
  })

  const marker = status === 'aprovacao' ? '#fbbf24' : status === 'erro' ? '#ef4444' : status === 'descanso' ? '#34d399' : null
  return (
    <group ref={ref}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.6, 14]} />
        <meshStandardMaterial color={color} opacity={status === 'espera' ? 0.55 : 1} transparent />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#f1c9a5" />
      </mesh>
      <mesh position={[0, 1.25, -0.02]}>
        <sphereGeometry args={[0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={hair} />
      </mesh>
      {marker && (
        <mesh position={[0, 1.7, 0]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial color={marker} emissive={marker} emissiveIntensity={0.8} />
        </mesh>
      )}
    </group>
  )
}

export default function AgentOffice3D({ status, approved }: { status: Record<string, AgentStatus>; approved: number }) {
  return (
    <Canvas
      camera={{ position: [0, 15, 12], fov: 40 }}
      dpr={[1, 1.5]}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      style={{ height: 460, borderRadius: 16 }}
    >
      <color attach="background" args={['#c9ced6']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[6, 14, 6]} intensity={0.9} castShadow />

      {/* Piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 12]} />
        <meshStandardMaterial color="#d7dbe2" />
      </mesh>

      {/* Salas de reunião em vidro */}
      {[3, 21, 39].map((x, i) => (
        <group key={i} position={[wx(x + 8), 0, wz(15)]}>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[3.2, 1.2, 2.6]} />
            <meshStandardMaterial color={GLASS} transparent opacity={0.22} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[1.6, 0.1, 0.9]} />
            <meshStandardMaterial color="#d6b98c" />
          </mesh>
        </group>
      ))}

      {/* Lounge */}
      <group position={[wx(58), 0, wz(46)]}>
        <mesh position={[0, 0.3, -0.9]}><boxGeometry args={[2.8, 0.5, 0.7]} /><meshStandardMaterial color="#9a3412" /></mesh>
        <mesh position={[0, 0.3, 0.9]}><boxGeometry args={[2.8, 0.5, 0.7]} /><meshStandardMaterial color="#9a3412" /></mesh>
        <mesh position={[0, 0.2, 0]}><boxGeometry args={[1.2, 0.3, 0.8]} /><meshStandardMaterial color="#78716c" /></mesh>
      </group>

      {/* Sala de repouso */}
      <mesh position={[wx(84), 0.01, wz(17)]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.6, 3.5]} />
        <meshStandardMaterial color="#a7f3d0" />
      </mesh>
      <mesh position={[wx(80), 0.3, wz(12)]}><boxGeometry args={[2.2, 0.5, 0.8]} /><meshStandardMaterial color="#065f46" /></mesh>

      {/* Painel de contrato: uma pilha de blocos por aprovado */}
      <group position={[wx(84), 0, wz(70)]}>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[5.6, 4.8]} /><meshStandardMaterial color="#fde68a" /></mesh>
        {Array.from({ length: Math.min(approved, 12) }).map((_, i) => (
          <mesh key={i} position={[(i % 4) * 0.8 - 1.2, 0.2 + Math.floor(i / 4) * 0.4, 0]}>
            <boxGeometry args={[0.6, 0.3, 0.6]} />
            <meshStandardMaterial color="#d97706" />
          </mesh>
        ))}
      </group>

      {/* Plantas */}
      {[[46, 2], [68, 27], [2, 94], [96, 96]].map(([x, y], i) => (
        <mesh key={i} position={[wx(x), 0.5, wz(y)]}><sphereGeometry args={[0.45, 14, 14]} /><meshStandardMaterial color="#15803d" /></mesh>
      ))}

      {/* Secretárias, agentes */}
      {AGENTS.map((a, i) => (
        <group key={a.code}>
          <Desk x={a.desk.x} y={a.desk.y} color={a.color} on={status[a.code] === 'trabalhando'} />
          <Person
            color={a.color}
            hair={a.hair}
            status={status[a.code] ?? 'espera'}
            seat={seatOf(a.desk)}
            rest={{ x: wx(REST_SPOTS[i % REST_SPOTS.length].x), z: wz(REST_SPOTS[i % REST_SPOTS.length].y) }}
          />
        </group>
      ))}
    </Canvas>
  )
}
