import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'

/** Detached drawing surface only: no DOM insertion, portal or secondary root. */
export function annotationTexture(text: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512; canvas.height = 96
  const context = canvas.getContext('2d')
  if (!context) return null
  context.font = '26px Helvetica, Arial, sans-serif'
  context.textAlign = 'center'; context.textBaseline = 'middle'
  const width = Math.min(492, context.measureText(text).width + 36)
  context.fillStyle = 'rgba(6, 14, 10, .82)'
  context.beginPath(); context.roundRect((512 - width) / 2, 21, width, 54, 9); context.fill()
  context.fillStyle = '#d2ded6'; context.fillText(text, 256, 49, 460)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Each effect setup owns a fresh texture, including StrictMode replay. */
export function Annotation({ position, children }: { position: [number, number, number]; children: string }) {
  const material = useRef<THREE.SpriteMaterial | null>(null)
  useLayoutEffect(() => {
    const owned = material.current
    if (!owned) return
    const texture = annotationTexture(children)
    owned.map = texture; owned.opacity = texture ? 1 : 0; owned.needsUpdate = true
    return () => {
      if (owned.map === texture) { owned.map = null; owned.opacity = 0; owned.needsUpdate = true }
      texture?.dispose()
    }
  }, [children])
  return <sprite position={position} scale={[2.3, .43125, 1]} renderOrder={100}>
    <spriteMaterial ref={material} transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false}/>
  </sprite>
}
