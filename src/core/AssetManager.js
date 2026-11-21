import * as THREE from 'three';

export const CHARACTER_ROSTER = {
  angel: {
    id: 'angel',
    name: 'PINK ANGEL',
    shortName: 'ANGEL',
    badgeText: 'ANGEL (YOU)',
    role: 'All-Rounder',
    moveSpeed: 9.8,
    accentHex: '#ff6ec7',
    unlocked: true,
    unlockLevel: 1,
    unlockCondition: 'Starter Champion',
    previewDesc: 'Balanced Chibi Angel • Golden Halo & Wing Drive',
    stats: { speed: 85, power: 85, control: 92 }
  },
  sky_angel: {
    id: 'sky_angel',
    name: 'STARLIGHT',
    shortName: 'STARLIGHT',
    badgeText: 'STARLIGHT (YOU)',
    role: 'Speedster',
    moveSpeed: 10.5,
    accentHex: '#0fbcf9',
    unlocked: true,
    unlockLevel: 1,
    unlockCondition: 'Starter Champion',
    previewDesc: 'High-Speed Sky Angel • Rapid Court Coverage',
    stats: { speed: 98, power: 78, control: 88 }
  },
  sunny_duck: {
    id: 'sunny_duck',
    name: 'SUNNY DUCK',
    shortName: 'PRO DUCK',
    badgeText: 'PRO DUCK (YOU)',
    role: 'Power Striker',
    moveSpeed: 9.4,
    accentHex: '#ffd43b',
    unlocked: true,
    unlockLevel: 1,
    unlockCondition: 'Starter Champion',
    previewDesc: 'Golden Crown Duck • Heavy Baseline Striker',
    stats: { speed: 80, power: 96, control: 84 }
  },
  seraph: {
    id: 'seraph',
    name: 'SERAPHINA',
    shortName: 'SERAPH',
    badgeText: 'SERAPH (YOU)',
    role: 'Celestial Ace',
    moveSpeed: 10.7,
    accentHex: '#a55eea',
    unlocked: false,
    unlockLevel: 2,
    unlockCondition: 'Unlock at Level 2',
    previewDesc: 'Royal Celestial Angel • Golden Wings & Elite Precision',
    stats: { speed: 96, power: 94, control: 98 }
  }
};

/**
 * AssetManager
 * Provides procedural textures, shared materials, and replaceable 3D character/prop factories.
 * Documents active procedural placeholders per PRD Section 6 & PLAN Section 2.
 */
export class AssetManager {
  static PLACEHOLDER_MANIFEST = [
    {
      id: 'character_angel',
      type: 'Procedural 3D Hierarchical Chibi Rig',
      replacementPath: '/models/characters/angel.glb',
      description: 'Chibi pink Tennis Angel with visor, skirt trim, articulated wings, floating gold halo, head/torso pivots, and racket'
    },
    {
      id: 'character_sky_angel',
      type: 'Procedural 3D Hierarchical Chibi Rig',
      replacementPath: '/models/characters/sky_angel.glb',
      description: 'Chibi cyan Starlight Angel with cyan/white outfit, wings, golden halo, and cyan racket'
    },
    {
      id: 'character_duck',
      type: 'Procedural 3D Hierarchical Chibi Rig',
      replacementPath: '/models/characters/duck.glb',
      description: 'Chibi yellow Duck character with glasses, orange bill, top tuft, sporty jersey trim, head/torso pivots, and racket'
    },
    {
      id: 'court_clay',
      type: 'Procedural 3D Court & Sideline Props',
      replacementPath: '/models/court/court.glb',
      description: 'Textured terracotta clay court, thick white lines, yellow border curb, green net posts, umpire chair, and stadium backdrop'
    }
  ];

  constructor() {
    this.textures = {};
    this.materials = {};
  }

  async init(onProgress) {
    if (onProgress) onProgress(0.25);
    this.textures.glow = this.createGlowTexture();
    this.textures.shadow = this.createShadowTexture();
    this.textures.net = this.createNetTexture();
    this.textures.clay = this.createClayTexture();
    if (onProgress) onProgress(1.0);
    return true;
  }

  createGlowTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(
      size * 0.5,
      size * 0.5,
      size * 0.05,
      size * 0.5,
      size * 0.5,
      size * 0.5
    );
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.32, 'rgba(255, 130, 230, 0.85)');
    grad.addColorStop(0.65, 'rgba(255, 70, 190, 0.32)');
    grad.addColorStop(1.0, 'rgba(255, 70, 190, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  createShadowTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(
      size * 0.5,
      size * 0.5,
      size * 0.08,
      size * 0.5,
      size * 0.5,
      size * 0.48
    );
    grad.addColorStop(0.0, 'rgba(35, 12, 4, 0.58)');
    grad.addColorStop(0.65, 'rgba(35, 12, 4, 0.3)');
    grad.addColorStop(1.0, 'rgba(35, 12, 4, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  createNetTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(22, 18, 20, 0.38)';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(14, 10, 12, 0.86)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(46, 4);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Generates a subtle terracotta clay surface texture with gentle rolled-clay lanes
   * and fine mineral speckles while preserving high contrast with white court lines.
   */
  createClayTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#c95a2a';
    ctx.fillRect(0, 0, size, size);

    // Subtle alternating rolled-clay bands
    ctx.fillStyle = 'rgba(255, 210, 170, 0.035)';
    ctx.fillRect(0, 0, size * 0.5, size);

    // Fine clay grain speckles
    for (let i = 0; i < 900; i++) {
      const x = (i * 73) % size;
      const y = (i * 139) % size;
      ctx.fillStyle =
        i % 2 === 0 ? 'rgba(255, 220, 185, 0.05)' : 'rgba(85, 28, 8, 0.055)';
      ctx.fillRect(x, y, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 8);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Builds a procedural 3D tennis racket attached to a pivot group.
   */
  createRacketMesh(accentColor = 0xff49b8) {
    const racketGroup = new THREE.Group();

    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x2b2528,
      roughness: 0.6
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.3,
      metalness: 0.12
    });
    const stringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });

    // Grip handle
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.052, 0.36, 10),
      handleMat
    );
    handle.position.y = 0.18;
    racketGroup.add(handle);

    // Throat
    const throat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.04, 0.22, 8),
      frameMat
    );
    throat.position.y = 0.44;
    racketGroup.add(throat);

    // Oval head frame
    const headRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.04, 10, 24),
      frameMat
    );
    headRing.position.y = 0.8;
    headRing.scale.set(0.85, 1.12, 1.0);
    racketGroup.add(headRing);

    // Strings plane
    const strings = new THREE.Mesh(
      new THREE.CircleGeometry(0.26, 20),
      stringMat
    );
    strings.position.y = 0.8;
    strings.scale.set(0.82, 1.08, 1.0);
    racketGroup.add(strings);

    return racketGroup;
  }

  /**
   * Builds an original blocky/chibi 3D character inspired by reference-gameplay,
   * upgraded with hierarchical head/torso/arm pivots for Phase 4 animations.
   * @param {'angel' | 'sky_angel' | 'sunny_duck' | 'duck'} type
   */
  createChibiCharacter(type = 'angel') {
    const root = new THREE.Group();
    const visualGroup = new THREE.Group();
    root.add(visualGroup);

    const headGroup = new THREE.Group();
    visualGroup.add(headGroup);

    // Soft ground shadow disc
    const shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8),
      new THREE.MeshBasicMaterial({
        map: this.textures.shadow,
        transparent: true,
        depthWrite: false
      })
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.02;
    root.add(shadowMesh);

    const isAngelVariant = type === 'angel' || type === 'sky_angel' || type === 'seraph';
    const isPlayerSide = type !== 'duck';

    if (isAngelVariant) {
      const isSky = type === 'sky_angel';
      const isSeraph = type === 'seraph';
      const primaryMat = new THREE.MeshStandardMaterial({
        color: isSeraph ? 0xa55eea : isSky ? 0x0fbcf9 : 0xff7ec4,
        roughness: 0.38
      });
      const lightMat = new THREE.MeshStandardMaterial({
        color: isSeraph ? 0xe8cff8 : isSky ? 0x8cf4ff : 0xffb3df,
        roughness: 0.34
      });
      const whiteMat = new THREE.MeshStandardMaterial({
        color: isSeraph ? 0xfff3bf : 0xffffff,
        roughness: 0.28
      });
      const haloMat = new THREE.MeshStandardMaterial({
        color: isSky ? 0x72f2ff : 0xffdf4d,
        emissive: isSky ? 0x00d2d3 : 0xffb700,
        emissiveIntensity: isSeraph ? 0.72 : 0.55,
        roughness: 0.22
      });

      // Lower body torso & white pleated tennis skirt trim
      const bodyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.66, 0.78),
        primaryMat
      );
      bodyMesh.position.y = 0.43;
      visualGroup.add(bodyMesh);

      const skirtTrim = new THREE.Mesh(
        new THREE.BoxGeometry(0.98, 0.16, 0.84),
        whiteMat
      );
      skirtTrim.position.y = 0.2;
      visualGroup.add(skirtTrim);

      // Cute star emblem on back of jersey (+Z faces camera)
      const backEmblem = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.24, 0.05),
        haloMat
      );
      backEmblem.position.set(0, 0.48, 0.39);
      backEmblem.rotation.z = Math.PI / 4;
      visualGroup.add(backEmblem);

      // Free balance arm (left side)
      const leftArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.38, 0.2),
        lightMat
      );
      leftArm.position.set(-0.56, 0.52, 0);
      leftArm.rotation.z = 0.22;
      visualGroup.add(leftArm);

      // Chibi blocky head inside headGroup pivot
      headGroup.position.set(0, 1.12, 0);
      const headMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.06, 0.88, 0.92),
        lightMat
      );
      headGroup.add(headMesh);

      // White tennis headband ribbon around head
      const headband = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.13, 0.96),
        whiteMat
      );
      headband.position.y = 0.24;
      headGroup.add(headband);

      // Cute side hair / ear puffs
      const leftPuff = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.3, 0.3),
        primaryMat
      );
      leftPuff.position.set(-0.58, 0.12, 0);
      headGroup.add(leftPuff);

      const rightPuff = leftPuff.clone();
      rightPuff.position.x = 0.58;
      headGroup.add(rightPuff);

      // Floating Halo above head
      const haloMesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.43, 0.068, 12, 28),
        haloMat
      );
      haloMesh.rotation.x = Math.PI / 2;
      haloMesh.position.set(0, 0.68, 0);
      headGroup.add(haloMesh);

      // Angel wings on the back (+Z local side)
      const leftWing = new THREE.Group();
      const wingMain = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.33, 0.14),
        whiteMat
      );
      wingMain.position.set(-0.22, 0.06, 0);
      const wingTip = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.23, 0.12),
        whiteMat
      );
      wingTip.position.set(-0.34, 0.22, 0);
      leftWing.add(wingMain, wingTip);
      leftWing.position.set(-0.24, 0.78, 0.45);
      leftWing.rotation.y = 0.28;
      leftWing.rotation.z = -0.18;
      visualGroup.add(leftWing);

      const rightWing = new THREE.Group();
      const rWingMain = wingMain.clone();
      rWingMain.position.x = 0.22;
      const rWingTip = wingTip.clone();
      rWingTip.position.x = 0.34;
      rightWing.add(rWingMain, rWingTip);
      rightWing.position.set(0.24, 0.78, 0.45);
      rightWing.rotation.y = -0.28;
      rightWing.rotation.z = 0.18;
      visualGroup.add(rightWing);

      // Cute tennis shoes
      const footGeo = new THREE.BoxGeometry(0.28, 0.16, 0.4);
      const leftFoot = new THREE.Mesh(footGeo, whiteMat);
      leftFoot.position.set(-0.26, 0.08, 0);
      const rightFoot = new THREE.Mesh(footGeo, whiteMat);
      rightFoot.position.set(0.26, 0.08, 0);
      visualGroup.add(leftFoot, rightFoot);

      root.userData = {
        characterType: type,
        visualGroup,
        headGroup,
        bodyMesh,
        leftArm,
        haloMesh,
        leftWing,
        rightWing,
        leftFoot,
        rightFoot
      };
    } else {
      // Yellow Chibi Duck ('duck' for AI facing +Z, or 'sunny_duck' for Player facing -Z)
      const faceSign = isPlayerSide ? -1 : 1;
      const yellowMat = new THREE.MeshStandardMaterial({
        color: 0xffd426,
        roughness: 0.38
      });
      const beakMat = new THREE.MeshStandardMaterial({
        color: 0xff7714,
        roughness: 0.34
      });
      const darkMat = new THREE.MeshStandardMaterial({
        color: 0x18181b,
        roughness: 0.24
      });
      const lensMat = new THREE.MeshStandardMaterial({
        color: 0xfef9c3,
        roughness: 0.18
      });
      const trimMat = new THREE.MeshStandardMaterial({
        color: isPlayerSide ? 0xff5e1a : 0x2ea836,
        roughness: 0.35
      });

      const bodyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.94, 0.65, 0.82),
        yellowMat
      );
      bodyMesh.position.y = 0.4;
      visualGroup.add(bodyMesh);

      const jerseyBand = new THREE.Mesh(
        new THREE.BoxGeometry(0.98, 0.15, 0.86),
        trimMat
      );
      jerseyBand.position.y = 0.22;
      visualGroup.add(jerseyBand);

      const leftArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.36, 0.22),
        yellowMat
      );
      leftArm.position.set(isPlayerSide ? -0.56 : 0.56, 0.5, 0);
      leftArm.rotation.z = isPlayerSide ? 0.22 : -0.22;
      visualGroup.add(leftArm);

      headGroup.position.set(0, 1.08, 0);
      const headMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, 0.88, 0.94),
        yellowMat
      );
      headGroup.add(headMesh);

      // Top hair/feather tuft
      const tuft = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.28, 0.22),
        yellowMat
      );
      tuft.position.set(0, 0.54, 0);
      tuft.rotation.z = 0.22;
      headGroup.add(tuft);

      // Orange Duck Beak on front face
      const beak = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.18, 0.25),
        beakMat
      );
      beak.position.set(0, -0.14, 0.52 * faceSign);
      headGroup.add(beak);

      // Black-framed Glasses on front face
      const glassesGroup = new THREE.Group();
      const frameGeo = new THREE.BoxGeometry(0.38, 0.28, 0.08);
      const lensGeo = new THREE.BoxGeometry(0.28, 0.18, 0.09);

      const leftFrame = new THREE.Mesh(frameGeo, darkMat);
      leftFrame.position.x = -0.24;
      const leftLens = new THREE.Mesh(lensGeo, lensMat);
      leftLens.position.x = -0.24;

      const rightFrame = new THREE.Mesh(frameGeo, darkMat);
      rightFrame.position.x = 0.24;
      const rightLens = new THREE.Mesh(lensGeo, lensMat);
      rightLens.position.x = 0.24;

      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.06, 0.08),
        darkMat
      );
      const pupilGeo = new THREE.BoxGeometry(0.09, 0.11, 0.1);
      const leftPupil = new THREE.Mesh(pupilGeo, darkMat);
      leftPupil.position.set(-0.22, 0, 0.01 * faceSign);
      const rightPupil = new THREE.Mesh(pupilGeo, darkMat);
      rightPupil.position.set(0.22, 0, 0.01 * faceSign);

      glassesGroup.add(
        leftFrame,
        leftLens,
        rightFrame,
        rightLens,
        bridge,
        leftPupil,
        rightPupil
      );
      glassesGroup.position.set(0, 0.07, 0.47 * faceSign);
      headGroup.add(glassesGroup);

      // Duck feet
      const footGeo = new THREE.BoxGeometry(0.3, 0.14, 0.42);
      const leftFoot = new THREE.Mesh(footGeo, beakMat);
      leftFoot.position.set(-0.26, 0.07, 0.05 * faceSign);
      const rightFoot = new THREE.Mesh(footGeo, beakMat);
      rightFoot.position.set(0.26, 0.07, 0.05 * faceSign);
      visualGroup.add(leftFoot, rightFoot);

      root.userData = {
        characterType: type,
        visualGroup,
        headGroup,
        bodyMesh,
        leftArm,
        tuft,
        leftFoot,
        rightFoot
      };
    }

    // Articulated Racket Pivot attached to character shoulder height
    const racketPivot = new THREE.Group();
    racketPivot.position.set(isPlayerSide ? 0.62 : -0.62, 0.78, 0);

    const racketColor =
      type === 'sky_angel'
        ? 0x0fbcf9
        : type === 'sunny_duck'
        ? 0xff7b00
        : isPlayerSide
        ? 0xff49b8
        : 0x2ea836;
    const racketMesh = this.createRacketMesh(racketColor);
    racketMesh.rotation.z = isPlayerSide ? -0.45 : 0.45;
    racketMesh.rotation.x = isPlayerSide ? -0.35 : 0.35;
    racketPivot.add(racketMesh);
    visualGroup.add(racketPivot);

    root.userData.racketPivot = racketPivot;
    root.userData.racketMesh = racketMesh;
    root.userData.shadowMesh = shadowMesh;

    return root;
  }
}
