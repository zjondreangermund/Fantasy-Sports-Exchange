import "react";

type ThreeIntrinsicElements = {
	group: any;
	mesh: any;
	planeGeometry: any;
	extrudeGeometry: any;
	meshStandardMaterial: any;
	meshBasicMaterial: any;
	ambientLight: any;
	directionalLight: any;
	pointLight: any;
	spotLight: any;
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
