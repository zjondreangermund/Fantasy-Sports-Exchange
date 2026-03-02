import "react";

type ThreeIntrinsicElements = {
	group: any;
	mesh: any;
	planeGeometry: any;
	boxGeometry: any;
	sphereGeometry: any;
	cylinderGeometry: any;
	gridHelper: any;
	ringGeometry: any;
	icosahedronGeometry: any;
	bufferGeometry: any;
	bufferAttribute: any;
	extrudeGeometry: any;
	meshStandardMaterial: any;
	meshPhysicalMaterial: any;
	meshBasicMaterial: any;
	instancedMesh: any;
	points: any;
	pointsMaterial: any;
	color: any;
	ambientLight: any;
	directionalLight: any;
	pointLight: any;
	spotLight: any;
	fog: any;
	primitive: any;
};

declare global {
	namespace JSX {
		interface IntrinsicElements extends ThreeIntrinsicElements {}
	}
}

declare module "react" {
	namespace JSX {
		interface IntrinsicElements extends ThreeIntrinsicElements {}
	}
}

export {};
