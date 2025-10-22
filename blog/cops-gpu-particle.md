---
title: COPs GPU Particle
date: 2025-10-22
description: Simple example showing how to advect particles in Copernicus
tags: [houdini, cops, opencl, particles, simulation, gpu]
---

Geometry can work within the Copernicus context. A typical workflow is to import geometry via SOP, rasterize position, UV, and other attributes to 2D layers, perform various texture operations, then export the results back as materials onto the geometry.

While Copernicus is primarily known for texture generation, it can also be used for pure geometry-based workflows. With the introduction of native solvers in COPs in H21, new possibilities have emerged.

One practical example is GPU particle simulation.

Simple particle advecting:
```
#runover attribute
#bind point &P port=particle float3
#bind point ?&v port=particle float3
#bind layer ?vel float2

@KERNEL
{
    float2 layerv = @vel.worldSample(@P);
    float3 newpos = @P + (float3)(layerv.x, layerv.y, 0.0f);
    @P.set(newpos);
}
```

Rasterize particle to a density layer. This is a quick and dirty way.
```
#runover attribute
#bind point &P                port=particle float3
#bind layer &?density         int val=0    // mono int layer, starts at 0

@KERNEL
{
    // World -> Image (3D version returns float3; use .xy)
    float3 img = @density.worldToImage3(@P);

    // Image -> Buffer (float2)
    float2 buf = @density.imageToBuffer((float2)(img.x, img.y));

    // Round to nearest integer pixel in buffer space
    float2 bf = floor(buf + (float2)(0.5f, 0.5f));
    int2 ixy  = convert_int2(bf);  // <-- key change

    // Bounds check
    if (ixy.x < 0 || ixy.y < 0 || ixy.x >= @density.xres || ixy.y >= @density.yres)
        return;

    // Linear index
    int idx = ixy.y * @density.xres + ixy.x;

    // Parallel-safe atomic increment
    global volatile int *dst = (global volatile int *)@density.data;
    atomic_inc(&dst[idx]);
}
```