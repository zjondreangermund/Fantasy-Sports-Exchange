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
			const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
			const drawW = img.width * scale;
			const drawH = img.height * scale;
			const dx = (canvas.width - drawW) / 2;
			const dy = (canvas.height - drawH) / 2;
			ctx.drawImage(img, dx, dy, drawW, drawH);
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

function computeStats(player: PlayerCardData) {
	const rating = Math.max(45, Math.min(99, Number(player.rating) || 70));
	const pos = String(player.position || "").toUpperCase();

	const atkBias = pos.includes("ST") || pos.includes("FW") ? 8 : pos.includes("MID") ? 4 : -2;
	const defBias = pos.includes("GK") || pos.includes("DEF") ? 9 : pos.includes("MID") ? 3 : -4;

	return [
		["ATK", Math.max(40, Math.min(99, rating + atkBias))],
		["VIS", Math.max(38, Math.min(99, Math.round(rating * 0.9)))],
		["CTL", Math.max(38, Math.min(99, Math.round(rating * 0.94 + 2)))],
		["DEF", Math.max(35, Math.min(99, rating + defBias))],
		["ENG", Math.max(40, Math.min(99, Math.round(rating * 0.82 + 12)))],
		["FRM", Math.max(40, Math.min(99, Math.round(rating * 0.78 + 10)))],
	];
}

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

function createStatsTexture(player: PlayerCardData): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = 512;
	canvas.height = 260;
	const ctx = canvas.getContext("2d")!;
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	const stats = computeStats(player);
	ctx.textAlign = "center";

	ctx.fillStyle = "#ffffff";
	ctx.font = "bold 34px Arial";
	ctx.fillText(player.name, canvas.width / 2, 42);

	ctx.fillStyle = "#b8bec8";
	ctx.font = "16px Arial";
	ctx.fillText(`${player.position} • ${player.club || "FantasyFC"}`, canvas.width / 2, 68);

	const startX = 92;
	const startY = 94;
	const boxW = 100;
	const boxH = 56;
	const gapX = 18;
	const gapY = 16;

	for (let i = 0; i < stats.length; i += 1) {
		const row = Math.floor(i / 3);
		const col = i % 3;
		const x = startX + col * (boxW + gapX);
		const y = startY + row * (boxH + gapY);

		ctx.fillStyle = "rgba(255,255,255,0.08)";
		roundRect(ctx, x, y, boxW, boxH, 12);
		ctx.fill();

		ctx.strokeStyle = "rgba(255,255,255,0.10)";
		ctx.lineWidth = 1;
		roundRect(ctx, x, y, boxW, boxH, 12);
		ctx.stroke();

		ctx.fillStyle = "#9ea6b2";
		ctx.font = "bold 14px Arial";
		ctx.fillText(String(stats[i][0]), x + boxW / 2, y + 18);

		ctx.fillStyle = "#ffffff";
		ctx.font = "bold 24px Arial";
		ctx.fillText(String(stats[i][1]), x + boxW / 2, y + 44);
	}

	ctx.fillStyle = "#8d95a1";
	ctx.font = "14px Arial";
	ctx.fillText(
		`#${String(player.serial || 1).padStart(3, "0")} / ${player.maxSupply || 500}`,
		canvas.width / 2,
		242,
	);

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

function createRoundedRectShape(width: number, height: number, radius: number) {
	const x = -width / 2;
	const y = -height / 2;
	const shape = new THREE.Shape();
	shape.moveTo(x + radius, y);
	shape.lineTo(x + width - radius, y);
	shape.quadraticCurveTo(x + width, y, x + width, y + radius);
	shape.lineTo(x + width, y + height - radius);
	shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	shape.lineTo(x + radius, y + height);
	shape.quadraticCurveTo(x, y + height, x, y + height - radius);
	shape.lineTo(x, y + radius);
	shape.quadraticCurveTo(x, y, x + radius, y);
	return shape;
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
		const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
		camera.position.set(0, 0, 4.6);

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

		const bodyShape = createRoundedRectShape(1.95, 2.78, 0.12);
		const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, {
			depth: 0.34,
			bevelEnabled: true,
			bevelSegments: 5,
			steps: 1,
			bevelSize: 0.04,
			bevelThickness: 0.045,
			curveSegments: 22,
		});
		bodyGeometry.center();
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

		const faceGeometry = new THREE.BoxGeometry(1.72, 2.5, 0.07);
		const faceMaterial = new THREE.MeshStandardMaterial({
			color: metalConfig.metalColor.clone().multiplyScalar(0.82),
			metalness: 0.92,
			roughness: 1 - metalConfig.glossiness + 0.08,
			envMapIntensity: 2.1,
		});
		const faceMesh = new THREE.Mesh(faceGeometry, faceMaterial);
		faceMesh.position.z = 0.11;
		faceMesh.castShadow = true;
		faceMesh.receiveShadow = true;
		slab.add(faceMesh);

		const portraitFrameGeometry = new THREE.BoxGeometry(1.8, 1.52, 0.05);
		const portraitFrameMaterial = new THREE.MeshStandardMaterial({
			color: metalConfig.rimColor.clone().multiplyScalar(0.9),
			metalness: 0.95,
			roughness: 0.12,
		});
		const portraitFrameMesh = new THREE.Mesh(portraitFrameGeometry, portraitFrameMaterial);
		portraitFrameMesh.position.set(0, 0.32, 0.135);
		portraitFrameMesh.castShadow = true;
		portraitFrameMesh.receiveShadow = true;
		slab.add(portraitFrameMesh);

		const portraitGeometry = new THREE.BoxGeometry(1.72, 1.44, 0.08);
		const portraitBackMaterial = new THREE.MeshStandardMaterial({
			color: new THREE.Color(0x0a0a0a),
			metalness: 0.2,
			roughness: 0.6,
		});
		const portraitBackMesh = new THREE.Mesh(portraitGeometry, portraitBackMaterial);
		portraitBackMesh.position.set(0, 0.3, 0.145);
		portraitBackMesh.castShadow = true;
		portraitBackMesh.receiveShadow = true;
		slab.add(portraitBackMesh);

		const infoStripGeometry = new THREE.BoxGeometry(1.78, 0.34, 0.05);
		const infoStripMaterial = new THREE.MeshStandardMaterial({
			color: new THREE.Color(0x101215),
			metalness: 0.65,
			roughness: 0.22,
		});
		const infoStripMesh = new THREE.Mesh(infoStripGeometry, infoStripMaterial);
		infoStripMesh.position.set(0, -1.06, 0.16);
		infoStripMesh.castShadow = true;
		infoStripMesh.receiveShadow = true;
		slab.add(infoStripMesh);

		let portraitTexture: THREE.CanvasTexture | null = null;
		let statsTexture: THREE.CanvasTexture | null = null;
		let topLabelTexture: THREE.CanvasTexture | null = null;
		let portraitMaterialOverlay: THREE.MeshStandardMaterial | null = null;
		let statsMaterialOverlay: THREE.MeshStandardMaterial | null = null;
		let topLabelMaterial: THREE.MeshStandardMaterial | null = null;
		let portraitPlaneGeometry: THREE.PlaneGeometry | null = null;
		let statsPlaneGeometry: THREE.PlaneGeometry | null = null;
		let topLabelGeometry: THREE.PlaneGeometry | null = null;

		Promise.all([createPortraitTexture(player), createStatsTexture(player), createTopLabelTexture(player)]).then(([pTex, sTex, tTex]) => {
			portraitTexture = pTex;
			statsTexture = sTex;
			topLabelTexture = tTex;

			portraitMaterialOverlay = new THREE.MeshStandardMaterial({
				map: portraitTexture,
				metalness: 0.25,
				roughness: 0.15,
				transparent: true,
				depthWrite: false,
				polygonOffset: true,
				polygonOffsetFactor: -2,
				polygonOffsetUnits: -2,
			});
			portraitPlaneGeometry = new THREE.PlaneGeometry(1.72, 1.44);
			const portraitMesh = new THREE.Mesh(portraitPlaneGeometry, portraitMaterialOverlay);
			portraitMesh.position.set(0, 0.3, 0.182);
			portraitMesh.castShadow = true;
			slab.add(portraitMesh);

			statsMaterialOverlay = new THREE.MeshStandardMaterial({
				map: statsTexture,
				metalness: 0.2,
				roughness: 0.18,
				transparent: true,
				depthWrite: false,
				polygonOffset: true,
				polygonOffsetFactor: -2,
				polygonOffsetUnits: -2,
			});
			statsPlaneGeometry = new THREE.PlaneGeometry(1.74, 0.88);
			const statsMesh = new THREE.Mesh(statsPlaneGeometry, statsMaterialOverlay);
			statsMesh.position.set(0, -0.78, 0.19);
			slab.add(statsMesh);

			topLabelMaterial = new THREE.MeshStandardMaterial({
				map: topLabelTexture,
				metalness: 0.25,
				roughness: 0.15,
				transparent: true,
				depthWrite: false,
				polygonOffset: true,
				polygonOffsetFactor: -2,
				polygonOffsetUnits: -2,
			});
			topLabelGeometry = new THREE.PlaneGeometry(1.72, 0.4);
			const topLabelMesh = new THREE.Mesh(topLabelGeometry, topLabelMaterial);
			topLabelMesh.position.set(0, 1.12, 0.19);
			topLabelMesh.castShadow = true;
			slab.add(topLabelMesh);
		});

		const patternTexture = createPatternTexture(512, 720, metalConfig.pattern, metalConfig.patternColor, metalConfig.patternOpacity);
		const patternMaterial = new THREE.MeshStandardMaterial({
			map: patternTexture,
			metalness: 0.4,
			roughness: 0.35,
			transparent: true,
			depthWrite: false,
			polygonOffset: true,
			polygonOffsetFactor: -2,
			polygonOffsetUnits: -2,
		});
		const patternGeometry = new THREE.PlaneGeometry(1.75, 2.55);
		const patternMesh = new THREE.Mesh(patternGeometry, patternMaterial);
		patternMesh.position.z = 0.172;
		slab.add(patternMesh);

		const shineMaterial = new THREE.MeshStandardMaterial({
			color: new THREE.Color(0xffffff),
			transparent: true,
			opacity: player.rarity === "common" ? 0.08 : 0.16,
			metalness: 0.1,
			roughness: 0.05,
			depthWrite: false,
			polygonOffset: true,
			polygonOffsetFactor: -2,
			polygonOffsetUnits: -2,
		});
		const shineGeometry = new THREE.PlaneGeometry(0.42, 2.3);
		const shineMesh = new THREE.Mesh(shineGeometry, shineMaterial);
		shineMesh.position.set(-0.32, 0, 0.19);
		shineMesh.rotation.z = -0.28;
		slab.add(shineMesh);

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
				slabRef.current.rotation.x += (mousePosRef.current.y * 0.11 - slabRef.current.rotation.x) * 0.08;
				slabRef.current.rotation.y += (mousePosRef.current.x * 0.14 - slabRef.current.rotation.y) * 0.08;
			}
			shineMesh.position.x = -0.32 + Math.sin(performance.now() * 0.0012) * 0.08;
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
			portraitFrameGeometry.dispose();
			portraitGeometry.dispose();
			infoStripGeometry.dispose();
			patternGeometry.dispose();
			shineGeometry.dispose();
			crownGeometry?.dispose();
			edgeGeometry?.dispose();
			sharpGeometry?.dispose();
			portraitPlaneGeometry?.dispose();
			statsPlaneGeometry?.dispose();
			topLabelGeometry?.dispose();

			bodyMaterial.dispose();
			faceMaterial.dispose();
			portraitFrameMaterial.dispose();
			portraitBackMaterial.dispose();
			infoStripMaterial.dispose();
			patternMaterial.dispose();
			shineMaterial.dispose();
			crownMaterial?.dispose();
			edgeMaterial?.dispose();
			sharpMaterial?.dispose();
			portraitMaterialOverlay?.dispose();
			statsMaterialOverlay?.dispose();
			topLabelMaterial?.dispose();

			patternTexture.dispose();
			portraitTexture?.dispose();
			statsTexture?.dispose();
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
