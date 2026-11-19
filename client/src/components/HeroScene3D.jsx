import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Float, OrbitControls } from '@react-three/drei';

function GourmetBurger3D({ mousePos }) {
  const groupRef = useRef();

  const sesamePositions = useMemo(
    () => [
      [0.32, 0.86, 0.36],
      [-0.36, 0.85, 0.28],
      [0.12, 0.92, -0.35],
      [-0.22, 0.87, -0.32],
      [0.45, 0.79, -0.1],
      [-0.45, 0.79, 0.05],
      [0.0, 0.94, 0.18],
    ],
    []
  );

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.32;
    const targetX = (mousePos.current.y || 0) * 0.22;
    const targetZ = -(mousePos.current.x || 0) * 0.14;
    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.06;
    groupRef.current.rotation.z += (targetZ - groupRef.current.rotation.z) * 0.06;
  });

  return (
    <Float speed={2.1} rotationIntensity={0.28} floatIntensity={0.65}>
      <group ref={groupRef} scale={1.15} position={[0, -0.1, 0]}>
        {/* Bottom Toasted Bun */}
        <mesh position={[0, -0.52, 0]} castShadow>
          <cylinderGeometry args={[1.05, 0.96, 0.36, 40]} />
          <meshStandardMaterial color="#e09f5a" roughness={0.55} metalness={0.05} />
        </mesh>

        {/* Juicy Seared Patty */}
        <mesh position={[0, -0.22, 0]} castShadow>
          <cylinderGeometry args={[1.1, 1.08, 0.3, 40]} />
          <meshStandardMaterial color="#5c2c16" roughness={0.75} metalness={0.08} />
        </mesh>

        {/* Melted Cheddar Cheese */}
        <mesh position={[0, -0.02, 0]} rotation={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[1.82, 0.09, 1.82]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.35} metalness={0.1} />
        </mesh>

        {/* Crisp Lettuce Layer */}
        <mesh position={[0, 0.11, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.82, 0.16, 16, 42]} />
          <meshStandardMaterial color="#22c55e" roughness={0.5} />
        </mesh>

        {/* Fresh Tomato Slices */}
        <mesh position={[0.28, 0.24, 0.16]} castShadow>
          <cylinderGeometry args={[0.56, 0.56, 0.09, 32]} />
          <meshStandardMaterial color="#ef4444" roughness={0.28} />
        </mesh>
        <mesh position={[-0.28, 0.25, -0.16]} castShadow>
          <cylinderGeometry args={[0.52, 0.52, 0.09, 32]} />
          <meshStandardMaterial color="#dc2626" roughness={0.28} />
        </mesh>

        {/* Golden Top Bun */}
        <mesh position={[0, 0.34, 0]} castShadow>
          <sphereGeometry args={[1.06, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.45} metalness={0.08} />
        </mesh>

        {/* Sesame Seeds */}
        {sesamePositions.map((pos, i) => (
          <mesh key={i} position={pos}>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.4} />
          </mesh>
        ))}

        {/* Orbiting Floating Ingredients */}
        <Float speed={3} floatIntensity={0.8}>
          <mesh position={[1.65, 0.55, 0.35]}>
            <sphereGeometry args={[0.2, 24, 24]} />
            <meshStandardMaterial color="#ef4444" roughness={0.25} />
          </mesh>
        </Float>
        <Float speed={2.6} floatIntensity={0.9}>
          <mesh position={[-1.65, 0.25, -0.25]} rotation={[0.6, 0.4, 0.2]}>
            <torusGeometry args={[0.22, 0.07, 14, 28]} />
            <meshStandardMaterial color="#c084fc" roughness={0.3} />
          </mesh>
        </Float>
        <Float speed={3.2} floatIntensity={0.7}>
          <mesh position={[1.3, -0.55, -0.6]} rotation={[0.2, 0.8, 0.4]}>
            <octahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial color="#2dd4bf" roughness={0.3} />
          </mesh>
        </Float>
      </group>
    </Float>
  );
}

export default function HeroScene3D({ height = 340 }) {
  const mousePos = useRef({ x: 0, y: 0 });

  return (
    <div
      style={{ width: '100%', height, position: 'relative', cursor: 'grab' }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mousePos.current = {
          x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
          y: ((e.clientY - rect.top) / rect.height) * 2 - 1,
        };
      }}
      onMouseLeave={() => {
        mousePos.current = { x: 0, y: 0 };
      }}
    >
      <Canvas shadows camera={{ position: [0, 0.8, 4.4], fov: 42 }} dpr={[1, 1.75]}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[4, 6, 4]} intensity={1.6} castShadow />
        <pointLight position={[-4, 2, -2]} intensity={0.9} color="#ec4899" />
        <pointLight position={[3, -2, 2]} intensity={0.7} color="#38bdf8" />
        <GourmetBurger3D mousePos={mousePos} />
        <ContactShadows position={[0, -1.25, 0]} opacity={0.42} scale={6} blur={2.4} far={2.5} />
        <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.8} />
      </Canvas>
    </div>
  );
}
