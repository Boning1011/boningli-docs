---
title: COPs GPU Particle
description: Simple example showing how to advect particles in Copernicus
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