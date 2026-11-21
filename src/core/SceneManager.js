import * as THREE from 'three';

/**
 * Canonical Court Dimensions (World Units)
 * Shared across rendering, movement clamping, ball physics, AI prediction, and line calls.
 */
export const COURT_CONFIG = {
  HALF_LENGTH: 12.0,           // Baselines at z = -12.0 (AI) and z = +12.0 (Player)
  SERVICE_LINE_Z: 6.4,         // Service lines at z = -6.4 and z = +6.4
  SINGLES_HALF_WIDTH: 5.0,     // Inner singles sidelines at x = ±5.0
  PLAYABLE_HALF_WIDTH: 6.5,    // Outer sidelines at x = ±6.5 (full arcade court width)
  LINE_WIDTH: 0.22,            // Thick bright white lines matching reference
  NET_HEIGHT: 1.05,            // Net top tape height
  NET_POST_X: 7.25,            // Green net posts outside sidelines
  APRON_HALF_WIDTH: 10.6,      // Inner edge of yellow border curb
  APRON_HALF_LENGTH: 15.6      // Inner Z edge of top/bottom border curb
};

/**
 * SceneManager
 * Owns the Three.js Scene, WebGLRenderer, Lighting, Quality Mode, and 3D Court/Stadium environment.
 */
export class SceneManager {
  constructor(container, assetManager) {
    this.container = container;
    this.assetManager = assetManager;
    this.qualityMode = 'high'; // 'high' | 'low'

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x158255);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.applyPixelRatio();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.appendChild(this.renderer.domElement);

    this.setupLights();
    this.buildCourtEnvironment();
  }

  applyPixelRatio() {
    const maxDpr = this.qualityMode === 'low' ? 1.0 : 2.0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  }

  setQualityMode(mode = 'high') {
    this.qualityMode = mode === 'low' ? 'low' : 'high';
    this.applyPixelRatio();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setupLights() {
    const hemiLight = new THREE.HemisphereLight(0xfff8eb, 0xb85225, 1.32);
    hemiLight.position.set(0, 25, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffdf6, 1.32);
    dirLight.position.set(-10, 24, 14);
    this.scene.add(dirLight);
  }

  buildCourtEnvironment() {
    this.courtGroup = new THREE.Group();
    this.scene.add(this.courtGroup);

    // 1. Outer Sandy-Orange Floor surrounding the yellow curb
    const outerFloorMat = new THREE.MeshStandardMaterial({
      color: 0xd97b38,
      roughness: 0.85
    });
    const outerFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(72, 58),
      outerFloorMat
    );
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.y = -0.05;
    this.courtGroup.add(outerFloor);

    // 2. Green Stadium Back Wall & Top Center Pillar (matching reference-gameplay)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x158859,
      roughness: 0.7
    });
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(72, 4.5, 2.0),
      wallMat
    );
    backWall.position.set(0, 1.8, -19.2);
    this.courtGroup.add(backWall);

    const wallTrim = new THREE.Mesh(
      new THREE.BoxGeometry(72, 0.35, 2.15),
      new THREE.MeshStandardMaterial({ color: 0x0f6843, roughness: 0.65 })
    );
    wallTrim.position.set(0, 0.15, -19.15);
    this.courtGroup.add(wallTrim);

    // Center stadium pole visible at top-center of reference-gameplay
    const stadiumPoleBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.62, 0.28, 16),
      new THREE.MeshStandardMaterial({ color: 0x7a8a82, roughness: 0.5 })
    );
    stadiumPoleBase.position.set(0, 0.14, -18.1);
    const stadiumPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.24, 3.8, 14),
      new THREE.MeshStandardMaterial({ color: 0x99aba2, roughness: 0.45 })
    );
    stadiumPole.position.set(0, 2.0, -18.1);
    this.courtGroup.add(stadiumPoleBase, stadiumPole);

    // 3. Textured Terracotta Inner Clay Playing Surface
    const clayMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.assetManager.textures.clay || null,
      roughness: 0.84
    });
    if (!this.assetManager.textures.clay) {
      clayMat.color.setHex(0xc95a2a);
    }
    const claySurface = new THREE.Mesh(
      new THREE.PlaneGeometry(
        COURT_CONFIG.APRON_HALF_WIDTH * 2,
        COURT_CONFIG.APRON_HALF_LENGTH * 2
      ),
      clayMat
    );
    claySurface.rotation.x = -Math.PI / 2;
    claySurface.position.y = 0.0;
    this.courtGroup.add(claySurface);

    // 4. Raised Cream-Yellow Perimeter Curb framing the clay court
    this.buildYellowPerimeterCurb();

    // 5. Crisp White Court Markings
    this.buildCourtLines();

    // 6. Central Tennis Net Assembly
    this.buildNetAssembly();

    // 7. Decorative Sideline Props (Umpire Chair, Coolers, Broadcast Cameras)
    this.buildSidelineProps();
  }

  buildYellowPerimeterCurb() {
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0xfce47e,
      roughness: 0.52
    });

    const curbThickness = 1.65;
    const curbHeight = 0.34;
    const innerW = COURT_CONFIG.APRON_HALF_WIDTH;
    const innerL = COURT_CONFIG.APRON_HALF_LENGTH;

    // Top bar (behind AI baseline)
    const topCurb = new THREE.Mesh(
      new THREE.BoxGeometry((innerW + curbThickness) * 2, curbHeight, curbThickness),
      curbMat
    );
    topCurb.position.set(0, curbHeight * 0.45, -(innerL + curbThickness * 0.5));
    this.courtGroup.add(topCurb);

    // Left curb
    const sideLength = (innerL + curbThickness) * 2;
    const leftCurb = new THREE.Mesh(
      new THREE.BoxGeometry(curbThickness, curbHeight, sideLength),
      curbMat
    );
    leftCurb.position.set(-(innerW + curbThickness * 0.5), curbHeight * 0.45, 0);
    this.courtGroup.add(leftCurb);

    // Right curb
    const rightCurb = leftCurb.clone();
    rightCurb.position.x = innerW + curbThickness * 0.5;
    this.courtGroup.add(rightCurb);

    // Subtle inner apron ambient occlusion shadow edge along top & side curbs
    const aoMat = new THREE.MeshBasicMaterial({
      color: 0x5c2008,
      transparent: true,
      opacity: 0.24,
      depthWrite: false
    });
    const topAo = new THREE.Mesh(
      new THREE.PlaneGeometry(innerW * 2, 0.45),
      aoMat
    );
    topAo.rotation.x = -Math.PI / 2;
    topAo.position.set(0, 0.008, -(innerL - 0.22));
    this.courtGroup.add(topAo);
  }

  buildCourtLines() {
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff
    });
    const lw = COURT_CONFIG.LINE_WIDTH;
    const halfL = COURT_CONFIG.HALF_LENGTH;
    const servZ = COURT_CONFIG.SERVICE_LINE_Z;
    const singlesW = COURT_CONFIG.SINGLES_HALF_WIDTH;
    const doublesW = COURT_CONFIG.PLAYABLE_HALF_WIDTH;

    const addLine = (width, length, x, z) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), lineMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.014, z);
      this.courtGroup.add(mesh);
    };

    // Baselines (top & bottom)
    addLine(doublesW * 2 + lw, lw, 0, -halfL);
    addLine(doublesW * 2 + lw, lw, 0, halfL);

    // Service lines (top & bottom, spanning singles court)
    addLine(singlesW * 2 + lw, lw, 0, -servZ);
    addLine(singlesW * 2 + lw, lw, 0, servZ);

    // Outer doubles sidelines (left & right)
    addLine(lw, halfL * 2 + lw, -doublesW, 0);
    addLine(lw, halfL * 2 + lw, doublesW, 0);

    // Inner singles sidelines (left & right)
    addLine(lw, halfL * 2 + lw, -singlesW, 0);
    addLine(lw, halfL * 2 + lw, singlesW, 0);

    // Center service line (between -servZ and +servZ)
    addLine(lw, servZ * 2, 0, 0);

    // Center baseline hash marks
    addLine(lw, 0.45, 0, -(halfL - 0.22));
    addLine(lw, 0.45, 0, halfL - 0.22);
  }

  buildNetAssembly() {
    const netSpan = COURT_CONFIG.NET_POST_X * 2;
    const netHeight = COURT_CONFIG.NET_HEIGHT;

    // Green Net Posts
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x2ea836,
      roughness: 0.38
    });
    const postCapMat = new THREE.MeshStandardMaterial({
      color: 0x45c94e,
      roughness: 0.28
    });
    const baseRingMat = new THREE.MeshStandardMaterial({
      color: 0x1e5c24,
      roughness: 0.5
    });
    const postGeo = new THREE.CylinderGeometry(0.18, 0.18, netHeight + 0.14, 16);

    [-COURT_CONFIG.NET_POST_X, COURT_CONFIG.NET_POST_X].forEach((xPos) => {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(xPos, (netHeight + 0.14) * 0.5, 0);
      this.courtGroup.add(post);

      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.21, 0.21, 0.08, 16),
        postCapMat
      );
      cap.position.set(xPos, netHeight + 0.14, 0);
      this.courtGroup.add(cap);

      const baseCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.28, 0.08, 16),
        baseRingMat
      );
      baseCollar.position.set(xPos, 0.04, 0);
      this.courtGroup.add(baseCollar);
    });

    // Translucent Net Mesh Plane
    const netMeshMat = new THREE.MeshBasicMaterial({
      map: this.assetManager.textures.net,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const netPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(netSpan - 0.2, netHeight - 0.12),
      netMeshMat
    );
    netPlane.position.set(0, (netHeight - 0.08) * 0.5, 0);
    this.courtGroup.add(netPlane);

    // Crisp White Top Tape Band
    const topTapeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const topTape = new THREE.Mesh(
      new THREE.BoxGeometry(netSpan - 0.15, 0.13, 0.09),
      topTapeMat
    );
    topTape.position.set(0, netHeight - 0.04, 0);
    this.courtGroup.add(topTape);

    // Dark Bottom Trim
    const bottomTrim = new THREE.Mesh(
      new THREE.BoxGeometry(netSpan - 0.2, 0.07, 0.07),
      new THREE.MeshBasicMaterial({ color: 0x1a1517 })
    );
    bottomTrim.position.set(0, 0.04, 0);
    this.courtGroup.add(bottomTrim);

    // Center White Net Strap
    const centerStrap = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, netHeight, 0.1),
      topTapeMat
    );
    centerStrap.position.set(0, netHeight * 0.5, 0);
    this.courtGroup.add(centerStrap);

    // Soft Ground Contact Shadow beneath Net
    const netShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(netSpan + 0.4, 0.55),
      new THREE.MeshBasicMaterial({
        color: 0x2a0f05,
        transparent: true,
        opacity: 0.3,
        depthWrite: false
      })
    );
    netShadow.rotation.x = -Math.PI / 2;
    netShadow.position.set(0.15, 0.012, -0.18);
    this.courtGroup.add(netShadow);
  }

  addPropShadow(x, z, radius = 1.35) {
    if (!this.assetManager.textures.shadow) return;
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(radius, radius),
      new THREE.MeshBasicMaterial({
        map: this.assetManager.textures.shadow,
        transparent: true,
        opacity: 0.65,
        depthWrite: false
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, 0.015, z);
    this.courtGroup.add(shadow);
  }

  buildSidelineProps() {
    // 1. Blue/White Cylindrical Coolers near net posts (matching reference)
    const buildCooler = (x, z) => {
      const cooler = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.46, 0.85, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 })
      );
      body.position.y = 0.45;

      const blueMat = new THREE.MeshStandardMaterial({
        color: 0x2c85e8,
        roughness: 0.4
      });
      const lid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.14, 16),
        blueMat
      );
      lid.position.y = 0.92;
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16),
        blueMat
      );
      base.position.y = 0.06;

      cooler.add(body, lid, base);
      cooler.position.set(x, 0, z);
      this.courtGroup.add(cooler);
      this.addPropShadow(x, z, 1.35);
    };

    buildCooler(-8.55, -0.2);
    buildCooler(8.55, 0.85);
    buildCooler(8.35, -3.55);

    // 2. Umpire High Chair & Canopy on Right Sideline
    const chairGroup = new THREE.Group();
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.4 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x3b9eff, roughness: 0.4 });
    const darkBlueMat = new THREE.MeshStandardMaterial({ color: 0x224170, roughness: 0.5 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xff70a6, roughness: 0.4 });

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 2.2, 14),
      whiteMat
    );
    pedestal.position.y = 1.1;

    const baseDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.9, 0.22, 16),
      darkBlueMat
    );
    baseDisc.position.y = 0.11;

    const stepRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.18, 16),
      darkBlueMat
    );
    stepRing.position.y = 1.05;

    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.18, 1.15),
      blueMat
    );
    seat.position.y = 2.2;

    const backrest = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.1, 1.15),
      blueMat
    );
    backrest.position.set(0.5, 2.75, 0);

    // Cute blocky umpire figure in the chair
    const umpireHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.75, 0.75),
      new THREE.MeshStandardMaterial({ color: 0xffe4c4, roughness: 0.5 })
    );
    umpireHead.position.set(-0.05, 2.75, 0);

    // Sun Canopy above umpire
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.14, 1.55),
      pinkMat
    );
    canopy.position.set(0.05, 3.85, 0);
    canopy.rotation.z = 0.12;

    const canopySupport = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.45, 0.12),
      whiteMat
    );
    canopySupport.position.set(0.55, 3.25, 0);

    chairGroup.add(
      pedestal,
      baseDisc,
      stepRing,
      seat,
      backrest,
      umpireHead,
      canopy,
      canopySupport
    );
    chairGroup.position.set(8.85, 0, -2.35);
    this.courtGroup.add(chairGroup);
    this.addPropShadow(8.85, -2.35, 2.2);

    // 3. Left & Right Broadcast Cameras outside the yellow curb
    const buildCameraRig = (x, z, rotY) => {
      const camRig = new THREE.Group();
      const standMat = new THREE.MeshStandardMaterial({ color: 0x6e6a6f, roughness: 0.6 });
      const standBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.72, 0.22, 14),
        standMat
      );
      standBase.position.y = 0.11;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 1.4, 12),
        standMat
      );
      pole.position.y = 0.8;
      const camBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.58, 0.95),
        whiteMat
      );
      camBody.position.y = 1.65;
      const lens = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.4, 0.35),
        new THREE.MeshStandardMaterial({ color: 0x1c1c21 })
      );
      lens.position.set(0, 1.65, 0.55);

      camRig.add(standBase, pole, camBody, lens);
      camRig.position.set(x, 0, z);
      camRig.rotation.y = rotY;
      this.courtGroup.add(camRig);
      this.addPropShadow(x, z, 1.6);
    };

    buildCameraRig(-13.8, -5.8, 0.65);
    buildCameraRig(13.8, -5.8, -0.65);

    // Freeze world matrices on all static court environment meshes to save CPU cycles every frame
    this.courtGroup.updateMatrixWorld(true);
    this.courtGroup.traverse((child) => {
      child.updateMatrix();
      child.matrixAutoUpdate = false;
    });
  }

  getRenderStats() {
    const info = this.renderer ? this.renderer.info : null;
    if (!info) {
      return { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 };
    }
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures
    };
  }

  onResize(width, height) {
    this.applyPixelRatio();
    this.renderer.setSize(width, height);
  }

  render(camera) {
    this.renderer.render(this.scene, camera);
  }
}
