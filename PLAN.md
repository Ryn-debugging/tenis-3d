# TENNIS ANGEL --- DEVELOPMENT PLAN

**Version:** 1.0\
**Genre:** 3D Arcade Tennis\
**Platform:** Mobile Web / Android Browser\
**Stack:** HTML5, CSS3, JavaScript ES Modules, Three.js, Vite,
Howler.js\
**Orientation:** Landscape

## 1. Project Objective

Build a complete, playable, colorful 3D arcade tennis game for mobile
browsers. Use the user's supplied reference image as the primary visual
direction: orange court, thick white lines, elevated angled top-down
camera, cute chibi characters, glowing ball, rainbow trail, and large
hit feedback such as PERFECT.

The reference is visual inspiration only. Create original characters,
assets, UI, and branding; do not copy proprietary characters, artwork,
or code.

## 2. Development Principles

1.  Build gameplay before decorative polish.
2.  Deliver a playable match before adding progression or story content.
3.  Keep rendering, input, physics, AI, scoring, and UI in separate
    modules.
4.  Test each milestone before moving to the next.
5.  Optimize for mobile browsers from the beginning.
6.  Do not create fake buttons or static mockups in place of gameplay.
7.  Use temporary procedural 3D assets only when final assets are
    unavailable, and document them.
8.  Preserve working features; avoid unnecessary rewrites.
9.  Report honestly what has and has not been tested.
10. Keep a living TODO list and record known bugs.

## 3. Recommended Stack

-   **HTML5/CSS3:** document structure and interface.
-   **JavaScript ES Modules:** game logic.
-   **Three.js:** 3D scene, camera, materials, lighting, models, and
    effects.
-   **Vite:** local development server and production build.
-   **Howler.js:** music and sound effects.
-   **LocalStorage:** settings and local progression.
-   **GLB/GLTF:** optional 3D character and environment assets.

Avoid adding frameworks or dependencies unless there is a clear
technical need.

## 4. Project Structure

``` text
tennis-angel/
├── index.html
├── package.json
├── vite.config.js
├── PRD.md
├── PLAN.md
├── reference-gameplay.png
├── public/
│   ├── models/
│   │   ├── characters/
│   │   ├── court/
│   │   └── equipment/
│   ├── textures/
│   ├── audio/
│   └── icons/
└── src/
    ├── main.js
    ├── core/
    │   ├── GameManager.js
    │   ├── SceneManager.js
    │   ├── CameraManager.js
    │   └── AssetManager.js
    ├── gameplay/
    │   ├── MatchManager.js
    │   ├── PlayerController.js
    │   ├── AIController.js
    │   ├── BallController.js
    │   ├── BallPhysics.js
    │   ├── RacketController.js
    │   ├── ShotSystem.js
    │   └── TennisScoring.js
    ├── controls/
    │   ├── InputManager.js
    │   ├── TouchController.js
    │   └── VirtualJoystick.js
    ├── effects/
    │   ├── EffectManager.js
    │   ├── BallTrail.js
    │   └── ParticleManager.js
    ├── ui/
    │   ├── MainMenu.js
    │   ├── MatchHUD.js
    │   ├── PauseMenu.js
    │   └── ResultsScreen.js
    ├── systems/
    │   ├── AudioManager.js
    │   └── SaveManager.js
    └── styles/
        ├── main.css
        ├── menu.css
        └── gameplay.css
```

The agent may adjust this structure if it documents why and keeps
modules cohesive.

## 5. Phased Roadmap

### Phase 0 --- Project Foundation

Tasks: - Inspect the workspace and read `PRD.md`, `PLAN.md`, and
`reference-gameplay.png`. - Initialize Vite. - Install and configure
Three.js. - Create the entry point and responsive page shell. -
Configure landscape gameplay layout and resize handling. - Create a
basic loading state. - Confirm the project runs without console errors.

**Exit criteria:** `npm install` and `npm run dev` work; the browser
displays a functioning Three.js scene.

### Phase 1 --- Core 3D Match

Tasks: - Build an orange tennis court with accurate playable boundaries
and white lines. - Add net and elevated angled top-down camera. - Add
simple 3D player and opponent placeholders. - Add a tennis ball. -
Implement stable ball movement, bounce, net and court collision. -
Implement racket hit detection and shot trajectory. - Implement player
movement and basic AI movement. - Make a rally possible from serve to
point completion.

**Exit criteria:** a player can serve and return the ball; AI can move
to the predicted landing area and return it; points can end reliably. Do
not proceed until this works.

### Phase 2 --- Mobile Input

Tasks: - Add virtual joystick on the left. - Add HIT and POWER buttons
on the right. - Add LOB and SMASH if the core controls remain clear. -
Add SERVE state and action. - Support simultaneous touch input with
Pointer Events. - Prevent page scrolling/zoom gestures over the game
surface. - Handle screen resize, orientation changes, and safe areas.

**Exit criteria:** a complete match can be played on an Android
touchscreen without keyboard input.

### Phase 3 --- Arcade Timing and Rules

Tasks: - Implement configurable PERFECT, GOOD, and MISS timing
windows. - Make timing affect power, accuracy, and trajectory. - Add
serve, rally, point, round, and match state transitions. - Implement the
default arcade match: first to 7 points, win by 2, best of 3 rounds. -
Add clear score and hit feedback.

**Exit criteria:** timing outcomes are understandable and scoring/match
completion are correct.

### Phase 4 --- Visual Identity and Feedback

Tasks: - Replace or improve placeholders with original chibi-style
characters. - Add readable running, idle, serve, forehand, backhand, and
smash animations. - Add glowing ball material. - Add fading rainbow
trail on perfect shots. - Add impact particles and restrained camera
shake. - Add animated PERFECT, GOOD, MISS, ACE, WIN, and LOSE
feedback. - Match the supplied reference's bright, playful visual
direction.

**Exit criteria:** visual effects communicate shot quality without
hiding the ball or court.

### Phase 5 --- UI and Match Flow

Tasks: - Main menu. - Character selection for available characters. -
Difficulty selection. - Match HUD. - Pause/resume/restart. - Results
screen. - Settings for sound and graphics. - Ensure every visible
control works.

**Exit criteria:** user can launch, configure, play, pause, finish,
replay, and return to menu.

### Phase 6 --- Progression (After MVP)

Tasks: - Local coins and rewards. - Character unlocks. - Match
statistics. - Tournament progression. - Save versioning and safe
loading.

**Exit criteria:** progression persists across browser reloads and
corrupted save data does not crash the game.

### Phase 7 --- Audio and PWA

Tasks: - Racket impact, bounce, net, perfect hit, power shot, UI,
victory, and defeat sounds. - Background music and separate volume
settings. - Add web app manifest and icons. - Add service worker and
carefully cache required assets. - Provide graceful offline behavior
after assets have been cached.

**Exit criteria:** audio controls work; PWA installation works on
supported browsers; offline behavior is tested and documented.

### Phase 8 --- Optimization and Release Testing

Tasks: - Test on real Android devices, not only desktop emulation. - Add
adaptive pixel ratio and graphics quality. - Optimize geometry,
textures, particles, shadows, and draw calls. - Avoid per-frame object
allocations where practical. - Check memory use and long-session
stability. - Test touch controls, orientation changes, pause/resume, and
reload. - Fix all critical and major gameplay bugs.

**Targets:** aim for 60 FPS on capable devices and a stable 30 FPS
fallback on weaker devices. Treat these as targets to measure, not
guarantees.

## 6. Required Test Matrix

  Area          Test
  ------------- ---------------------------------------------------
  Startup       Page loads with no critical console errors
  Rendering     Court, net, players, and ball are visible
  Movement      Player stays within allowed court area
  Physics       Ball bounce and net collision are consistent
  Racket        Valid contact produces a shot
  AI            AI predicts, moves, and returns reachable balls
  Timing        PERFECT/GOOD/MISS change shot result
  Scoring       Points, rounds, and match winner are correct
  Touch         Joystick and action buttons work simultaneously
  Lifecycle     Pause, resume, restart, and menu transitions work
  Responsive    Layout survives resize and orientation changes
  Performance   Test sustained play on real target devices

## 7. Working Agreement for the AI Developer

At the start: 1. Inspect the repository. 2. Read all project documents.
3. Inspect the supplied reference image. 4. Explain the architecture and
implementation sequence. 5. Create a concise TODO checklist.

For each phase: 1. Implement only the current phase and necessary
dependencies. 2. Run the project and relevant tests. 3. Fix errors
before continuing. 4. Report files created or changed. 5. Report tests
actually performed and their results. 6. List remaining bugs and missing
assets. 7. Update TODO and phase status.

Do not claim a feature is complete unless it has been exercised. If
automated browser/device testing is unavailable, state that limitation
and provide manual test steps.

## 8. First Milestone

The first milestone is **one complete playable rally and point** with: -
One player at the bottom. - One AI opponent at the top. - One orange 3D
court and net. - Ball movement and bounce. - Working racket contact. -
Player movement. - AI prediction and return. - Point end detection.

Do not spend the first milestone building a large menu, character
collection, story, shop, or elaborate effects.

## 9. Definition of Done

The MVP is done only when: - The game runs in a mobile browser. - A full
match can be played using touch. - The AI can return the ball. - Ball
and racket interactions work reliably. - Timing feedback changes the
shot. - Scoring and match completion work. - Pause, restart, and results
flow work. - No critical runtime errors remain. - Real-device testing
has been performed or clearly marked as outstanding.
