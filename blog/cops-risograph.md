---
title: "Risograph in COPs: Subtractive Color Mixing with Kubelka-Munk Theory"
date: 2026-03-09
description: Rebuilding Risograph printing from scratch in Houdini Copernicus — ink decomposition, KM color science, dithering, and the art-vs-physics balancing act
tags: [houdini, cops, opencl, color-science, risograph]
---

# Risograph in COPs

Risograph is one of those rare processes where the imperfections _are_ the aesthetic. Misregistered layers, grain from soy-based ink, halftone artifacts — they all contribute to the charm. But recreating it digitally turns out to be a surprisingly deep problem that touches color science, dithering theory, and fundamental questions about what "accurate" even means for an inherently imprecise medium.

This post documents my approach to building a procedural Risograph simulator in Houdini's Copernicus (COPs), including the design decisions, trade-offs, and the rabbit holes I went down along the way.

<!-- truncate -->

## The Problem with "Just Use Multiply"

The most common advice for digital Risograph is: separate your image into color channels, tint each one, and use Multiply blending. Most Photoshop tutorials, Procreate brushes, and even commercial plugins like RizzCraft follow this pattern.

It works — sort of. Multiply in RGB computes `A × B` per channel, which loosely approximates how overlapping transparent inks darken each other. But it has fundamental issues:

1. **It's commutative.** `A × B = B × A`. Real Riso printing isn't — the order you print layers affects the result because each ink partially obscures what's beneath it.
2. **Color mixing is wrong.** Yellow × Blue in Multiply gives you a muddy dark value, not green. Real pigments produce green because of how light absorption works physically.
3. **It ignores ink coverage.** Real Riso uses halftone dots whose _size_ controls coverage. In the gaps between dots, the paper shows through. Multiply has no concept of this.

For quick stylistic work, Multiply is perfectly fine. But I wanted to push further — to understand what a more physically-grounded pipeline could look like inside a procedural compositing environment.

## The Pipeline

Here's the overall architecture of the Risograph node:

```
Input Image
    ↓
[KM Convert: RGB → K/S space]
    ↓
[Weight Calculation] ← Palette Colors (also in K/S space)
    ↓
5× parallel channels:
    [Dither Mono] → [Transform2D (misregistration)] → [Multiply with palette color]
    ↓
[Sum all layers in K/S space]
    ↓
[KM Convert: K/S → RGB]
    ↓
[Paper texture + background composite]
    ↓
Output
```

Each stage embodies a specific design choice. Let me walk through them.

## Step 1: Color Decomposition — How Much of Each Ink?

The first question is: given a source pixel and a palette of 5 ink colors, how much of each ink do we need?

This is essentially an **ink decomposition** problem. I implemented three methods in an OpenCL kernel, selectable via a parameter:

```c
float calculateWeight(float3 original, float3 ink, int method) {
    if (method == 0) {
        // Projection: how much of the ink vector is in the original?
        return dot(original, ink) / dot(ink, ink);
    } else if (method == 1) {
        // Inverse distance: closer colors get higher weight
        float3 diff = original - ink;
        return 1.0 / (1.0 + dot(diff, diff));
    } else {
        // Gaussian: smooth falloff from ink color
        float dist = distance(original, ink);
        return exp(-dist * dist);
    }
}
```

**Method 0 (Projection)** is the default. It treats each ink color as a vector in color space and projects the source pixel onto it — essentially asking "how much of this ink's direction does the original color contain?" This is fast, produces clean separations, and is easy to reason about.

**Method 1 (Inverse Distance)** and **Method 2 (Gaussian)** are alternative decomposition strategies. They both measure _closeness_ to each ink color, but with different falloff curves. The Gaussian produces softer transitions between ink regions.

The critical detail: this weight calculation happens in **linearized color space** (gamma-corrected input). This matters because perceptual brightness and physical light intensity aren't the same thing, and we want the weights to reflect physical mixing ratios, not display values.

## Step 2: Kubelka-Munk — The Physics Detour

This is where I spent the most time, and where the most interesting trade-offs live.

### What is Kubelka-Munk?

KM theory models how pigments interact with light through two properties: **absorption (K)** and **scattering (S)**. Instead of mixing colors in RGB (which is an _additive_ display model), you convert to K/S space where **linear mixing actually corresponds to physical pigment blending**.

The conversion is straightforward:

```c
// RGB → K/S
k = (1 - R)² / (2R)

// K/S → RGB
R = 1 + k - √(k × (k + 2))
```

When you add pigments in K/S space and convert back, yellow + blue actually produces green — because you're modeling how the combined absorption spectra interact with white light, not just multiplying display values.

### Why I Built It — and Why I Didn't Fully Use It

I built a dedicated `km_converter` HDA for this project, with an OpenCL kernel implementing both directions. I actually wrote two versions of the conversion:

**Version 1 (Standard KM):**
```c
k = (1 - R)² / (2R)          // forward
R = 1 + k - √(k(k + 2))     // inverse
```

**Version 2 (With scattering factors):**
```c
k = (1 - R)² / (2R + s)             // forward, s varies per channel
R = (1 + k - √(k(k + 2 + s))) × c  // inverse, with brightness compensation
```

The second version adds per-channel scattering coefficients (`s = {0.06, 0.1, 0.12}` for RGB) and brightness compensation. This was an attempt to model the fact that Riso inks aren't ideal Lambertian surfaces — they scatter light differently depending on wavelength, and the semi-transparent soy base interacts with paper differently than opaque paint.

**Here's the honest assessment:** pure KM is designed for opaque pigment mixing. Riso inks are semi-transparent. The "correct" physical model would be somewhere between KM (opaque) and Beer-Lambert (fully transparent). But Beer-Lambert requires knowing the ink thickness, which varies with halftone coverage in ways that are hard to model.

So the final pipeline uses KM as a **compromise** — it's more physically grounded than Multiply, produces better color mixing results, but doesn't claim to be a perfect simulation of soy ink on paper. The scattering factors in Version 2 were my attempt to bridge the gap, tuned by eye against real Riso prints rather than measured from actual ink properties.

## Step 3: Dithering — From Continuous Tone to Dots

Real Risograph doesn't print continuous tones. It prints **dots** — either ordered halftone patterns or stochastic grain, depending on the machine setting. This is controlled per-channel by the weight masks from Step 1.

Each of the 5 ink channels gets its own `dither_mono` node (another HDA I built), which offers three dithering algorithms: halftone, ordered (Bayer matrix), and noise dithering. The choice affects the visual character:

- **Halftone** gives a classic print look with visible dot patterns
- **Ordered dither** produces a more geometric, digital aesthetic
- **Noise dither** is closest to Riso's "Grain Touch" mode — organic and film-like

The dither converts each continuous weight mask into a binary (or near-binary) mask: ink or no ink. This is where the **paper shows through** — in the gaps between dots.

### Why Dithering Matters for Color Mixing

This is subtle but important: dithering fundamentally changes how colors mix.

With continuous-tone blending (no dithering), overlapping ink regions always produce subtractive mixing. But with halftone dots, you get three possible states at any pixel:

1. **Only ink A** — you see ink A's color
2. **Only ink B** — you see ink B's color
3. **Both inks overlap** — subtractive mixing occurs
4. **Neither ink** — you see the paper

The visual result is a mix of subtractive mixing (where dots overlap) and **spatial dithering** (where nearby dots of different colors blend in the viewer's eye, similar to pointillism). This dual mixing mode is part of what gives Riso prints their unique quality, and it emerges naturally from the pipeline — no special handling needed.

## Step 4: Layer Compositing — Order Matters

After dithering, each channel is composited:

```
dithered_mask × palette_color_in_KM_space → tinted layer
```

All 5 tinted layers are then summed (in KM space) and converted back to RGB.

But there's a detail: **ink printing order matters**. I implemented an `offset_order` kernel that rotates which ink layer gets printed "first" (bottom of the stack). This is exposed as a user parameter, because in real Riso work, the print order is a deliberate creative choice — dark inks under light inks look different from light under dark.

## Step 5: Misregistration and Paper

Each dithered layer passes through a `transform2d` node with small random offsets (controlled by a seed parameter and scale values around 0.5% of the image). This simulates the mechanical misalignment between print passes.

The background is a solid color (default white) representing the paper. The final composite uses Over blending to layer the inked result onto the paper. There's also a paper texture overlay option for adding physical paper grain.

## The Palette System

I built 6 preset palettes, each containing 5 inks selected from 19 real Riso ink colors:

| Palette | Inks |
|---------|------|
| **Classic** | Black, Bright Red, Blue, Yellow, Green |
| **Vibrant** | Black, Fluorescent Pink, Bright Red, Federal Blue, Yellow |
| **Muted** | Black, Burgundy, Medium Blue, Green, Warm Gray |
| **Earthy Vintage** | Light Lime, Hunter Green, Flat Gold, Light Gray, Federal Blue |
| **Neon Nights** | Black, Fluorescent Pink, Fluorescent Orange, Fluorescent Green, Purple |
| **Experimental** | Black, Fluorescent Pink, Teal, Metallic Gold, Purple |

The ink colors are defined as RGB constants matching the actual Riso ink swatches (e.g., Bright Red = `(0.945, 0.314, 0.376)`). These get converted to KM space alongside the input image for the weight calculation.

## The Four-Way Trade-Off

Looking back, every design decision in this node was a negotiation between four competing goals:

### 1. Artistic Expression
The whole point is to make images that _feel_ like Riso prints. This means the controls need to be intuitive and the results need to be visually appealing, even if they're not physically "correct." The palette presets, dither mode selection, and ink order parameter all serve this goal.

### 2. Physical Accuracy
KM color mixing produces more realistic results than Multiply — yellow and blue make green, not mud. But KM models opaque pigments, and Riso inks are semi-transparent. The scattering factor variant was my attempt to split the difference, but it's still an approximation. At some point, chasing physical accuracy yields diminishing returns for a process that's valued _because_ it's imperfect.

### 3. Reproduction Fidelity
How close does the output look to an actual Riso print? This is different from physical accuracy — a physically correct model might produce colors that no real Riso machine would output, because real machines have their own quirks (drum pressure, ink viscosity, paper absorption). The halftone dithering and misregistration address this dimension specifically.

### 4. User Experience
A node with 50 parameters for KM scattering coefficients per ink would be unusable. The final interface exposes: palette selection, dither mode, dither parameters, ink order, misregistration scale, background color, and a tone mapping ramp. That's it. The KM conversion, weight calculation method, and layer compositing all happen automatically.

### Where I Landed

The final version is a **compromise that leans toward artistic control**:

- KM mixing for better color science than Multiply, but not full spectral rendering
- Dithering that captures the essential Riso texture without simulating the actual stencil master
- Misregistration as a controlled parameter rather than a physical simulation
- Preset palettes based on real ink colors, with the weight decomposition doing the creative work of deciding how to separate an arbitrary image into those limited inks

The KM color science nodes I built for this project (`rgb_to_km`, `km_blend`, `km_to_rgb`, `km_converter`) ended up being reusable tools in their own right — useful anywhere you need subtractive color mixing in COPs, even outside of Risograph contexts.

## What I'd Do Differently

If I rebuilt this from scratch:

- **Spectral rendering** instead of per-channel KM would handle edge cases better (metameric colors, fluorescent inks). But the computational cost and complexity are hard to justify for a stylistic effect.
- **Better ink decomposition** — the current weight calculation works in linearized RGB or KM space, but a perceptual space like OKLAB might produce more intuitive separations, especially for the distance-based methods.
- **Adaptive dithering** — varying the dither pattern based on the ink weight could better simulate how real Riso adjusts dot coverage. Currently all channels use the same dither parameters.

But honestly, the current version does what I need. It produces results that feel genuinely Riso-like, the controls are manageable, and it runs fast enough on GPU for interactive use in COPs. Sometimes "good enough" is the right stopping point.

---

_Built with Houdini 21.0 Copernicus. The Risograph node is part of [MotionCops](https://github.com/Boning1011/motion-cops), along with the KM color science nodes used in this pipeline._
