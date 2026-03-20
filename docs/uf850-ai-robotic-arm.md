---
title: "One Webcam, One Arm: An AI-First Approach to Robotic Interaction"
description: A personal sprint into making a 6-axis industrial robot arm respond to people — using nothing but a webcam, Gemini VLM, MediaPipe, and a lot of AI-assisted coding.
sidebar_label: AI Robotic Arm
tags: [robotics, ai, mediapipe, gemini, python, new-media]
slug: uf850-ai-robotic-arm
---

# One Webcam, One Arm: An AI-First Approach to Robotic Interaction

I work at a new-media studio where robotic arms show up in installations from time to time. I've seen the workflows — TouchDesigner pipelines, depth cameras, pre-rendered animations played back through carefully rigged FK/IK chains. They work. They produce great results. But watching those projects, I kept wondering: what if you stripped away most of the toolchain and leaned hard into AI instead?

Not as a critique of existing approaches — more as a personal itch. I wanted to understand what happens when you constrain yourself to **a single ordinary webcam** as the only input device, and let AI handle as much of the perception and decision-making as possible. No depth sensors, no LiDAR, no motion capture. Just pixels from a cheap camera, a [UFactory 850](https://www.ufactory.cc/product-page/ufactory-850) six-axis arm, and whatever I could build in my spare time after work.

This was also my first time working with a robotic arm at all. Everything — from the SDK, to servo modes, to inverse kinematics, to signal filtering — I was learning from scratch.

## The Strategy: Let the Arm Be the Arm

Before getting into the build, I want to explain a deliberate choice that shaped everything.

In the robotic arm workflows I'd observed, a significant chunk of the effort goes into _pre-production outside the arm_. You model the arm in Blender or Houdini, build an FK/IK rig, choreograph the motion in 3D software, solve for the six joint angles, export them as CSV or some intermediate format, then play them back on the real hardware. It's a pipeline that works — but it means you're essentially reimplementing the arm's own inverse kinematics solver in external software, then feeding the result back to a controller that has a perfectly good IK solver built in.

I didn't take that approach. Partly because I had no time or resources for it — no pre-rendered animation library, no RL training infrastructure, no VLA pipeline. But also because I think there's something fundamentally backwards about it. The UFactory SDK accepts Cartesian coordinates (XYZ position + RPY orientation) and solves the joint angles internally, using its own kinematic model with full knowledge of joint limits, singularities, and collision geometry. When you bypass that and compute joint angles yourself in external software, you're replacing a solver that _knows the arm_ with one that's working from an approximation of it.

So my approach was: **give the arm Cartesian targets and let the firmware solve the IK.** All motion in this project — whether driven by VLM scene understanding or real-time hand tracking — is expressed as tool-tip coordinates in 3D space. The arm figures out how to get there. The simulation and the real hardware use the same solver, because it's the _arm's own solver_ in both cases.

This had two practical consequences:

1. **Everything could be real-time.** There's no offline computation step, no export, no file handoff. Perception produces a target position; the arm receives it at 25 Hz. The latency bottleneck is the perception model, not the motion pipeline.
2. **The workflow stopped being top-heavy.** In a pre-choreographed pipeline, most of the work happens before the arm moves — rigging, animating, solving, exporting. Here, the balance flipped. The arm is always running, always receiving live targets. The work is in designing _how_ those targets are generated, not in manually crafting each motion.

I'm not arguing this is universally better. Pre-choreographed animation gives you precise artistic control that procedural generation can't match. But for interactive installations where the arm needs to respond to unpredictable input in real time, I think trusting the SDK's own capabilities — rather than working around them — is the more honest starting point.

## The Constraint

One webcam. That's the entire sensory input. Everything the arm knows about the world comes through that single camera stream.

This constraint forced two very different interaction modes to emerge, each representing a different philosophy of how a robot can respond to people:

1. **VLM-driven mode** — the camera feeds into a vision-language model (Gemini) that _understands_ the scene semantically, and the arm reacts based on that understanding
2. **Hand tracking mode** — MediaPipe detects hand positions directly, and the arm follows in real time

Both modes share the same motion pipeline and safety systems, but they feel fundamentally different to interact with. VLM mode is the arm _watching and interpreting_. Hand tracking is the arm _mirroring you_.

## Mode A: Scene Understanding via VLM

The VLM pipeline works like this: the camera captures frames at ~5 fps, batches of ~5 frames get sent to Gemini 2.5 Flash, and the model returns a structured JSON response with continuous behavioral parameters — energy, mood, presence, urgency — plus gesture detection and a scene description. This runs asynchronously at roughly 1 Hz.

Those parameters feed into a trigger engine that detects state transitions (sudden energy spike, new person appearing, a hand gesture), and a mode engine that maps triggers to motion behaviors. The arm has five distinct motion personalities:

- **CALM** — gentle breathing oscillation at center, barely noticeable movement
- **ALERT** — reaches forward, slow horizontal sweep, as if scanning
- **EXCITED** — dramatic sweeping arcs across the full workspace
- **PLAYFUL** — extends forward with rapid pitch oscillation, like an eager head-nod
- **TRACK** — direct hand following (this is actually mode B, accessible from both pipelines)

What makes this interesting isn't just "AI sees person, arm moves." The VLM understands _degrees_ of things. It can tell the difference between someone casually walking past and someone actively engaging. It reads gesture semantics — a heart gesture triggers playful mode, a rock gesture triggers excitement. It even detects readable text in the scene (signs, screens) and can respond to written messages.

### Simplification Was the Hard Part

The first version had 7 motion modes, 6 continuous parameters, and 11 numeric triggers. It was over-engineered. Through iteration, I cut it down to 5 modes, 4 parameters, and 4 numeric triggers (plus 10 gesture triggers). The removed modes — TENSE and DORMANT — rarely triggered in practice. The removed parameters — attention_x and attention_y — were unreliable from a fixed camera angle and had weak downstream effects.

Less turned out to be more. Fewer modes meant each one could be more distinct. Fewer parameters meant the VLM's output was more consistent. The system became more readable, both to me and to the people interacting with it.

### Latency Matters More Than You Think

The initial VLM response time was ~6 seconds per call. At 1 Hz update rate, that meant the arm was always reacting to a scene that was 6 seconds old. For an art installation, that lag destroys the illusion of awareness.

The fix came in two parts: switching from Gemini 2.5 Flash to Flash Lite (which skips the model's internal "thinking" step), and fixing a sleep timing bug where the perception loop was sleeping for the full interval _on top of_ the VLM call duration instead of only the remaining time. Result: ~1.2 seconds per response. The arm now reacts within a reasonable window of what's actually happening.

## Mode B: Hand Tracking — Where the Details Live

The hand tracking mode uses MediaPipe's HandLandmarker. That's just the foundation. The real work — and the part I'm most proud of — is everything built on top of that coordinate stream to make the interaction feel alive rather than mechanical.

### Making an Industrial Arm Feel Organic

A raw coordinate mapping (hand position → arm position) produces movement that feels robotic in the worst way. The arm snaps to positions, stops dead when you stop, and crashes into its limits. Every one of the following behaviors addresses a specific aspect of that problem:

**Boundary Lean.** When the arm approaches the edge of its reachable workspace, it doesn't just stop — it _tilts_ toward that direction, like it's straining to reach further. Different lean angles for vertical versus horizontal boundaries. This is pure body language: the arm communicates "I want to go there but I can't" instead of just freezing.

**Soft Margin Deceleration.** Speed gradually reduces to 30% as the arm nears workspace boundaries, using a smoothstep easing curve. Instead of hitting a wall, the arm _eases_ into the boundary. The transition is invisible to observers — the arm simply appears to lose interest in going further.

**Breathing Overlay.** When the hand is perfectly still, tiny sinusoidal offsets on X and Z axes keep the arm moving. The oscillation is small enough to be subliminal but large enough to prevent that uncanny "machine locked in position" feeling. The arm breathes.

**Two-Hand Role Split.** Right hand controls XYZ position; left hand controls pitch (tilt angle, ±50°). When only one hand is present, position control is active and boundary lean kicks in automatically. The decision to make the left hand pitch-only was deliberate — full RPY on a single hand is too many degrees of freedom for intuitive control. Pitch alone (nodding/looking up) is the most expressive single axis.

**Center-Weighted Horizontal Amplification.** The center 50% of the camera frame maps to the arm's full left-right range. This means small hand movements in the natural interaction zone — roughly where your hands naturally rest — cover the entire workspace. You don't have to wave your arms wildly to make the robot move across its full range.

**No-Hand Fallback.** When hands leave the frame, the arm doesn't freeze at its last position. It smoothly transitions into a calm breathing motion at center. The arm returns to "resting" rather than "broken."

**Mode-Switch Speed Boost.** When switching into tracking mode, the arm gets a brief 0.8-second speed burst (700 → 300 mm/s) so it quickly catches up to the current hand position instead of drifting slowly from wherever it was.

**Per-Frame Velocity Clamping.** Every servo frame (25 Hz) enforces a maximum displacement based on current speed. Position is clamped by Euclidean distance; rotation is clamped per-axis with proper angle wrapping to avoid discontinuities at ±180°.

**Hard Safety Clamping.** Regardless of all other logic, every coordinate is hard-clamped to the safe workspace envelope before being sent to the arm SDK. This is the final safety net — even if every other system fails, the arm stays within bounds.

**Auto Error Recovery.** If the arm hits a servo error (IK limit, collision detection, speed violation), it automatically runs a full recovery sequence: clear error → re-enable motors → return to center → re-enter servo mode, with retries. No manual intervention needed. During testing, this meant I could push the system hard without worrying about babysitting it.

None of these features are individually complex. Most are a few lines of math. But together they answer a question that I think matters for anyone working with robots in interactive contexts: _how do you make a 30kg industrial machine feel like it's alive?_

## When Code Meets Physics

For the first ten days, all development happened against a Docker simulator running the UFactory firmware. The simulator is faithful to the SDK interface — same commands, same responses, same error codes. I built the entire pipeline, all five motion modes, the hand tracking system, the dashboard, the VLM integration — all on the simulator.

Then I connected the real arm.

### The Jitter Problem

The first thing I noticed: the entire table was shaking. In hand tracking mode, the arm vibrated constantly, especially when the hand was moving slowly or holding still. The simulator had shown perfectly smooth motion. The real arm, with its physical mass and structural resonance, amplified every tiny position change into visible mechanical vibration.

The root cause was a five-layer stack of noise amplification:

1. MediaPipe's wrist detection has frame-to-frame noise of a few pixels
2. The coordinate mapping scales this up — 2× horizontal amplification plus the full 800mm vertical range means a few pixels become 7-16mm of position change per frame
3. No dead zone — the arm chased every sub-millimeter change, sending new servo commands at 25 Hz even for 0.1mm differences
4. TRACK mode speed was 300 mm/s — fast enough to faithfully follow the noise
5. The breathing overlay (sinusoidal offsets for "organic" feel) added _more_ oscillation on top of already-noisy input

On the simulator, all of this was invisible. The virtual arm has no mass, no friction, no resonance. It just teleports to each position. The real arm's inertia and the table's mechanical coupling turned invisible noise into a very visible, very audible problem.

### Three Rounds of Fixes

**Round 1: EMA smoothing.** The obvious first try — exponential moving average with α=0.85 on position, α=0.88 on rotation. This reduced the _amplitude_ of the noise but preserved the jagged waveform shape. The arm still jittered, just less. Not good enough.

I also added a 2mm dead zone (ignore movements smaller than 2mm), a 0.5-second grace period on hand detection loss (don't reset filter state on brief MediaPipe dropouts), removed the breathing overlay during active tracking, and lowered the tracking speed from 300 to 200 mm/s. Each helped incrementally but the core problem remained.

**Round 2: discovering the dead zone side effect.** The 2mm dead zone worked well for tracking mode — it filtered out sub-millimeter noise. But I'd applied it globally. The CALM breathing mode generates sinusoidal motion with a maximum step size of ~1.44mm per frame. That's _below_ the 2mm threshold. The dead zone was eating the breathing motion entirely, causing the arm to freeze for several frames and then jump when the accumulated position finally exceeded 2mm. The fix: make the dead zone a parameter that's only enabled in TRACK mode (where the input is noisy sensor data), not in math-generated modes (where the input is clean).

**Round 3: One-Euro filter.** The breakthrough. The [1€ (One-Euro) filter](https://gery.casiez.net/1euro/) (Casiez et al., CHI 2012) is an adaptive low-pass filter designed specifically for noisy real-time tracking signals. The key insight: it adjusts its cutoff frequency based on input velocity.

- When the hand is stationary → cutoff drops to min_cutoff (1.0 Hz), applying heavy smoothing that eliminates jitter
- When the hand moves fast → cutoff increases proportionally (cutoff = min_cutoff + β × |velocity|), letting the signal through with minimal lag

This is exactly what EMA couldn't do — EMA has a fixed smoothing factor, so you're always choosing between "smooth but laggy" and "responsive but jittery." The 1€ filter gives you both, depending on what the input is actually doing.

Parameters: position min_cutoff=1.0 Hz, β=0.007; RPY min_cutoff=0.8 Hz, β=0.004 (heavier smoothing for rotation, since RPY noise gets amplified across the ±50° range).

As a final measure, I added a second 1€ filter layer (min_cutoff=3.0 Hz, β=0.01) on the servo output itself, applied to _all_ motion modes. The 3.0 Hz cutoff is transparent for slow math patterns (CALM at 0.15 Hz, PLAYFUL at 1.5 Hz) but catches timing jitter from the 25 Hz discrete position updates and OS sleep variance. For TRACK mode, it provides a second smoothing pass on top of the hand-tracking filter.

The table stopped shaking.

## How This Got Built

I want to be transparent about the development process, because I think it's part of the story.

Almost every commit in this project is co-authored with Claude. The workflow: I describe what I want in voice (speech-to-text), often running multiple Claude Code sessions in parallel — one working on the motion system while another tackles the dashboard, for instance. This is how a complete perception-to-motion pipeline with five behavioral modes, a real-time web dashboard, hand tracking, VLM integration, and a full test suite got built in spare evenings over roughly a week of actual working time.

I could not have done this alone in this timeframe. I don't say that as a disclaimer — I say it because the speed of iteration was _the point_. The thesis of this project is partly about what becomes possible when AI handles the execution while you focus on the design decisions. I knew what I wanted the arm to _feel like_. Claude handled turning that into servo commands, coordinate transforms, and signal processing code. I tested, observed, adjusted the direction, and iterated.

The day I built out the full pipeline — from camera capture to VLM perception to trigger engine to motion generation to arm control — that was six distinct phases completed and tested in a single session. Phase 1: extract ArmController from the monolithic PoC. Phase 2: build the parametric motion generator. Phase 3: wire up Gemini VLM perception. Phase 4: connect the live camera. Phase 5: full integration. Phase 6: multi-action trigger testing. Each phase verified before moving to the next.

### Side Outputs

The project also produced a few tools that weren't in the original plan:

- A **USD asset pipeline** — the UF850's FBX mesh exported as individual USD parts with a nested Xform hierarchy for FK control, plus a CSV-to-USD animation converter that turns recorded joint angles into time-sampled USD animation layers
- A **Houdini coordinate mapping** system — verified axis-by-axis that Houdini's Y-up right-handed coordinate system maps correctly to the arm's Z-up space, with a clean `houdini_to_arm()` transform (axis swap + ×1000 scale, no auto-fitting)
- A **web dashboard** with live camera feed, VLM parameter visualization, motion debug overlays, and arm telemetry via WebSocket — which became essential for debugging on the real arm

## What This Proved, and What It Didn't

This prototype proved that a single webcam plus AI perception can drive meaningful robotic interaction. The VLM mode demonstrates scene-level semantic understanding — the arm doesn't just detect "person present," it reads energy levels, moods, gestures, and even text. The hand tracking mode proves that careful behavior design on top of a basic detection model can make an industrial arm feel responsive and alive.

It also proved — to me, at least — that AI-assisted development has changed what's feasible for a single person working in spare time. A project that would have taken me months took days.

What it didn't prove: long-term reliability in a public installation. I tested on real hardware for one day. The jitter fixes work, the safety systems held, but an installation that runs for weeks needs a level of robustness I haven't validated. The VLM mode depends on cloud API availability (Gemini), which introduces a failure mode that hand tracking doesn't have. And the motion personalities, while distinct, are still procedural math — there's a ceiling to how organic they can feel without learned motion policies.

This was always meant to be a prototype — a way to walk through the entire pipeline myself, hit every wall, and form my own opinions about how this kind of work should be done. On that count, it delivered.
