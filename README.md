# praneelbhatia.com

Personal site for Praneel Bhatia - Applied AI Engineer working on neuroadaptive systems, VLA robotics, and agentic LLM tooling.

Live at **[praneelbhatia.com](https://praneelbhatia.com)**

---

## What this is

Hand-coded, no framework, no build step. Dark "instrument bench" default with a light "datasheet" theme. Everything you see - the 3D SO-101 wireframe turntable, the live EEG trace in the hero, the animated agent session in the Redactable case study, the bin tiles scrolling in the components appendix - is plain HTML, CSS, and vanilla JS.

The goal: build the site the same way I build production systems. Spec, plan, execute, sign-off. No shortcuts.

---

## Structure

```
index.html          main site (general Applied AI lens)
robotics.html       robotics-focused variant (generated)
agents.html         agentic engineering variant (generated)
plain.html          zero-JS, all-lowercase retro fallback
styles.css          single stylesheet, ~900 lines
main.js             all interaction - tilt, EEG, IK arm, recorder, palette
build_variants.py   generates robotics.html + agents.html from index.html
```

`robotics.html` and `agents.html` are not edited directly - run `python3 build_variants.py` after any `index.html` change.

---

## Local preview

```bash
# any static server works
python3 -m http.server 8080
# then open http://localhost:8080
```

Opening `index.html` directly as a `file://` URL works for most things but breaks the View Transitions API theme flip.

---

## Lens system

The site has three URL-addressable views, each with swapped title, meta, hero subline, cred strip, and case-study order - same underlying content, different signal for different audiences:

| URL | Lens |
|---|---|
| `praneelbhatia.com` | general Applied AI + robotics |
| `robotics.praneelbhatia.com` | VLA, BCI, neuroadaptive systems |
| `agents.praneelbhatia.com` | context engineering, evals, agent harness |

A "What brings you here?" selector near the bottom of each page links between them.

---

## Design notes

- Fonts: Fraunces (serif headings), Archivo (body), Geist Mono (labels) via Google Fonts
- No glassmorphism, glows, blobs, video heroes, or auto-marquees
- 3D is a JS-projected wireframe, not WebGL or Spline
- SVG animations are state-machine loops, IO-gated, reduced-motion safe
- Theme flip uses the View Transitions API with a CSS custom-property swap
- Scroll-scrubbed ink draws use a single continuous path hidden behind opaque boxes (Chromium `stroke-dasharray` restarts per subpath)

---

## Contact

[praneel.bhatia@gmail.com](mailto:praneel.bhatia@gmail.com) - hiring, founding, or collaborating on BCI, robotics, or LLM systems.
