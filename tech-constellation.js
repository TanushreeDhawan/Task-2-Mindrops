/* =========================================================
   3D TECH CONSTELLATION
   Replaces the flat SVG "tech-arc" with a real THREE.Group
   living inside the existing hero scene (same scene/camera/
   renderer/clock/canvas that three_scene.js already created).

   - 9 sprite badges (canvas-drawn Font Awesome brand glyphs,
     reusing the exact FA webfont already loaded in index.html)
     floating at different depths to the right of the droplet.
   - Thin glowing THREE.Line edges connect neighbouring nodes
     into a constellation / node-link network.
   - THREE.Raycaster drives precision hover detection.
   - GSAP tweens the hover zoom, dim/highlight, and edge glow.
   - A single HTML label follows the hovered node in screen
     space (crisper than a canvas-drawn label at small sizes).

   Exposes window.updateTechConstellation(t, dt) which
   three_scene.js's animate() loop calls once per frame.
   ========================================================= */
(function () {
    if (typeof THREE === 'undefined' || typeof scene === 'undefined' || typeof camera === 'undefined' || typeof canvas === 'undefined') {
        console.warn('[tech-constellation] Base THREE scene not found — constellation skipped.');
        return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---------------------------------------------------
    // Tech data — same glyphs/brand colors as the old tech-arc
    // (fa-brands unicode points, kept 1:1 with the previous
    // icon classes so the visual identity carries over)
    // ---------------------------------------------------
    const TECHS = [
        { label: 'HTML',       glyph: '\uf13b', color: 0xff4d4d },
        { label: 'CSS',        glyph: '\uf38b', color: 0xff9142 },
        { label: 'JavaScript', glyph: '\uf3b9', color: 0xffd83d },
        { label: 'React JS',   glyph: '\uf41b', color: 0x7CFC6E },
        { label: 'Node.js',    glyph: '\uf419', color: 0x3dd6c2 },
        { label: 'PHP',        glyph: '\uf457', color: 0x3dc7ff },
        { label: '.NET',       glyph: '\uf3ca', color: 0x4d7dff },
        { label: 'Shopify',    glyph: '\ue057', color: 0x95bf47 },
        { label: 'WordPress',  glyph: '\uf19a', color: 0xc34dff },
        { label: 'Python',     glyph: '\uf3e2', color: 0xffd43b },
        { label: 'Java',       glyph: '\uf4e4', color: 0xf89820 },
        { label: 'Angular',    glyph: '\uf420', color: 0xdd0031 },
        { label: 'Docker',     glyph: '\uf395', color: 0x2496ed },
        { label: 'Git',        glyph: '\uf1d3', color: 0xf05033 },
    ];

    const BASE_CABLE_COLOR = 0x00d4ff;

    // ---------------------------------------------------
    // Group placement — tasteful, scaled-down backdrop to the
    // right of the central droplet, with plenty of breathing room.
    // sizeConstellation() rescales/repositions on resize so it
    // never overwhelms the composition on smaller viewports.
    // ---------------------------------------------------
    // Positive z is TOWARD the camera in this scene (camera sits at z=5.8
    // looking back at z=0 — see layout() above), and the hero droplet itself
    // sits at z=0.5. Position aligns the group's vertical center with the
    // hero card/drop, pulls inward on x so it stays contained in-viewport.
    //
    // IMPORTANT: the water plane is a child of `rig`, which is offset to
    // world y=-0.4 (see layout() in three_scene.js) — but this group is
    // added directly to `scene`, so its y is an absolute world coordinate.
    // The previous y=0.9 with the old GLOBE_RADIUS left only ~0.06 units of
    // clearance above the water at the sphere's lowest point, which is why
    // the bottom-most node (git) visibly dipped into it. y is raised and
    // GLOBE_RADIUS trimmed slightly below (1.55 -> 1.25) so the sphere's
    // top stays at the same already-confirmed-safe height clear of the
    // navbar, while its bottom now clears the water with real margin.
    const BASE_SCALE = 0.95; // up from 0.8 (~19% larger) for a more prominent presence
    const group = new THREE.Group();
    // NOTE: this scene's world units are small — the camera itself sits only
    // ~5.8 units from the origin (see layout() in three_scene.js) — so a
    // literal +5-8 unit shift would send the whole network far outside the
    // camera frustum, the opposite of "more breathing room." Applying the
    // same proportional shift as before (+0.6 to +0.7, matching the scale of
    // this scene) instead.
    group.position.set(3.9, 1.15, 2.2);
    scene.add(group);

    function sizeConstellation() {
        const w = window.innerWidth;
        if (w <= 640) {
            group.visible = false;
            return;
        }
        group.visible = true;
        const scale = (w > 1200 ? 1.0 : w > 900 ? 0.82 : 0.66) * BASE_SCALE;
        group.scale.setScalar(scale);
        // Shifted further right (2.6/2.2/1.8 -> 3.2/2.7/2.2) to clear the
        // droplet and fill the right side; scale grew in tandem above, so
        // the effective edge margin stays roughly the same as before.
        group.position.x = w > 1200 ? 3.9 : w > 900 ? 3.4 : 2.9;
    }
    sizeConstellation();
    window.addEventListener('resize', sizeConstellation);

    // ---------------------------------------------------
    // Node layout: an even Fibonacci-sphere distribution — the
    // standard way to place points uniformly on a sphere surface,
    // so the 9 badges read as sitting on a globe rather than
    // scattered along a flat helix.
    // ---------------------------------------------------
    const GLOBE_RADIUS = 1.25;

    function nodeBasePosition(i, count) {
        const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~2.39996 rad
        const y = 1 - (i / (count - 1)) * 2;               // top (1) to bottom (-1)
        const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = goldenAngle * i;
        return new THREE.Vector3(
            Math.cos(theta) * ringRadius,
            y,
            Math.sin(theta) * ringRadius
        ).multiplyScalar(GLOBE_RADIUS);
    }

    // ---------------------------------------------------
    // Globe silhouette — just 3 great-circle rings (equator + two
    // meridians), not a full tessellated wireframe. This is what makes it
    // unmistakably read as a sphere even in a single still frame (a full
    // Fibonacci point cloud alone can look like scattered dots depending on
    // rotation), while staying sparse/minimal per the "no dense grid" brief.
    // ---------------------------------------------------
    function buildGlobeRings() {
        const ringMat = () => new THREE.MeshBasicMaterial({
            color: 0x00d4ff,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
        });
        const ringGeo = new THREE.TorusGeometry(GLOBE_RADIUS, 0.006, 8, 80);

        const equator = new THREE.Mesh(ringGeo, ringMat());
        equator.rotation.x = Math.PI / 2;
        group.add(equator);

        const meridianA = new THREE.Mesh(ringGeo, ringMat());
        group.add(meridianA); // vertical, as-is

        const meridianB = new THREE.Mesh(ringGeo, ringMat());
        meridianB.rotation.y = Math.PI / 3; // second meridian at 60°, reads as a globe graticule
        group.add(meridianB);
    }

    // ---------------------------------------------------
    // Soft glow core — a single additive-blended radial sprite sitting at
    // the group's center, using the same cyan (#00d4ff / #8ff2ff) already
    // established by the page's mesh-overlay/stats-section glow — so the
    // network reads as tied to the same visual language as the rest of
    // the hero.
    // ---------------------------------------------------
    function buildGlowCore() {
        const size = 512;
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(143, 242, 255, 0.55)');
        grad.addColorStop(0.4, 'rgba(0, 212, 255, 0.22)');
        grad.addColorStop(1, 'rgba(0, 212, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        const tex = new THREE.CanvasTexture(c);
        const mat = new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const glow = new THREE.Sprite(mat);
        glow.scale.setScalar(GLOBE_RADIUS * 2.6);
        group.add(glow);
    }

    // ---------------------------------------------------
    // Canvas-drawn circular badge texture per tech, reusing the
    // Font Awesome Brands webfont already loaded via cdnjs in index.html.
    // ---------------------------------------------------
    function hexToCss(hex) {
        return '#' + hex.toString(16).padStart(6, '0');
    }

    function makeNodeTexture(tech) {
        const size = 160;
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        const cx = size / 2, cy = size / 2, r = size / 2 - 8;

        const grad = ctx.createRadialGradient(cx, cy * 0.65, r * 0.15, cx, cy, r);
        grad.addColorStop(0, 'rgba(22, 44, 66, 0.92)');
        grad.addColorStop(1, 'rgba(6, 18, 32, 0.88)');
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        const css = hexToCss(tech.color);
        ctx.lineWidth = 6;
        ctx.strokeStyle = css;
        ctx.shadowColor = css;
        ctx.shadowBlur = 22;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '400 ' + Math.round(size * 0.42) + 'px "Font Awesome 6 Brands"';
        ctx.fillText(tech.glyph, cx, cy + size * 0.02);

        const tex = new THREE.CanvasTexture(c);
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        return tex;
    }

    // ---------------------------------------------------
    // Build nodes (sprites so they always face the camera)
    // ---------------------------------------------------
    const NODE_BASE_SCALE = 0.42;
    const nodes = [];

    function buildNodes() {
        TECHS.forEach((tech, i) => {
            const basePos = nodeBasePosition(i, TECHS.length);
            const tex = makeNodeTexture(tech);
            const material = new THREE.SpriteMaterial({
                map: tex,
                transparent: true,
                opacity: 1,
                depthWrite: false,
            });
            const sprite = new THREE.Sprite(material);
            sprite.position.copy(basePos);
            sprite.scale.setScalar(NODE_BASE_SCALE);
            sprite.userData.techIndex = i;
            group.add(sprite);

            nodes.push({
                sprite,
                tech,
                basePos,
                baseScale: NODE_BASE_SCALE,
                phase: Math.random() * Math.PI * 2,
                speed: 0.25 + Math.random() * 0.15,
                amp: 0.015 + Math.random() * 0.012, // subtle — keeps nodes reading as sitting on the globe surface
            });
        });
    }

    // ---------------------------------------------------
    // Build connecting edges as gentle curved arcs (not straight chords) —
    // bulging outward from the globe center, the same visual language as
    // flight-path/undersea-cable network maps. Kept sparse (nearest-neighbor
    // only) and subtle (opacity 0.15-0.25) per the "minimalist connections"
    // brief; the arc shape itself is what reads as premium rather than density.
    // ---------------------------------------------------
    const edges = [];
    const ARC_SEGMENTS = 16;
    const ARC_BULGE = GLOBE_RADIUS * 0.32;

    function addEdge(a, b) {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array((ARC_SEGMENTS + 1) * 3);
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.LineBasicMaterial({
            color: BASE_CABLE_COLOR,
            transparent: true,
            opacity: 0.18, // within the requested 0.15-0.25 band
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const line = new THREE.Line(geo, material);
        line.frustumCulled = false; // bounding sphere isn't recomputed every frame as the arc moves
        group.add(line);
        edges.push({ line, material, a, b });
    }

    // Evaluates the quadratic-bezier arc between two node positions and
    // writes the sampled points directly into the line's position buffer —
    // avoids allocating new geometry every frame.
    const _mid = new THREE.Vector3();
    const _ctrl = new THREE.Vector3();
    function updateEdgeArc(edge) {
        const pA = nodes[edge.a].sprite.position;
        const pB = nodes[edge.b].sprite.position;
        _mid.addVectors(pA, pB).multiplyScalar(0.5);
        // Push the control point outward along the midpoint's own direction
        // from the globe center — this is what creates the outward "bulge".
        _ctrl.copy(_mid).normalize().multiplyScalar(_mid.length() + ARC_BULGE);

        const posAttr = edge.line.geometry.attributes.position;
        for (let s = 0; s <= ARC_SEGMENTS; s++) {
            const t = s / ARC_SEGMENTS;
            const inv = 1 - t;
            const x = inv * inv * pA.x + 2 * inv * t * _ctrl.x + t * t * pB.x;
            const y = inv * inv * pA.y + 2 * inv * t * _ctrl.y + t * t * pB.y;
            const z = inv * inv * pA.z + 2 * inv * t * _ctrl.z + t * t * pB.z;
            posAttr.setXYZ(s, x, y, z);
        }
        posAttr.needsUpdate = true;
    }

    function buildEdges() {
        // Sequential index order no longer corresponds to spatial proximity
        // once nodes sit on a sphere, so connect each node to its 3 nearest
        // neighbors by actual 3D distance (bumped from 2) — this is what
        // guarantees every node reads as part of one connected globe
        // network rather than a few nodes looking like isolated outliers.
        const seen = new Set();
        nodes.forEach((n, i) => {
            const distances = nodes
                .map((other, j) => ({ j, d: n.basePos.distanceTo(other.basePos) }))
                .filter((e) => e.j !== i)
                .sort((a, b) => a.d - b.d);

            distances.slice(0, 3).forEach(({ j }) => {
                const key = i < j ? `${i}-${j}` : `${j}-${i}`;
                if (seen.has(key)) return;
                seen.add(key);
                addEdge(i, j);
            });
        });
    }

    // ---------------------------------------------------
    // HTML label that tracks the hovered node in screen space
    // (crisper text than a baked-in canvas label at this scale)
    // ---------------------------------------------------
    const labelEl = document.getElementById('tech-node-label');
    const projectVec = new THREE.Vector3();

    function updateLabel(hoverEntry) {
        if (!labelEl) return;
        if (!hoverEntry) {
            labelEl.classList.remove('is-visible');
            return;
        }
        projectVec.copy(hoverEntry.sprite.position).applyMatrix4(group.matrixWorld);
        projectVec.project(camera);

        const rect = canvas.getBoundingClientRect();
        const x = (projectVec.x * 0.5 + 0.5) * rect.width;
        const y = (-projectVec.y * 0.5 + 0.5) * rect.height;

        labelEl.textContent = hoverEntry.tech.label;
        labelEl.style.setProperty('--nc', hexToCss(hoverEntry.tech.color));
        labelEl.style.left = x + 'px';
        labelEl.style.top = y + 'px';
        labelEl.classList.add('is-visible');
    }

    // ---------------------------------------------------
    // Raycaster-driven hover (own instances — three_scene.js
    // already owns `raycaster`/`pointerNDC` for droplet clicks)
    // ---------------------------------------------------
    const hoverRay = new THREE.Raycaster();
    const hoverPointer = new THREE.Vector2(-10, -10);
    let hoveredIndex = -1;

    function setHover(index) {
        if (index === hoveredIndex) return;
        hoveredIndex = index;

        nodes.forEach((n, i) => {
            const isHovered = i === index;
            const isDimmed = index !== -1 && !isHovered;
            const targetScale = isHovered ? n.baseScale * 1.4 : n.baseScale;
            const targetOpacity = isDimmed ? 0.35 : 1;

            gsap.to(n.sprite.scale, {
                x: targetScale, y: targetScale, z: targetScale,
                duration: 0.35, ease: 'back.out(2)',
            });
            gsap.to(n.sprite.material, {
                opacity: targetOpacity, duration: 0.3, ease: 'power2.out',
            });
        });

        edges.forEach((e) => {
            const isAdjacent = index !== -1 && (e.a === index || e.b === index);
            if (isAdjacent) e.material.color.setHex(nodes[index].tech.color);
            else e.material.color.setHex(BASE_CABLE_COLOR);

            const targetOpacity = index === -1 ? 0.18 : isAdjacent ? 0.85 : 0.06;
            gsap.to(e.material, { opacity: targetOpacity, duration: 0.3, ease: 'power2.out' });
        });

        updateLabel(index === -1 ? null : nodes[index]);
    }

    function onPointerMove(e) {
        const rect = canvas.getBoundingClientRect();
        hoverPointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        hoverPointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    }
    function onPointerLeave() {
        hoverPointer.set(-10, -10);
        setHover(-1);
    }
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);

    function pickHover() {
        if (!group.visible) { setHover(-1); return; }
        hoverRay.setFromCamera(hoverPointer, camera);
        const hits = hoverRay.intersectObjects(nodes.map((n) => n.sprite), false);
        setHover(hits.length ? hits[0].object.userData.techIndex : -1);
    }

    // ---------------------------------------------------
    // Init
    // ---------------------------------------------------
    async function init() {
        try {
            await document.fonts.load('400 64px "Font Awesome 6 Brands"');
            await document.fonts.ready;
        } catch (e) { /* proceed with fallback glyph rendering */ }

        buildGlowCore();
        buildGlobeRings();
        buildNodes();
        buildEdges();
        sizeConstellation();
    }
    init();

    // ---------------------------------------------------
    // Per-frame update — called from three_scene.js's animate()
    // ---------------------------------------------------
    window.updateTechConstellation = function (t, dt) {
        if (!nodes.length) return;

        // Idle drift: each node breathes gently around its base position
        nodes.forEach((n) => {
            if (prefersReducedMotion) {
                n.sprite.position.copy(n.basePos);
                return;
            }
            const wobble = Math.sin(t * n.speed + n.phase) * n.amp;
            const wobble2 = Math.cos(t * n.speed * 0.7 + n.phase) * n.amp * 0.6;
            n.sprite.position.set(
                n.basePos.x + wobble2,
                n.basePos.y + wobble,
                n.basePos.z + wobble2 * 0.5
            );
        });

        // Edge arcs re-sampled each frame to follow the drifting/rotating nodes
        edges.forEach((e) => updateEdgeArc(e));

        // Continuous, frame-rate-independent auto-rotation (dt-based, equivalent
        // to += 0.002/frame @60fps) — this is what actually reveals the depth
        // layering as it turns, unlike the old narrow back-and-forth sway.
        if (!prefersReducedMotion) {
            group.rotation.y += 0.12 * dt;
            group.rotation.x = Math.sin(t * 0.05) * 0.06; // subtle tilt only, no full spin on x
        }
        group.updateMatrixWorld(true);

        pickHover();
        if (hoveredIndex !== -1) updateLabel(nodes[hoveredIndex]);
    };
})();
