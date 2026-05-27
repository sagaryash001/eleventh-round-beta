import React, { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useTexture, OrbitControls, ContactShadows, Environment, Float } from '@react-three/drei'
import * as THREE from 'three'

function GarmentMesh({ imageUrl }: { imageUrl: string }) {
  const texture = useTexture(imageUrl)
  texture.colorSpace = THREE.SRGBColorSpace

  return (
    <Float speed={1.2} rotationIntensity={0.06} floatIntensity={0.25}>
      <mesh castShadow>
        {/* Slightly taller aspect ratio for clothing */}
        <planeGeometry args={[2.2, 2.8]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.75}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Float>
  )
}

function Spinner() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, d) => { if (ref.current) ref.current.rotation.z += d * 0.8 })
  return (
    <mesh ref={ref} position={[0, 0, 0]}>
      <torusGeometry args={[0.5, 0.04, 8, 30]} />
      <meshBasicMaterial color="#8b0000" />
    </mesh>
  )
}

interface Props {
  imageUrl: string
  compact?: boolean  // smaller version for product cards
}

export default function ProductViewer3D({ imageUrl, compact = false }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0.2, 4], fov: 38 }}
      shadows
      dpr={[1, 2]}
      style={{ background: 'transparent' }}
    >
      {/* Lighting rig — mimics studio photography */}
      <ambientLight intensity={0.35} />
      {/* Key light — bright, slightly warm */}
      <directionalLight position={[3, 5, 4]} intensity={1.1} color="#fff5e8" castShadow />
      {/* Fill light — cool from the left */}
      <directionalLight position={[-4, 2, 2]} intensity={0.4} color="#c8d8ff" />
      {/* Rim light — subtle blood red edge glow */}
      <directionalLight position={[0, -2, -4]} intensity={0.3} color="#8b0000" />

      <Suspense fallback={<Spinner />}>
        <GarmentMesh imageUrl={imageUrl} />
        <ContactShadows
          position={[0, -1.55, 0]}
          opacity={0.45}
          scale={3.5}
          blur={2.8}
          far={3}
          color="#000000"
        />
        <Environment preset="city" />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={!compact}
        autoRotateSpeed={0.7}
        /* Restrict to a narrow arc so we never see the flat side */
        minAzimuthAngle={-Math.PI / 4}
        maxAzimuthAngle={Math.PI / 4}
        minPolarAngle={Math.PI * 0.32}
        maxPolarAngle={Math.PI * 0.65}
        dampingFactor={0.08}
        enableDamping
      />
    </Canvas>
  )
}
