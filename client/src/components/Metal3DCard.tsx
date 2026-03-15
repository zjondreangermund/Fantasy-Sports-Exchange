import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export type Rarity = "common" | "rare" | "unique" | "epic" | "legendary";

export type PlayerCardData = {
	id: string;
	name: string;
	rating: number;
	position: string;
	club?: string;
	image?: string;
	rarity: Rarity;
	serial?: number;
	maxSupply?: number;
	team?: string;
	nationality?: string;
	level?: number;
	last5Scores?: number[];
};

type Metal3DCardProps = {
	player: PlayerCardData;
	className?: string;
};

type RarityMetal = {
	metalColor: THREE.Color;
	rimColor: THREE.Color;
	glossiness: number;
	pattern: "brushed" | "wave" | "holographic" | "diamond";
	patternColor: THREE.Color;
	patternOpacity: number;
};

const rarityMetals: Record<Rarity, RarityMetal> = {
	common: {
		metalColor: new THREE.Color(0x8b8b8b),
		rimColor: new THREE.Color(0x505050),
		glossiness: 0.6,
		pattern: "brushed",
		patternColor: new THREE.Color(0x404040),
		patternOpacity: 0.3,
	},
	rare: {
		metalColor: new THREE.Color(0x4a90e2),
		rimColor: new THREE.Color(0x2c5aa0),
		glossiness: 0.8,
		pattern: "wave",
		patternColor: new THREE.Color(0x1e3a5f),
		patternOpacity: 0.25,
	},
	unique: {
		metalColor: new THREE.Color(0x00d4ff),
		rimColor: new THREE.Color(0xff63cd),
		glossiness: 0.9,
		pattern: "holographic",
		patternColor: new THREE.Color(0xff63cd),
		patternOpacity: 0.4,
	},
	epic: {
		metalColor: new THREE.Color(0x9b59ff),
		rimColor: new THREE.Color(0x5d2ea8),
		glossiness: 0.88,
		pattern: "wave",
		patternColor: new THREE.Color(0x3f2570),
		patternOpacity: 0.28,
	},
	legendary: {
		metalColor: new THREE.Color(0xffd700),
		rimColor: new THREE.Color(0xb8860b),
		glossiness: 0.95,
		pattern: "diamond",
		patternColor: new THREE.Color(0xffed4e),
		patternOpacity: 0.35,
	},
};

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}

function createPatternTexture(
	width: number,
	height: number,
	pattern: RarityMetal["pattern"],
	patternColor: THREE.Color,
	opacity: number,
): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d")!;

	ctx.fillStyle = "rgba(0,0,0,0)";
	ctx.fillRect(0, 0, width, height);

	const r = Math.round(patternColor.r * 255);
	const g = Math.round(patternColor.g * 255);
	const b = Math.round(patternColor.b * 255);

	ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`;
	ctx.lineWidth = 1;

	if (pattern === "brushed") {
		for (let i = 0; i < height; i += 2) {
			ctx.beginPath();
			ctx.moveTo(0, i);
			ctx.lineTo(width, i);
			ctx.stroke();
		}
	} else if (pattern === "wave") {
		for (let x = 0; x < width; x += 8) {
			ctx.beginPath();
			for (let y = 0; y < height; y += 2) {
				const wave = Math.sin((x + y) * 0.02) * 3;
				ctx.lineTo(x + wave, y);
			}
			ctx.stroke();
		}
	} else if (pattern === "holographic") {
		for (let i = 0; i < 20; i += 1) {
			const y = (i * height) / 20;
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(width, y);
			ctx.stroke();
		}
		for (let i = 0; i < 15; i += 1) {
			const x = (i * width) / 15;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.stroke();
		}
	} else if (pattern === "diamond") {
		const size = 20;
		for (let x = 0; x < width; x += size) {
			for (let y = 0; y < height; y += size) {
				ctx.beginPath();
				ctx.moveTo(x + size / 2, y);
				ctx.lineTo(x + size, y + size / 2);
				ctx.lineTo(x + size / 2, y + size);
				ctx.lineTo(x, y + size / 2);
				ctx.closePath();
				ctx.stroke();
			}
		}
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.LinearFilter;
	texture.minFilter = THREE.LinearFilter;
	return texture;
}

async function createPortraitTexture(player: PlayerCardData): Promise<THREE.CanvasTexture> {
	const canvas = document.createElement("canvas");
	canvas.width = 344;
	canvas.height = 288;
	const ctx = canvas.getContext("2d")!;

	ctx.fillStyle = "#111111";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	if (player.image) {
		try {
			const img = await loadImage(player.image);
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		} catch {
			ctx.fillStyle = "#333333";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
		}
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.LinearFilter;
	texture.minFilter = THREE.LinearFilter;
	return texture;
}

function createPlateTexture(player: PlayerCardData): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = 344;
	canvas.height = 144;
	const ctx = canvas.getContext("2d")!;

	ctx.fillStyle = "#141414";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.fillStyle = "#ffffff";
	ctx.font = "bold 32px Arial";
	ctx.textAlign = "center";
	ctx.fillText(player.name, canvas.width / 2, 45);

	ctx.font = "14px Arial";
	ctx.fillStyle = "#cccccc";
	ctx.fillText(`${player.position} • ${player.club || "FantasyFC"}`, canvas.width / 2, 75);

	ctx.font = "12px Arial";
	ctx.fillStyle = "#999999";
	ctx.fillText(`#${String(player.serial || 1).padStart(3, "0")} / ${player.maxSupply || 500}`, canvas.width / 2, 130);

	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.LinearFilter;
	texture.minFilter = THREE.LinearFilter;
	return texture;
}

function createTopLabelTexture(player: PlayerCardData): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = 344;
	canvas.height = 80;
	const ctx = canvas.getContext("2d")!;

	ctx.fillStyle = "rgba(0,0,0,0)";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.fillStyle = "#ffffff";
	ctx.font = "bold 48px Arial";
	ctx.textAlign = "center";
	ctx.fillText(player.rating.toString(), canvas.width / 2, 55);

	const texture = new THREE.CanvasTexture(canvas);
	texture.magFilter = THREE.LinearFilter;
	texture.minFilter = THREE.LinearFilter;
	return texture;
}

function createBeveledSlabGeometry(): THREE.BufferGeometry {
	const geometry = new THREE.BufferGeometry();
	const vertices: number[] = [];
	const indices: number[] = [];

	const w = 1.9;
	const h = 2.72;
	const d = 0.24;
	const bevel = 0.08;

	vertices.push(
		-w / 2 + bevel, h / 2, d / 2,
		w / 2 - bevel, h / 2, d / 2,
		w / 2, h / 2 - bevel, d / 2,
		w / 2, -h / 2 + bevel, d / 2,
		w / 2 - bevel, -h / 2, d / 2,
		-w / 2 + bevel, -h / 2, d / 2,
		-w / 2, -h / 2 + bevel, d / 2,
		-w / 2, h / 2 - bevel, d / 2,
	);

	vertices.push(
		-w / 2 + bevel, h / 2, -d / 2,
		w / 2 - bevel, h / 2, -d / 2,
		w / 2, h / 2 - bevel, -d / 2,
		w / 2, -h / 2 + bevel, -d / 2,
		w / 2 - bevel, -h / 2, -d / 2,
		-w / 2 + bevel, -h / 2, -d / 2,
		-w / 2, -h / 2 + bevel, -d / 2,
		-w / 2, h / 2 - bevel, -d / 2,
	);

	indices.push(0, 1, 2, 0, 2, 7, 2, 3, 4, 2, 4, 5, 5, 6, 7, 5, 7, 2);
	indices.push(9, 8, 10, 10, 8, 15, 11, 10, 12, 12, 10, 13, 13, 14, 12, 14, 13, 11);
	indices.push(0, 8, 9, 0, 9, 1);
	indices.push(3, 11, 10, 3, 10, 2);
	indices.push(5, 13, 12, 5, 12, 4);
	indices.push(7, 15, 14, 7, 14, 6);

	geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
	geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
	geometry.computeVertexNormals();

	return geometry;
}

export default function Metal3DCard({ player, className = "" }: Metal3DCardProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const slabRef = useRef<THREE.Group | null>(null);
	const mousePosRef = useRef({ x: 0, y: 0 });

	useEffect(() => {
		if (!containerRef.current) return;

		const width = containerRef.current.clientWidth;
		const height = containerRef.current.clientHeight;

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
		camera.position.z = 3.5;

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setSize(width, height);
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		containerRef.current.appendChild(renderer.domElement);

		const slab = new THREE.Group();
		slabRef.current = slab;
		scene.add(slab);

		const metalConfig = rarityMetals[player.rarity];

		const bodyGeometry = createBeveledSlabGeometry();
		const bodyMaterial = new THREE.MeshStandardMaterial({
			color: metalConfig.rimColor,
			metalness: 0.95,
			roughness: 0.15,
			envMapIntensity: 1.6,
		});
		const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
		bodyMesh.castShadow = true;
		bodyMesh.receiveShadow = true;
		slab.add(bodyMesh);

		const faceGeometry = new THREE.BoxGeometry(1.75, 2.55, 0.08);
		const faceMaterial = new THREE.MeshStandardMaterial({
			color: metalConfig.metalColor,
			metalness: 0.85,
			roughness: 1 - metalConfig.glossiness,
			envMapIntensity: 1.8,
		});
		const faceMesh = new THREE.Mesh(faceGeometry, faceMaterial);
		faceMesh.position.z = 0.1;
		faceMesh.castShadow = true;
		faceMesh.receiveShadow = true;
		slab.add(faceMesh);

		const portraitGeometry = new THREE.BoxGeometry(1.72, 1.44, 0.06);
		const portraitBackMaterial = new THREE.MeshStandardMaterial({
			color: new THREE.Color(0x0a0a0a),
			metalness: 0.2,
			roughness: 0.6,
		});
		const portraitBackMesh = new THREE.Mesh(portraitGeometry, portraitBackMaterial);
		portraitBackMesh.position.set(0, 0.32, 0.12);
		portraitBackMesh.castShadow = true;
		portraitBackMesh.receiveShadow = true;
		slab.add(portraitBackMesh);

		const plateGeometry = new THREE.BoxGeometry(1.72, 0.72, 0.06);
		const plateMaterial = new THREE.MeshStandardMaterial({
			color: new THREE.Color(0x0f0f0f),
			metalness: 0.5,
			roughness: 0.25,
		});
		const plateMesh = new THREE.Mesh(plateGeometry, plateMaterial);
		plateMesh.position.set(0, -0.88, 0.12);
		plateMesh.castShadow = true;
		plateMesh.receiveShadow = true;
		slab.add(plateMesh);

		let portraitTexture: THREE.CanvasTexture | null = null;
		let plateTexture: THREE.CanvasTexture | null = null;
		let topLabelTexture: THREE.CanvasTexture | null = null;
		let portraitMaterialOverlay: THREE.MeshStandardMaterial | null = null;
		let plateMaterialOverlay: THREE.MeshStandardMaterial | null = null;
		let topLabelMaterial: THREE.MeshStandardMaterial | null = null;
		let portraitPlaneGeometry: THREE.PlaneGeometry | null = null;
		let platePlaneGeometry: THREE.PlaneGeometry | null = null;
		let topLabelGeometry: THREE.PlaneGeometry | null = null;

		Promise.all([createPortraitTexture(player), createPlateTexture(player), createTopLabelTexture(player)]).then(([pTex, plTex, tTex]) => {
			portraitTexture = pTex;
			plateTexture = plTex;
			topLabelTexture = tTex;

			portraitMaterialOverlay = new THREE.MeshStandardMaterial({
				map: portraitTexture,
				metalness: 0.25,
				roughness: 0.15,
			});
			portraitPlaneGeometry = new THREE.PlaneGeometry(1.72, 1.44);
			const portraitMesh = new THREE.Mesh(portraitPlaneGeometry, portraitMaterialOverlay);
			portraitMesh.position.set(0, 0.32, 0.16);
			portraitMesh.castShadow = true;
			slab.add(portraitMesh);

			plateMaterialOverlay = new THREE.MeshStandardMaterial({
				map: plateTexture,
				metalness: 0.35,
				roughness: 0.2,
			});
			platePlaneGeometry = new THREE.PlaneGeometry(1.72, 0.72);
			const plateMeshOverlay = new THREE.Mesh(platePlaneGeometry, plateMaterialOverlay);
			plateMeshOverlay.position.set(0, -0.88, 0.16);
			plateMeshOverlay.castShadow = true;
			slab.add(plateMeshOverlay);

			topLabelMaterial = new THREE.MeshStandardMaterial({
				map: topLabelTexture,
				metalness: 0.25,
				roughness: 0.15,
				transparent: true,
			});
			topLabelGeometry = new THREE.PlaneGeometry(1.72, 0.4);
			const topLabelMesh = new THREE.Mesh(topLabelGeometry, topLabelMaterial);
			topLabelMesh.position.set(0, 1.1, 0.16);
			topLabelMesh.castShadow = true;
			slab.add(topLabelMesh);
		});

		const patternTexture = createPatternTexture(512, 720, metalConfig.pattern, metalConfig.patternColor, metalConfig.patternOpacity);
		const patternMaterial = new THREE.MeshStandardMaterial({
			map: patternTexture,
			metalness: 0.4,
			roughness: 0.35,
			transparent: true,
		});
		const patternGeometry = new THREE.PlaneGeometry(1.75, 2.55);
		const patternMesh = new THREE.Mesh(patternGeometry, patternMaterial);
		patternMesh.position.z = 0.17;
		slab.add(patternMesh);

		let crownGeometry: THREE.BoxGeometry | null = null;
		let crownMaterial: THREE.MeshStandardMaterial | null = null;
		if (player.rarity === "legendary") {
			crownGeometry = new THREE.BoxGeometry(1.75, 0.2, 0.12);
			crownMaterial = new THREE.MeshStandardMaterial({
				color: new THREE.Color(0xffed4e),
				metalness: 0.98,
				roughness: 0.03,
				emissive: new THREE.Color(0xffed4e),
				emissiveIntensity: 0.4,
			});
			const crownMesh = new THREE.Mesh(crownGeometry, crownMaterial);
			crownMesh.position.set(0, 1.38, 0.12);
			crownMesh.castShadow = true;
			slab.add(crownMesh);
		}

		let edgeGeometry: THREE.BoxGeometry | null = null;
		let edgeMaterial: THREE.MeshStandardMaterial | null = null;
		if (player.rarity === "unique") {
			edgeGeometry = new THREE.BoxGeometry(1.8, 2.8, 0.04);
			edgeMaterial = new THREE.MeshStandardMaterial({
				color: new THREE.Color(0x00d4ff),
				metalness: 0.6,
				roughness: 0.15,
				emissive: new THREE.Color(0x00d4ff),
				emissiveIntensity: 0.35,
				transparent: true,
				opacity: 0.7,
			});
			const edgeMesh = new THREE.Mesh(edgeGeometry, edgeMaterial);
			edgeMesh.position.z = 0.19;
			slab.add(edgeMesh);
		}

		let sharpGeometry: THREE.BufferGeometry | null = null;
		let sharpMaterial: THREE.MeshStandardMaterial | null = null;
		if (player.rarity === "rare") {
			sharpGeometry = createBeveledSlabGeometry();
			sharpMaterial = new THREE.MeshStandardMaterial({
				color: metalConfig.rimColor,
				metalness: 0.92,
				roughness: 0.1,
			});
			const sharpMesh = new THREE.Mesh(sharpGeometry, sharpMaterial);
			sharpMesh.scale.set(1.04, 1.04, 1.08);
			sharpMesh.position.z = -0.02;
			slab.add(sharpMesh);
		}

		const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
		scene.add(ambientLight);

		const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
		keyLight.position.set(4, 5, 6);
		keyLight.castShadow = true;
		keyLight.shadow.mapSize.width = 2048;
		keyLight.shadow.mapSize.height = 2048;
		keyLight.shadow.camera.far = 20;
		scene.add(keyLight);

		const rimLight = new THREE.DirectionalLight(0x7fd6ff, 1.2);
		rimLight.position.set(-5, 3, 4);
		scene.add(rimLight);

		const fillLight = new THREE.PointLight(0xffd27a, 0.8, 15);
		fillLight.position.set(0, -2, 5);
		scene.add(fillLight);

		const backLight = new THREE.DirectionalLight(0x4a90e2, 0.6);
		backLight.position.set(0, 0, -6);
		scene.add(backLight);

		const handleMouseMove = (e: MouseEvent) => {
			if (!containerRef.current) return;
			const rect = containerRef.current.getBoundingClientRect();
			const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
			mousePosRef.current = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
		};

		containerRef.current.addEventListener("mousemove", handleMouseMove);

		let rafId = 0;
		const animate = () => {
			rafId = requestAnimationFrame(animate);
			if (slabRef.current) {
				slabRef.current.rotation.x = mousePosRef.current.y * 0.2;
				slabRef.current.rotation.y = mousePosRef.current.x * 0.2;
			}
			renderer.render(scene, camera);
		};
		animate();

		const handleResize = () => {
			const newWidth = containerRef.current?.clientWidth || width;
			const newHeight = containerRef.current?.clientHeight || height;
			camera.aspect = newWidth / newHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(newWidth, newHeight);
		};

		window.addEventListener("resize", handleResize);

		return () => {
			cancelAnimationFrame(rafId);
			if (containerRef.current) {
				containerRef.current.removeEventListener("mousemove", handleMouseMove);
				if (renderer.domElement.parentElement === containerRef.current) {
					containerRef.current.removeChild(renderer.domElement);
				}
			}
			window.removeEventListener("resize", handleResize);

			bodyGeometry.dispose();
			faceGeometry.dispose();
			portraitGeometry.dispose();
			plateGeometry.dispose();
			patternGeometry.dispose();
			crownGeometry?.dispose();
			edgeGeometry?.dispose();
			sharpGeometry?.dispose();
			portraitPlaneGeometry?.dispose();
			platePlaneGeometry?.dispose();
			topLabelGeometry?.dispose();

			bodyMaterial.dispose();
			faceMaterial.dispose();
			portraitBackMaterial.dispose();
			plateMaterial.dispose();
			patternMaterial.dispose();
			crownMaterial?.dispose();
			edgeMaterial?.dispose();
			sharpMaterial?.dispose();
			portraitMaterialOverlay?.dispose();
			plateMaterialOverlay?.dispose();
			topLabelMaterial?.dispose();

			patternTexture.dispose();
			portraitTexture?.dispose();
			plateTexture?.dispose();
			topLabelTexture?.dispose();
			renderer.dispose();
		};
	}, [
		player.id,
		player.name,
		player.rating,
		player.position,
		player.club,
		player.image,
		player.rarity,
		player.serial,
		player.maxSupply,
	]);

	useEffect(() => {
		mousePosRef.current = { x: 0, y: 0 };
	}, [player.id]);

	return <div ref={containerRef} className={`relative h-[364px] w-[260px] ${className}`} style={{ perspective: "1000px" }} />;
}
