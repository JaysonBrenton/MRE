---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Standards and prompts for generating MRE hero images using AI tools
purpose: Defines the standards, prompts, and visual identity for generating hero images
         for the My Race Engineer (MRE) landing page using AI image-generation tools such
         as Stable Diffusion. Describes how to consistently produce visually aligned,
         on-brand hero images for marketing and UI purposes. Active (Alpha-compatible,
         future-facing) but not implemented in Alpha UI.
relatedFiles:
  - docs/design/mre-dark-theme-guidelines.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# MRE Hero Image Generation Guidelines

**Document Type:** Design Specification
**Status:** Active (Alpha-compatible, future-facing)
**Scope:** Defines the standards, prompts, and visual identity for generating hero images for the My Race Engineer (MRE) landing page using AI image-generation tools such as Stable Diffusion.

This document describes how to consistently produce visually aligned, on-brand hero images for marketing and UI purposes.

---

# 1. Purpose of This Document

The goal of this document is to:

* Provide a unified creative style for MRE hero images.
* Ensure all marketing visuals follow MRE’s dark, premium visual language.
* Define reproducible Stable Diffusion prompts.
* Prevent visual inconsistency as more images are produced.
* Serve as the source of truth for LLMs generating imagery guidelines.

This document does **not** authorize the creation of UI screens or features beyond the Alpha scope.

---

# 2. Visual Style Overview

All hero images for MRE must follow these principles:

### 2.1 Dark, premium, high-contrast style

* Rich deep greys for backgrounds
* Neon or cool-toned accent lighting
* High clarity and sharpness
* Avoid pure black (#000000)

### 2.2 High-tech, motorsport-inspired aesthetic

* Visual cues from professional telemetry systems
* Motion blur, speed lines, or track textures
* Futuristic HUD-style overlays

### 2.3 RC racing authenticity

* Cars must look **1/10 or 1/8 RC scale**, not full-size race cars
* Must capture:

  * knobby off-road tyres,
  * exposed suspension,
  * wing profiles,
  * realistic RC chassis shapes
* Avoid full-scale automotive proportions

### 2.4 Consistency with MRE UI and brand

* Dark theme alignment with semantic tokens
* Blue or teal accents recommended
* Avoid red unless indicating danger or warnings

---

# 3. Composition Rules (Hero Image Layout)

To match the future landing page layout:

### 3.1 Car Positioning

* Car should appear slightly off-center (left or right)
* Forward-leaning stance preferred (implies speed)

### 3.2 Background

* Should be blurred track dirt or a night-time stadium environment
* Subtle bokeh lights or stadium lighting allowed
* No hard edges that conflict with UI text overlays

### 3.3 Motion and Energy

* Recommended elements:

  * dust trails,
  * motion blur,
  * subtle sparks,
  * tyre flex,
  * chassis compression
* These convey race energy in a static image

---

# 4. Stable Diffusion Prompt Structure

This is the **authoritative prompt structure** for generating MRE hero images.

Each image must follow this template:

```
<Subject Description>,
shot in dramatic cinematic lighting, dark high-contrast aesthetic, shallow depth of field,
futuristic telemetry-inspired UI glow elements, neon blue accents, crisp details,
professional motorsport photography style, ultra sharp, dust and motion effects,
background blur, high dynamic range, 8k
```

You must replace `<Subject Description>` with a relevant RC racing subject.

---

# 5. Official Prompt Examples

### 5.1 Standard MRE Hero Image

```
1/8 scale RC off-road racing buggy launching off a jump, angled front view,
shot in dramatic cinematic lighting, dark high-contrast aesthetic, shallow depth of field,
futuristic telemetry-inspired UI glow elements, neon blue accents, crisp details,
professional motorsport photography style, ultra sharp, dust and motion effects,
background blur, high dynamic range, 8k
```

### 5.2 Track-Side Action

```
1/10 RC buggy cornering hard on a dirt track, big rooster tail of dust,
shot in dramatic cinematic lighting, dark high-contrast aesthetic,
futuristic telemetry glow accents, crisp details, ultra sharp,
shallow depth of field, professional motorsport photography style,
high dynamic range, 8k
```

### 5.3 Night Race Atmosphere

```
RC racing buggy under stadium lights, neon reflections,
shallow depth of field, dust in foreground, cinematic lighting,
futuristic HUD glow overlays, crisp ultra-sharp details, 8k
```

---

# 6. Negative Prompt (Forbidden Elements)

These items must be excluded from all MRE hero imagery.

```
low resolution, blurry, grainy, distorted proportions, full-size race cars,
crowds, drivers, human faces, logos, brand names, cartoon style, flat lighting,
watermarks, text, numbers, embedded UI, specular overexposure, washed out colors
```

---

# 7. Image Output Requirements

All generated images must follow these format rules:

* Minimum resolution: **3000x1700** (landscape hero size)
* PNG preferred, JPG acceptable
* No text overlays
* No UI elements baked into the image
* Must look cohesive when placed behind dark UI components

---

# 8. Licensing and Legal Rules

When generating images:

* Avoid real brands/logos
* Avoid recognisable real-world tracks
* Images must be original AI-generated content
* No copyrighted references
* All outputs must be attributed as internal assets

This is required to ensure clean legal status for future commercial use.

---

# 9. Intended Use Cases

Hero images may be used for:

* Future landing page (Beta and Production)
* Marketing documentation
* Social media promotional banners
* UI previews inside documentation

They must **not** be used in Alpha product UI.

---

# 10. How LLMs Must Use This Document

LLMs must:

* Use this prompt structure when generating hero-image prompts
* Refuse to generate visuals violating forbidden elements
* Quote text from this document when reviewing or generating prompts
* Avoid hallucinating styles not included here

---

# 11. License

Internal use only. This document governs hero image generation for the MRE project.
