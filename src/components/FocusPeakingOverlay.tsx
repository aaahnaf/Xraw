import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Props {
  enabled: boolean;
  visible: boolean;
}

/**
 * Three.js Focus Peaking Visualization
 * 
 * Renders a subtle edge-detection overlay to visualize focus.
 * Only active when enabled AND visible.
 * Uses minimal GPU resources - simple geometry, no post-processing.
 */
export function FocusPeakingOverlay({ enabled, visible }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const frameIdRef = useRef<number>(0);
  const lastRenderTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !visible || !containerRef.current) {
      // Cleanup when disabled or not visible
      if (rendererRef.current) {
        cancelAnimationFrame(frameIdRef.current);
        rendererRef.current.dispose();
        rendererRef.current = null;
        sceneRef.current = null;
        cameraRef.current = null;
        meshRef.current = null;
      }
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene setup - minimal
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Orthographic camera for overlay
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;
    cameraRef.current = camera;

    // Renderer - transparent, alpha enabled
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Focus peaking visualization - simple edge detection pattern
    // This is a decorative indicator, not actual edge detection
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.3 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        varying vec2 vUv;
        
        void main() {
          // Subtle animated grid pattern to indicate focus peaking is active
          vec2 grid = fract(vUv * 20.0);
          float edge = step(0.95, grid.x) + step(0.95, grid.y);
          
          // Fade at edges
          float fade = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x) *
                       smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
          
          // Pulse animation
          float pulse = 0.5 + 0.5 * sin(uTime * 2.0);
          
          vec3 color = vec3(1.0, 0.3, 0.3); // Red for focus peaking
          float alpha = edge * fade * uIntensity * pulse * 0.5;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;

    // Event-driven rendering - only render when needed
    let needsRender = true;

    const animate = (time: number) => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !meshRef.current) {
        return;
      }

      // Throttle to 30fps for focus peaking overlay
      const delta = time - lastRenderTimeRef.current;
      if (delta > 33) { // ~30fps
        lastRenderTimeRef.current = time;
        
        // Update shader time
        const mat = meshRef.current.material as THREE.ShaderMaterial;
        mat.uniforms.uTime.value = time * 0.001;
        
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        needsRender = false;
      }

      frameIdRef.current = requestAnimationFrame(animate);
    };

    frameIdRef.current = requestAnimationFrame(animate);

    // Handle resize
    const handleResize = () => {
      if (!rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      rendererRef.current.setSize(w, h);
      needsRender = true;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameIdRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      cameraRef.current = null;
      meshRef.current = null;
    };
  }, [enabled, visible]);

  if (!enabled || !visible) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-20"
      style={{ opacity: 0.6 }}
    />
  );
}
