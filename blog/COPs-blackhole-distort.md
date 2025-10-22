---
title: COPs Black Hole Distortion 
date: 2025-10-08
description: UV distortion based on SDF gradients for gravitational lensing effects
tags: [houdini, cops, opencl, vfx]
---

# Black Hole Distortion Effect in COPs

A COPs OpenCL kernel that creates gravitational lensing-style distortion by pulling pixels toward a mask boundary. It uses an SDF (signed distance field) and its gradient to generate UV offsets.

<!-- truncate -->

## How It Works

The effect calculates UV offsets by:
1. Reading the SDF value (distance from the black hole boundary)
2. Following the gradient direction (slope) toward the center
3. Computing offset strength based on distance with controllable falloff
4. Optionally using multiple substeps for smoother results

**Important:** When calculating the slope/gradient, a **Gaussian kernel produces better results** than the default slope node, which only samples immediate X and Y neighbors. The Gaussian kernel provides smoother, more accurate gradients.

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `strength` | 12.0 | Overall pull strength in pixels |
| `radius` | 80.0 | Influence radius (should match SDF scale) |
| `falloff` | 1.5 | Falloff curve shape (0-3 typical range) |
| `epsilon` | 1.0 | Stabilizer to prevent singularity near SDF=0 |
| `maxstep` | 8.0 | Maximum offset per substep (pixels) |
| `steps` | 1 | Number of substeps (3-5 for smoother distortion) |

## Implementation

```cpp
// Blackhole UV Offset (float2)
// Inputs you already have:
#bind layer sdf    float        // signed distance (>0 outside, <=0 inside)
#bind layer slope  float2       // your precomputed gradient (gx, gy)

// Output (single vec2)
#bind layer &uv_off float2     // UV offset in pixels (write-only here)

// Params
#bind parm strength  float val=12.0   // overall pull (px)
#bind parm radius    float val=80.0   // influence scale (match SDF units)
#bind parm falloff   float val=1.5    // shape of falloff (0..3 typical)
#bind parm epsilon   float val=1.0    // stabilizer near sdf≈0
#bind parm maxstep   float val=8.0    // per-step clamp (px)
#bind parm steps     int   val=1      // 1=one-shot, 3-5 = smoother

inline float2 safe_norm2(float2 v)
{
    float m2 = v.x*v.x + v.y*v.y;
    float inv = rsqrt(fmax(m2, 1e-12f));
    return (float2)(v.x*inv, v.y*inv);
}

@KERNEL
{
    float d0 = @sdf;
    if (d0 <= 0.0) { @uv_off.set((float2)(0.0f, 0.0f)); return; }

    float2 pos   = (float2)(@ix, @iy);   // walk in pixel space
    float2 total = (float2)(0.0f, 0.0f);
    int    N     = max(1, @steps);

    for (int k=0; k<N; ++k)
    {
        int2 pi = convert_int2_rtn(pos); // nearest pixel; bilerp if you prefer

        float Sd = @sdf.bufferIndex(pi);
        if (Sd <= 0.0f) break;

        float2 g  = @slope.bufferIndex(pi);
        float2 dir = -safe_norm2(g);     // pull toward the hole

        // tempered 1/(d+eps) with smooth radius cutoff
        float t = clamp(1.0f - Sd / @radius, 0.0f, 1.0f);
        float step_len = (@strength / (float)N) * powr(t, @falloff) / (Sd + @epsilon);
        step_len = fmin(step_len, @maxstep);

        float2 delta = dir * step_len;
        total += delta;
        pos   += delta; // re-evaluate field locally next substep
    }

    @uv_off.set(total); // pixel-space offset; add to your UV outside
}
```

## Usage Notes

- **SDF Input:** Positive values outside the mask, zero/negative inside
- **Slope Calculation:** Use a Gaussian kernel blur before computing gradients for smoother results
- **Substeps:** Increase `steps` to 3-5 for smoother, more accurate distortion paths
- **Stability:** Adjust `epsilon` if you see artifacts near the boundary
