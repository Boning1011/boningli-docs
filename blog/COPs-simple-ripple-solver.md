---
title: Simple Ripple Solver in Houdini COPs
description: A lightweight water ripple simulation using the 2D wave equation
tags: [houdini, cops, opencl, simulation, vfx]
---

# Simple Ripple Solver in Houdini COPs

This is a simple yet effective ripple solver implemented as a Houdini COPs OpenCL kernel. It simulates 2D water waves based on the discrete wave equation, perfect for creating realistic ripple effects on image layers.

<!-- truncate -->

## Physics Background

The simulation is based on the **2D wave equation**, which describes how waves propagate across a surface:

```math
∂²h/∂t² = c² ∇²h
```

Where:
- `h` is the height (displacement) of the water surface
- `c` is the wave speed
- `∇²` is the Laplacian operator (spatial second derivative)

### Discrete Implementation

To simulate this on a discrete grid, we use a finite difference approximation:

1. **Laplacian approximation** (measures curvature at each point):
   ```
   ∇²h[i,j] ≈ h[i-1,j] + h[i+1,j] + h[i,j-1] + h[i,j+1] - 4h[i,j]
   ```

2. **Velocity update** (acceleration from curvature):
   ```
   v_new = d × (v + c² × ∇²h)
   ```

3. **Height update** (integration of velocity):
   ```
   h_new = d × (h + v_new)
   ```

Where `d` is a damping factor (< 1.0) that causes waves to gradually decay, simulating energy loss.

## Algorithm Overview

The solver uses a **double-buffered** approach with two pairs of buffers:
- `height_src` / `height_dst` - stores surface displacement
- `v_src` / `v_dst` - stores vertical velocity

Each frame:
1. Compute the Laplacian (curvature) at each pixel by sampling 4 neighbors
2. Update velocity based on the local curvature
3. Update height based on the new velocity
4. Apply damping to both values
5. Swap buffers for the next iteration

### Key Design Choice: Writeback Kernel

A crucial feature of this implementation is the **@WRITEBACK kernel**, which copies the output buffers back to the input buffers after each frame. This enables **multiple iterations per frame** without increasing the wave speed parameter `c`.

**Why this matters:**
- Running 10 iterations with `c = 0.3` gives smoother, more stable results than 1 iteration with `c = 3.0`
- Higher `c` values can cause numerical instability and wave explosions
- Multiple iterations allow fine control over propagation speed while maintaining stability
- You can control effective wave speed through iteration count rather than risking unstable parameters

### Boundary Handling

The solver includes optional **mask support** for defining simulation boundaries:
- Masked areas (mask < 0.5) are treated as solid boundaries
- At boundaries, the wave reflects: neighbor height is mirrored as `-h_center`
- This creates realistic wave reflection at obstacles

## Implementation

```cpp
#bind layer &height_src float
#bind layer &v_src float
#bind layer &height_dst float
#bind layer &v_dst float
#bind layer ?mask float

#bind parm c float val=0.3
#bind parm damping float val=0.95

@KERNEL
{
    int2 ixy = (int2)(@ix, @iy);
    float h_center = @height_src.bufferIndex(ixy);
    float v_center = @v_src.bufferIndex(ixy);

    float mask_center = @mask.bound ? @mask.bufferIndex(ixy) : 1.0;

    // Skip masked areas
    if(mask_center < 0.5) {
        @height_dst.set(0.0);
        @v_dst.set(0.0);
        return;
    }

    // Compute Laplacian (discrete second derivative)
    float lap = 0.0;
    int2 offsets[4] = {(int2)(-1,0), (int2)(1,0), (int2)(0,-1), (int2)(0,1)};

    for(int i = 0; i < 4; i++) {
        int2 neighbor = ixy + offsets[i];
        float neighbor_mask = @mask.bound ? @mask.bufferIndex(neighbor) : 1.0;

        float sample;
        if(neighbor_mask < 0.5) {
            // Boundary reflection: mirror the center height
            sample = -h_center;
        } else {
            sample = @height_src.bufferIndex(neighbor);
        }
        lap += sample;
    }
    lap += h_center * -4.0;

    // Wave equation integration
    float new_v = @damping * (v_center + @c * @c * lap);
    float new_h = @damping * (h_center + new_v);

    @height_dst.set(new_h);
    @v_dst.set(new_v);
}

@WRITEBACK
{
    @height_src.set(@height_dst);
    @v_src.set(@v_dst);
}
```

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `c` | 0.3 | Wave propagation speed. Higher values = faster waves |
| `damping` | 0.95 | Energy loss per frame. Values < 1.0 cause waves to fade over time |
| `mask` | optional | Grayscale mask defining simulation boundaries (white = simulate, black = solid) |

## Usage Tips

- **Wave speed (`c`)**: Start with 0.2-0.5. Higher values may cause instability
- **Damping**: 0.9-0.98 works well. Lower values = faster decay
- **Stability**: If waves explode, reduce `c` or increase `damping`
- **Interactive ripples**: Use a COP Paint node to draw into the height layer each frame

This solver is ideal for interactive ripple effects, rain simulations, or procedural water disturbances in texture space.
