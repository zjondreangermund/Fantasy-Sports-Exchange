<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Ultra 3D Card</title>
  <style>
    body { margin:0; overflow:hidden; background:#0b0e14; }
    canvas { display:block; }
  </style>
</head>
<body>

<script type="module">

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { RGBELoader } from "https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/loaders/RGBELoader.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/controls/OrbitControls.js";

// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 100);
camera.position.set(0,0,5);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.physicallyCorrectLights = true;
document.body.appendChild(renderer.domElement);

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(5,5,5);
scene.add(light);

const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);

// Environment reflection
new RGBELoader()
.load("https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr", function(texture){
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
});

// Card Geometry (extruded rounded rectangle)
const shape = new THREE.Shape();
const width = 2;
const height = 3;
const radius = 0.25;

shape.moveTo(-width/2 + radius, -height/2);
shape.lineTo(width/2 - radius, -height/2);
shape.quadraticCurveTo(width/2, -height/2, width/2, -height/2 + radius);
shape.lineTo(width/2, height/2 - radius);
shape.quadraticCurveTo(width/2, height/2, width/2 - radius, height/2);
shape.lineTo(-width/2 + radius, height/2);
shape.quadraticCurveTo(-width/2, height/2, -width/2, height/2 - radius);
shape.lineTo(-width/2, -height/2 + radius);
shape.quadraticCurveTo(-width/2, -height/2, -width/2 + radius, -height/2);

const geometry = new THREE.ExtrudeGeometry(shape, {
  depth: 0.15,
  bevelEnabled: true,
  bevelThickness: 0.05,
  bevelSize: 0.05,
  bevelSegments: 8
});

geometry.center();

// Metallic base material
const baseMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x1a1f2e,
  metalness: 1.0,
  roughness: 0.25,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
  envMapIntensity: 1.5
});

// Holographic shader overlay
const holoMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
  },
  transparent: true,
  vertexShader: `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    varying vec2 vUv;

    float noise(vec2 p){
      return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
    }

    void main(){
      float shine = sin((vUv.x + time)*15.0) * 0.5 + 0.5;
      vec3 rainbow = vec3(
        sin(time + vUv.x*5.0)*0.5+0.5,
        sin(time + vUv.y*5.0 + 2.0)*0.5+0.5,
        sin(time + vUv.x*5.0 + 4.0)*0.5+0.5
      );
      float grain = noise(vUv * 200.0) * 0.1;

      gl_FragColor = vec4(rainbow * shine + grain, 0.35);
    }
  `
});

const card = new THREE.Mesh(geometry, baseMaterial);
scene.add(card);

const holoMesh = new THREE.Mesh(geometry, holoMaterial);
scene.add(holoMesh);

// Mouse tracking parallax
window.addEventListener("mousemove", (event)=>{
  const x = (event.clientX / window.innerWidth) * 2 - 1;
  const y = -(event.clientY / window.innerHeight) * 2 + 1;

  card.rotation.y = x * 0.4;
  card.rotation.x = y * 0.4;

  holoMesh.rotation.copy(card.rotation);
});

// Animation loop
function animate(){
  requestAnimationFrame(animate);
  holoMaterial.uniforms.time.value += 0.02;
  renderer.render(scene, camera);
}
animate();

// Resize
window.addEventListener("resize", ()=>{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

</script>
</body>
</html>
