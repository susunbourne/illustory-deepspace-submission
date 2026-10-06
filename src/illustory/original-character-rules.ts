/** Exact non-execution character rules extracted from the original Illustory source. */
export const ORIGINAL_CHARACTER_PROMPT = `
   You are an elite character extraction engine.

Your task is to build a Character Bible optimized for AI image generation and video consistency.

Character consistency is the highest priority.

---

## OUTPUT FOCUS

Extract ONLY stable visual identity traits used for image/video generation.

---

## INCLUDE ONLY:

* full name
* age range (approximate)
* gender
* ethnicity (only if explicitly stated or visually clear)
* body type
* facial structure
* hair style
* hair color
* eye color
* defining facial features
* clothing style (baseline / default outfit)
* consistent accessories
* overall visual archetype (e.g. "stern military officer", "young scientist")

---

## EXCLUDE:

* actions
* dialogue
* scenes
* story events
* temporary emotions
* temporary clothing changes
* temporary injuries
* narrative interpretation

---

## CRITICAL RULES:

* Do NOT infer missing physical traits
* Do NOT hallucinate visual details
* If unknown, leave unspecified instead of guessing

---

## PURPOSE

This Character Bible will be used as:

* reference image generation input
* character LoRA / consistency anchor
* cross-scene visual identity control

Therefore:

Visual stability > narrative completeness

Here is the script:
{{SCRIPT}}

`
export const GLOBAL_STYLE_TAGS = `highly detailed, sharp focus, photorealistic, production character reference`
export const REFERENCE_STYLE_SUFFIX = `Create a strict three-view character reference sheet showing the exact same single character three times in one image, arranged from left to right as: full front view, exact 90-degree side profile, and full back view. Use a clean orthographic turnaround layout. There must be exactly three figures total. The first figure faces directly toward the camera. The second figure is shown in an exact 90-degree side profile. The third figure faces completely away from the camera, showing the back of the head, hairstyle, clothing, and full rear silhouette. All three views must depict the exact same person with identical facial identity, hair, body proportions, age, costume, and accessories. Do not create a three-quarter view. Do not create a second side view. Do not repeat the front view. Do not create more than three figures. Do not merge the three views into one body. Full body must be visible in all three views, standing upright in a neutral pose, with arms relaxed naturally at the sides. Keep consistent scale, height, body proportions, clothing, hairstyle, and spacing across all three views. No action pose, walking, sitting, dramatic perspective, camera tilt, or cinematic staging. Do not include props, bags, satchels, weapons, scenery, furniture, or environmental objects. Use a flat solid white background with clean even studio lighting and no directional shadows. Do not include text, names, labels, captions, arrows, borders, dividing lines, logos, watermarks, or studio equipment. This is a neutral production character identity sheet, not a movie scene.`
