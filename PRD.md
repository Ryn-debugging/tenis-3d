# TENNIS ANGEL --- PRODUCT REQUIREMENTS DOCUMENT

**Version:** 1.0\
**Status:** MVP specification\
**Genre:** Colorful 3D arcade tennis\
**Platform:** Mobile web, Android browser first\
**Orientation:** Landscape during matches\
**Technology:** HTML5, CSS3, JavaScript ES Modules, Three.js, Vite,
Howler.js

## 1. Product Vision

TENNIS ANGEL is a bright, playful 3D arcade tennis game designed for
mobile browsers. It uses cute original chibi/anime-inspired characters,
a vivid orange court, an elevated angled top-down camera, expressive
ball trails, and timing-based shot feedback.

The uploaded reference screenshot defines the desired visual
direction: - Orange/terracotta court. - Thick white court lines. -
Elevated view showing both court halves. - Small cute characters on
opposite sides. - Glowing ball with a colorful trail. - Large readable
PERFECT feedback. - Bright, toy-like, cheerful presentation.

Use the reference for inspiration only. All characters, logos, artwork,
models, sounds, and UI must be original or appropriately licensed.

## 2. Product Goals

1.  Make a playable tennis rally that feels responsive on a touchscreen.
2.  Make timing and shot choice meaningful.
3.  Make the ball easy to track throughout a rally.
4.  Create a distinctive colorful arcade visual identity.
5.  Run smoothly in Android mobile browsers.
6.  Keep the first version achievable without online services.

### Non-goals for the MVP

-   Online multiplayer.
-   Accounts or cloud saves.
-   Real-money purchases.
-   Large story campaign.
-   Dozens of characters or courts.
-   Photorealistic simulation.
-   External LLM calls during gameplay.

## 3. Target Audience and Session

-   Casual mobile players.
-   Players who enjoy colorful arcade sports games.
-   Short match sessions of approximately 2--4 minutes as a design
    target.
-   Simple controls with room to improve timing and shot placement.

## 4. Core Match Experience

The player starts on the bottom half of the court. The AI opponent
starts on the top half. A point begins with a serve, then players return
the ball until one side fails to make a legal return.

The game loop: 1. Open game. 2. Choose Quick Match. 3. Select AI
difficulty. 4. Start match. 5. Serve and rally. 6. Earn or lose a point.
7. Continue until the match ends. 8. Show result. 9. Replay or return to
menu.

## 5. Camera and Court

### Camera

Use a fixed elevated perspective camera, angled enough to show depth
while keeping the full court readable. It should resemble the supplied
screenshot rather than a realistic broadcast camera.

Requirements: - Both players and the full playable court remain
visible. - The ball should not disappear behind UI. - Use subtle camera
movement only for strong impacts if it does not reduce readability. -
Recalculate framing on resize and orientation changes.

### Court

MVP court: - Orange or terracotta playing surface. - Thick, bright white
boundary and service lines. - Contrasting light outer border. - Central
net. - Clear service boxes and court boundaries. - Simple surrounding
props only if they do not distract.

Use consistent world dimensions so movement, bounce, and line detection
agree.

## 6. Characters

MVP requires: - One playable character. - One AI opponent.

Style: - Original chibi/anime-inspired 3D characters. - Cute readable
silhouettes. - Colorful tennis outfits. - Simple expressive design. -
Clear racket and body pose.

Required states: - Idle. - Ready. - Move/run. - Serve. - Forehand. -
Backhand. - Smash. - Hit reaction. - Win/lose.

If custom models are not available, use simple procedural 3D
placeholders. Document placeholders and keep the character-loading
system replaceable. Do not use a static 2D image as the actual playable
character.

## 7. Player Controls

### Mobile layout

Landscape: - Left side: virtual joystick. - Right side: large HIT
action. - Secondary actions: POWER, LOB, SMASH, and SERVE when
appropriate. - Pause button near a screen corner.

Requirements: - Multi-touch support. - Pointer Events or equivalent. -
Large touch targets. - Immediate feedback. - No accidental page
scrolling or text selection over the gameplay surface. - Touch controls
must work without a keyboard.

### Movement

The player can move left, right, forward, and backward within the
allowed side of the court. Optional movement assistance may guide the
player toward the predicted ball landing position, but manual input must
override assistance.

## 8. Shot System

### Normal hit

Balanced speed, accuracy, and trajectory.

### Power shot

Higher speed and stronger attack, with a suitable energy or cooldown
rule if needed for balance.

### Lob

Higher arc intended to move the opponent away from the net.

### Smash

Powerful downward shot when the ball is in a valid high position.

### Serve

Starts a point. The MVP may use a simplified timed serve, but the player
must be able to trigger it.

Every shot should calculate direction, speed, and trajectory from: -
Player/racket position. - Ball position and velocity. - Shot type. -
Timing quality. - Aim or directional input, if implemented.

## 9. Timing Feedback

Timing is a core feature.

### PERFECT

-   Contact occurs in the ideal timing window.
-   Higher speed and accuracy.
-   Bright impact flash.
-   Glowing ball and rainbow trail.
-   Large animated PERFECT label.

### GOOD

-   Contact occurs in an acceptable timing window.
-   Standard or moderately reduced shot quality.
-   Smaller visual effect and GOOD label.

### MISS

-   Contact is too early, too late, or absent.
-   The shot is weak or fails, depending on contact state.
-   MISS feedback appears clearly.

Timing windows must be configurable and tuned through playtesting.
Feedback must be readable but must not obscure the ball.

## 10. Ball and Collision Requirements

Use an arcade-friendly physics implementation with: - Position and
velocity. - Gravity and configurable bounce. - Optional spin/curve. -
Court collision. - Net collision. - Racket collision. - Out-of-bounds
detection. - Trajectory prediction for AI.

Requirements: - No teleporting between shot positions. - Stable updates
independent of display frame rate. - Use a fixed or bounded physics
timestep where appropriate. - Detect fast ball/racket contacts reliably;
use swept collision or substeps if ordinary overlap checks miss fast
impacts. - Separate physical collision logic from visual rendering. -
Keep ball visible and readable.

## 11. AI Opponent

AI runs locally in JavaScript. It must not call a remote AI service
during matches.

Difficulty settings:

**Easy** - Slower reaction. - Less accurate positioning. - Occasional
mistakes.

**Normal** - Balanced reaction and positioning. - Reasonable shot
selection.

**Hard** - Faster reaction. - Better prediction. - More deliberate shot
placement.

AI process: 1. Read ball state. 2. Determine whether the ball is
approaching its side. 3. Predict a reachable landing/contact point. 4.
Move toward an appropriate position. 5. Choose a return shot. 6. Hit
only when the ball is within a valid contact window.

AI must have reaction delays and movement limits. It must not teleport,
hit from impossible distances, or return every ball automatically.

## 12. Scoring and Match Rules

Default arcade match: - First to 7 points wins a round. - Must win by 2
points. - Best of 3 rounds.

Scoring logic must be independent of UI. Define clear rules for: - Legal
return. - Net fault. - Ball out. - Ball bounce count. - Point awarded. -
Round completion. - Match completion.

Display player score, opponent score, and current round clearly.

## 13. Visual Effects

Required: - Glowing ball. - Fading rainbow trail for PERFECT shots. -
Small impact particles. - Animated PERFECT, GOOD, and MISS text. -
Stronger effect for smash. - Subtle win/lose presentation.

Effects must be optimized for mobile and must not hide the ball, net, or
court lines.

## 14. User Interface

### Main menu

-   TENNIS ANGEL title/logo.
-   Play.
-   Character (may be marked coming soon if not in MVP).
-   Tournament (may be marked coming soon if not in MVP).
-   Settings.

### Match HUD

-   Player and opponent labels.
-   Score.
-   Round.
-   Optional energy indicator.
-   Pause.
-   Touch controls.

### Pause menu

-   Resume.
-   Restart match.
-   Settings.
-   Main menu.

### Results screen

-   Winner.
-   Final score.
-   Rematch.
-   Main menu.

All visible controls must work. If a feature is not implemented, do not
present it as an active button.

## 15. Audio

Use Howler.js for: - Racket hit. - Ball bounce. - Net hit. - PERFECT
hit. - Power shot. - Smash. - UI interaction. - Victory and defeat. -
Background music.

Provide separate music and sound effect volume controls. Audio should
start only after an appropriate user gesture where browser policies
require it.

## 16. Technical Requirements

### Stack

-   HTML5.
-   CSS3.
-   JavaScript ES Modules.
-   Three.js.
-   Vite.
-   Howler.js.
-   LocalStorage.
-   GLB/GLTF for replaceable 3D assets.

### Architecture

Separate: - Game lifecycle and scene management. - Camera. - Player
controller. - AI controller. - Ball physics and rendering. - Racket and
shot system. - Match and scoring state. - Touch input. - Effects. -
UI. - Audio. - Save data.

Avoid one giant JavaScript file. Use clear interfaces and avoid circular
dependencies.

### Save Data

LocalStorage may save: - Audio settings. - Selected character. - Coins
and unlocks when progression is implemented. - Match statistics.

Use a save schema version and handle missing or malformed data safely.

## 17. Performance and Compatibility

Primary target: Android Chrome mobile browsers.

Targets: - Aim for 60 FPS on capable devices. - Provide a stable
lower-quality mode targeting 30 FPS on weaker devices. - Adaptive pixel
ratio. - Efficient geometry and textures. - Limit real-time shadows and
post-processing. - Pool frequently reused particles. - Avoid unnecessary
allocations in animation loops. - Handle resize and orientation
changes. - Test on real hardware.

Do not claim performance targets have been achieved without measuring
them on devices.

## 18. PWA

PWA support is a later milestone: - Web app manifest. - App icons. -
Service worker. - Asset caching. - Add-to-home-screen support on
compatible browsers.

The game must first work directly in the browser without installation.

## 19. MVP Acceptance Criteria

The MVP is accepted when: 1. Game launches in a mobile browser. 2. 3D
orange court and net render. 3. Camera resembles the reference. 4.
Player appears at the bottom and AI at the top. 5. Player moves using
touch controls. 6. Ball moves and bounces consistently. 7. Racket
contact produces a shot. 8. AI predicts and returns reachable balls. 9.
PERFECT/GOOD/MISS feedback works. 10. Scoring and match end work. 11.
Pause, restart, and results flow work. 12. No critical runtime errors
remain. 13. A complete match has been tested on a real Android device,
or device testing is explicitly marked outstanding.

## 20. Developer Instructions

Build the actual game, not a static mockup.

-   Use HTML5, CSS3, JavaScript, Three.js, and Vite.
-   Do not use Unity.
-   Do not replace the 3D game with a flat static page.
-   Do not use remote AI APIs for real-time opponent logic.
-   Keep the first milestone small and playable.
-   Use placeholders only when necessary and document them.
-   Test every major feature.
-   Report what was actually tested.
-   Follow `PLAN.md` phase by phase.
-   Do not start character collections, story, shop, or advanced
    progression before the core match works.

**Final objective:** deliver TENNIS ANGEL as a colorful, original, fully
playable 3D arcade tennis game for mobile web browsers, inspired by the
user's supplied reference image.
