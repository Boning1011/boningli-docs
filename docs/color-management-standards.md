# Color Management Standards v1.0

Detailed explanation of ACEScg vs. sRGB here:

[Color management in Houdini](https://www.sidefx.com/docs/houdini/solaris/ocio.html#color-spaces)

# 1. Color Space Framework

### 1.1 Linear Rec.709/sRGB Working Space

Our production pipeline implements a standardized Linear Rec.709/sRGB workflow across all content creation applications. This established color space serves as the foundation of our color management strategy, offering several key advantages:

- Native compatibility with Houdini's default render configuration
- Consistent implementation across workstations without additional setup
- Streamlined interoperability between production software

### 1.2 Strategic Considerations: Linear Rec.709/sRGB vs. ACEScg

While the industry is increasingly adopting ACES (Academy Color Encoding System) workflow with its expanded color gamut (AP1/ACEScg) and sophisticated display transforms, our studio has strategically chosen to maintain the Linear Rec.709/sRGB workflow based on careful evaluation of:

- Project requirements and delivery specifications
- Team workflow efficiency considerations
- Implementation complexity and maintenance overhead

This decision prioritizes operational efficiency and consistency while maintaining professional-quality output appropriate for our project scope.

# 2. Software Implementation Guidelines

## 2.1 Houdini Configuration

### 2.1.1 Viewport Display Transform

Configure Karma render view to use "ACES 1.0 - SDR Viewport" display transform for all rendering and lookdev operations. This transform applies:

- Highlight roll-off for proper exposure of high dynamic range content
- Shadow detail preservation
- Appropriate contrast mapping for standard display viewing

**IMPORTANT: Avoid using the default "Un-tone-mapped" setting, which applies only basic gamma correction and provides inadequate visual reference for final output quality.**

![Un-tone-mapped viewport setting](/img/color-management/image.png)

The default option is "Un-tone-mapped", which only applies a basic gamma correction.

![ACES SDR Viewport setting](/img/color-management/image%201.png)

## 2.2 After Effects

### 2.2.1 Project and comp setting

When creating a new project, make project setting as below:

![After Effects project settings](/img/color-management/image%202.png)

For any Karma/Nuke rendered .exr sequence, set the "Interpret Footage" as below:

![Interpret Footage for EXR sequences](/img/color-management/image%203.png)

For common no-hdr footage, e.g jpg/png/h.264/Prores, set the "Interpret Footage" as below:

![Interpret Footage for standard footage](/img/color-management/image%204.png)

### 2.2.2 The tricky part : mixed source with 8-bit sRGB:

Unlike houdini, that we mostly only deal with the HDR/16-bit float image. In after effects we often needs to comp the rendered sequence with image from screenshot/web/h.264/etc.

In this case, we disable the viewport color transform(the "ACES1.0 SDR video" thing ) and use the "OCIO display transform" to deal with the exr sequence.

![OCIO display transform in After Effects](/img/color-management/image%205.png)

### 2.2.3 Export setup

Set the "Color" in "Output Module" from render queue, set the same as viewport:

![After Effects export color settings](/img/color-management/image%206.png)

## 2.3 Nuke

### 2.3.1 Project Settings

Same idea as After Effects, set the project setting as below:

![Nuke project settings](/img/color-management/image%207.png)

Set the input transform in "read" node to "Linear Rec.709(sRGB)":

![Nuke read node input transform](/img/color-management/image%208.png)

For most case, that all the files coming in and out are 16-bit half-float .EXR, enable the viewport tone-mapping for convenient.

![Nuke viewport tone-mapping](/img/color-management/image%209.png)

For case that have to match/use other non-linear/HDR source screenshot/web/h.264/etc, use "OCIO Display" node to do the tonemapping, and DISABLE THE VIEWPORT TRANSFORM.

![OCIO Display node in Nuke](/img/color-management/image%2010.png)

### 2.3.2 Export

For case that needs to bake the image to non-HDR format(h.264/prores/etc), set the output transform type to "display" and match the current viewport display transform:

![Nuke export for non-HDR formats](/img/color-management/image%2011.png)

To export/cache .EXR sequence, set to Linear Rec.709(sRGB) to ensure the linear workflow through whole pipeline:

![Nuke export for EXR sequences](/img/color-management/image%2012.png)

## 2.4 Touch Designer

Keep all the footage to TD as basic sRGB texture, so that no extra colorspace setting needed. What we see will be the color expected.

# 3. Key Implementation Principles

The following core principles must be maintained across all production activities:

1. **Maintain Linear Rec.709/sRGB Space Throughout Pipeline**

Preserve linear working space in all intermediate stages from initial content creation through final delivery

1. **Apply Proper Display Transforms During Production**

Always utilize "ACES 1.0 - SDR Display" tone-mapping for accurate visual reference during lookdev and evaluation; never rely on "Un-tone-mapped" mode for creative decisions

1. **Handle Mixed-Source Content Appropriately**

When compositing 8-bit sRGB content with 16-bit float EXR assets in After Effects or Nuke:

- Set viewport transform to Raw
- Apply "ACES 1.0 - SDR Display" transform through dedicated OCIO nodes
- Ensure color space consistency in both preview and output

This document establishes standardized color management protocols for the content team to ensure consistency and accuracy throughout our production pipeline. Following these guidelines will maintain color fidelity across all project stages and software platforms.
