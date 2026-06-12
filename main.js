/* ================================================================
   praneelbhatia.com v2 - INSTRUMENT BENCH
   hand-coded vanilla JS. one rAF ticker drives every live element.
   ================================================================ */
(function () {
  "use strict";

  var doc = document, root = doc.documentElement;
  root.classList.add("js");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- seeded PRNG (deterministic waveforms) ---------------- */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(20260611);

  /* ---------------- theme: SPDT switch ---------------- */
  var spdt = doc.getElementById("theme-switch");
  var themeMeta = doc.querySelector('meta[name="theme-color"]');
  function setTheme(t) {
    root.setAttribute("data-theme", t);
    spdt.setAttribute("aria-checked", t === "dark" ? "true" : "false");
    spdt.setAttribute("aria-label", t === "dark" ? "Color theme: dark" : "Color theme: light");
    if (themeMeta) themeMeta.setAttribute("content", t === "dark" ? "#0B0D0C" : "#F4F2EC");
    try { localStorage.setItem("pb-theme", t); } catch (e) {}
  }
  var savedTheme = null;
  try { savedTheme = localStorage.getItem("pb-theme"); } catch (e) {}
  setTheme(savedTheme === "light" ? "light" : "dark");
  spdt.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    if (doc.startViewTransition && !reduced) doc.startViewTransition(function () { setTheme(next); });
    else setTheme(next);
  });

  /* ---------------- power-on choreography ---------------- */
  (function boot() {
    var seen = false;
    try { seen = !!sessionStorage.getItem("pb-booted"); } catch (e) {}
    if (reduced || seen) return;
    try { sessionStorage.setItem("pb-booted", "1"); } catch (e) {}
    var ov = doc.getElementById("boot");
    var stages = [".boot-1", ".boot-2", ".boot-3", ".boot-4", ".boot-5"];
    var els = doc.querySelectorAll(stages.join(","));
    for (var i = 0; i < els.length; i++) els[i].classList.add("boot-stage");
    ov.hidden = false;
    var delays = [120, 260, 380, 480, 560];
    stages.forEach(function (sel, idx) {
      setTimeout(function () {
        doc.querySelectorAll(sel).forEach(function (el) { el.classList.add("on"); });
      }, 320 + delays[idx]);
    });
    function skip() { ov.classList.add("fade"); setTimeout(function () { if (ov.parentNode) ov.remove(); }, 320); }
    setTimeout(skip, 420);
    /* failsafe: the overlay must never be able to strand the page */
    setTimeout(function () { if (ov.parentNode) ov.remove(); }, 1800);
    /* entrance classes must not linger: .boot-stage.on carries a 0.45s transform
       transition that would smear the per-frame 3D tilt into nothing */
    setTimeout(function () {
      doc.querySelectorAll(".boot-stage").forEach(function (el) { el.classList.remove("boot-stage", "on"); });
    }, 1500);
    ov.addEventListener("click", skip);
  })();

  /* ---------------- central ticker ---------------- */
  var subs = [], running = false, lastT = 0;
  function tick(ts) {
    if (!running) return;
    var dt = Math.min(64, ts - lastT || 16); lastT = ts;
    for (var i = 0; i < subs.length; i++) if (subs[i].active) subs[i].fn(dt, ts);
    requestAnimationFrame(tick);
  }
  function startTicker() {
    if (running || reduced) return;
    running = true; lastT = 0;
    requestAnimationFrame(function (ts) { lastT = ts; requestAnimationFrame(tick); });
  }
  function stopTicker() { running = false; }
  doc.addEventListener("visibilitychange", function () {
    if (doc.hidden) stopTicker(); else startTicker();
  });
  var rmq = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (rmq.addEventListener) rmq.addEventListener("change", function (e) {
    reduced = e.matches;
    if (reduced) stopTicker(); else startTicker();
  });

  /* ================================================================
     THE LOOP BENCH
     ================================================================ */
  var bench = doc.getElementById("bench");
  var benchVisible = true;

  /* ---- EEG scope trace ---- */
  var tracePath = doc.getElementById("eeg-trace");
  var TRACE = { n: 96, x0: 34, x1: 222, yMid: 146, amp: 30, pts: [], t: 0, burst: 0 };
  (function initTrace() {
    for (var i = 0; i < TRACE.n; i++) TRACE.pts.push(0);
  })();
  function traceSample(t) {
    var v = Math.sin(t * 0.9) * 0.32 + Math.sin(t * 2.3 + 1.4) * 0.22 + Math.sin(t * 5.1 + 0.3) * 0.12 + (rand() - 0.5) * 0.34;
    return v * (1 + TRACE.burst * 2.4);
  }
  function drawTrace() {
    var w = (TRACE.x1 - TRACE.x0) / (TRACE.n - 1), d = "";
    for (var i = 0; i < TRACE.n; i++) {
      var x = (TRACE.x0 + i * w).toFixed(1);
      var y = (TRACE.yMid + TRACE.pts[i] * TRACE.amp).toFixed(1);
      d += (i === 0 ? "M" : "L") + x + "," + y;
    }
    tracePath.setAttribute("d", d);
  }
  var traceAcc = 0;
  subs.push({ active: true, fn: function (dt) {
    if (!benchVisible) return;
    traceAcc += dt;
    while (traceAcc > 28) {
      traceAcc -= 28;
      TRACE.t += 0.18;
      TRACE.pts.push(traceSample(TRACE.t));
      TRACE.pts.shift();
      if (TRACE.burst > 0) TRACE.burst = Math.max(0, TRACE.burst - 0.06);
    }
    drawTrace();
  }});

  /* ---- four neural channels ---- */
  function Channel(id, base, vol) {
    this.g = doc.getElementById("nch-" + id);
    this.spark = this.g.querySelector(".nch-spark");
    this.val = this.g.querySelector(".b-val");
    this.base = base; this.vol = vol; this.v = base;
    this.hist = []; for (var i = 0; i < 40; i++) this.hist.push(base);
    this.x0 = 78; this.dx = 1.9;
    this.kick = 0;
  }
  Channel.prototype.step = function () {
    this.v += (rand() - 0.5) * this.vol * 2 + (this.base - this.v) * 0.08 + this.kick;
    this.kick *= 0.62;
    this.v = Math.max(0.02, Math.min(0.98, this.v));
    this.hist.push(this.v); this.hist.shift();
    var d = "";
    for (var i = 0; i < this.hist.length; i++) {
      d += (i === 0 ? "M" : "L") + (this.x0 + i * this.dx).toFixed(1) + "," + (24 - this.hist[i] * 16).toFixed(1);
    }
    this.spark.setAttribute("d", d);
    this.val.textContent = this.v.toFixed(2);
  };
  Channel.prototype.spike = function (mag) { this.kick = mag; };
  var chans = {
    agreement: new Channel("agreement", 0.78, 0.04),
    workload: new Channel("workload", 0.42, 0.05),
    surprise: new Channel("surprise", 0.15, 0.06),
    error: new Channel("error", 0.06, 0.03)
  };
  var chanAcc = 0;
  subs.push({ active: true, fn: function (dt) {
    if (!benchVisible) return;
    chanAcc += dt;
    while (chanAcc > 120) {
      chanAcc -= 120;
      for (var k in chans) chans[k].step();
    }
  }});

  /* ---- typewriter for neuro-hints ---- */
  var hint1 = doc.getElementById("hint-1"), hint2 = doc.getElementById("hint-2");
  var typeTimer = null;
  function typeHint(l1, l2, done) {
    clearInterval(typeTimer);
    hint1.textContent = ""; hint2.textContent = "";
    var full = [l1, l2], li = 0, ci = 0;
    typeTimer = setInterval(function () {
      if (li >= full.length) { clearInterval(typeTimer); if (done) done(); return; }
      ci++;
      (li === 0 ? hint1 : hint2).textContent = full[li].slice(0, ci);
      if (ci >= full[li].length) { li++; ci = 0; }
    }, 26);
  }

  /* ---- robot arm: analytic 2-link IK + sequenced routine ---- */
  var J1 = doc.getElementById("j1"), J2 = doc.getElementById("j2"), J3 = doc.getElementById("j3");
  var GL = doc.getElementById("grip-l"), GR = doc.getElementById("grip-r");
  var blockEl = doc.getElementById("block");
  var statusEl = doc.getElementById("act-status");
  var reasonDot = doc.getElementById("reason-dot");
  var benchLeds = doc.querySelectorAll("#bench-led .b-led");
  var BASE = { x: 648, y: 290 }, L1 = 64, L2 = 52, TIPLEN = 24;
  var BLOCK_HOME = { x: 596, y: 276 };

  function rad(d) { return d * Math.PI / 180; }
  function wrapDeg(d) { while (d > 180) d -= 360; while (d < -180) d += 360; return d; }

  /* IK: solve a1,a2 so the j3 pivot lands on (tx,ty); a3 orients the gripper straight down */
  function ikPose(tx, ty, grip) {
    var X = tx - BASE.x, Y = BASE.y - ty;
    var D = (X * X + Y * Y - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    D = Math.max(-1, Math.min(1, D));
    var phi = Math.acos(D);
    var best = null;
    [phi, -phi].forEach(function (p) {
      var t1 = Math.atan2(X, Y) - Math.atan2(L2 * Math.sin(p), L1 + L2 * Math.cos(p));
      var a1 = t1 * 180 / Math.PI, a2 = p * 180 / Math.PI;
      var ex = BASE.x + L1 * Math.sin(t1), ey = BASE.y - L1 * Math.cos(t1);
      var cand = { a1: a1, a2: a2, ey: ey, ex: ex };
      if (!best || cand.ey < best.ey) best = cand; /* prefer elbow arched up */
    });
    var a3 = wrapDeg(180 - best.a1 - best.a2);
    return { a1: best.a1, a2: best.a2, a3: a3, grip: grip };
  }
  function fkTip(p) {
    var t1 = rad(p.a1), t12 = rad(p.a1 + p.a2), t123 = rad(p.a1 + p.a2 + p.a3);
    var x = BASE.x + L1 * Math.sin(t1) + L2 * Math.sin(t12) + TIPLEN * Math.sin(t123);
    var y = BASE.y - L1 * Math.cos(t1) - L2 * Math.cos(t12) - TIPLEN * Math.cos(t123);
    return { x: x, y: y };
  }

  var pose = { a1: -18, a2: -34, a3: -26, grip: 3 };
  var POSES = {
    home:      { a1: -18, a2: -34, a3: -26, grip: 3 },
    miss:      ikPose(575, 240, 3),
    grasp:     ikPose(603, 254, 3),
    closed:    ikPose(603, 254, 0),
    lift:      ikPose(603, 224, 0),
    overTray:  ikPose(548, 232, 0),
    lower:     ikPose(544, 250, 0),
    release:   ikPose(544, 250, 3)
  };

  function renderArm() {
    J1.setAttribute("transform", "rotate(" + pose.a1.toFixed(2) + ")");
    J2.setAttribute("transform", "translate(0,-64) rotate(" + pose.a2.toFixed(2) + ")");
    J3.setAttribute("transform", "translate(0,-52) rotate(" + pose.a3.toFixed(2) + ")");
    GL.setAttribute("transform", "translate(" + (-pose.grip).toFixed(2) + ",0)");
    GR.setAttribute("transform", "translate(" + pose.grip.toFixed(2) + ",0)");
  }
  function easeSettle(t) { return 1 - Math.pow(1 - t, 3); }

  /* sequencer */
  var seq = { steps: [], i: 0, t: 0, from: null, holding: 0, carrying: false, cycle: 0 };
  var HINTS = [
    ["lower approach", "re-target the grasp"],
    ["slow the wrist", "align to the block"],
    ["shift left", "approach from above"]
  ];
  function setStatus(txt, err) {
    statusEl.textContent = txt;
    statusEl.classList.toggle("err", !!err);
  }
  function ledBlink() {
    benchLeds.forEach(function (l) { l.classList.remove("blink"); void l.getBBox(); l.classList.add("blink"); });
  }
  function buildCycle() {
    var hint = HINTS[seq.cycle % HINTS.length];
    return [
      { to: POSES.miss, dur: 1100, onStart: function () {
          setStatus("REACHING", false);
          blockEl.classList.remove("gone");
          blockEl.setAttribute("x", BLOCK_HOME.x); blockEl.setAttribute("y", BLOCK_HOME.y);
          hint1.textContent = ""; hint2.textContent = "";
        } },
      { hold: 280, onStart: function () {
          bench.classList.add("err");
          setStatus("ERROR DETECTED", true);
          chans.error.spike(0.8); chans.surprise.spike(0.5); chans.agreement.spike(-0.3);
          TRACE.burst = 1;
        } },
      { hold: 1500, onStart: function () {
          reasonDot.classList.add("think");
          typeHint(hint[0], hint[1]);
        } },
      { to: POSES.grasp, dur: 760, onStart: function () {
          bench.classList.remove("err");
          setStatus("CORRECTING", false);
        } },
      { to: POSES.closed, dur: 240, onStart: function () { setStatus("GRASP OK", false); } },
      { hold: 120, onStart: function () {
          chans.agreement.spike(0.35);
          reasonDot.classList.remove("think");
          firePulse(fbPulse, fbWire, 950, true);
          ledBlink();
        } },
      { to: POSES.lift, dur: 480, carry: true },
      { to: POSES.overTray, dur: 820, carry: true },
      { to: POSES.lower, dur: 360, carry: true },
      { to: POSES.release, dur: 220, onDone: function () {
          blockEl.setAttribute("x", 537); blockEl.setAttribute("y", 268);
          setStatus("PLACED · NO RETRAINING", false);
        } },
      { to: POSES.home, dur: 900 },
      { hold: 900, onDone: function () { blockEl.classList.add("gone"); } },
      { hold: 350 }
    ];
  }
  function lerpPose(a, b, t) {
    return {
      a1: a.a1 + (b.a1 - a.a1) * t,
      a2: a.a2 + (b.a2 - a.a2) * t,
      a3: a.a3 + (b.a3 - a.a3) * t,
      grip: a.grip + (b.grip - a.grip) * t
    };
  }
  subs.push({ active: true, fn: function (dt) {
    if (!benchVisible) return;
    if (!seq.steps.length) { seq.steps = buildCycle(); seq.i = 0; seq.t = 0; seq.started = false; }
    var st = seq.steps[seq.i];
    if (!st) {
      seq.cycle++; seq.steps = buildCycle(); seq.i = 0; seq.t = 0; seq.started = false;
      return;
    }
    if (!seq.started) {
      seq.started = true; seq.t = 0; seq.from = { a1: pose.a1, a2: pose.a2, a3: pose.a3, grip: pose.grip };
      if (st.onStart) st.onStart();
    }
    seq.t += dt;
    var dur = st.dur || st.hold || 1;
    var p = Math.min(1, seq.t / dur);
    if (st.to) {
      pose = lerpPose(seq.from, st.to, easeSettle(p));
      renderArm();
      if (st.carry) {
        var tip = fkTip(pose);
        blockEl.setAttribute("x", (tip.x - 7).toFixed(1));
        blockEl.setAttribute("y", (tip.y - 8).toFixed(1));
      }
    }
    if (p >= 1) {
      if (st.onDone) st.onDone();
      seq.i++; seq.started = false;
    }
  }});

  /* ---- pulses travelling along paths ---- */
  var fbWire = doc.getElementById("fb-wire"), fbPulse = doc.getElementById("fb-pulse");
  var pulses = [];
  function firePulse(dotEl, pathEl, dur, reverse) {
    if (reduced || !dotEl || !pathEl) return;
    pulses.push({ dot: dotEl, path: pathEl, len: pathEl.getTotalLength(), t: 0, dur: dur, rev: !!reverse });
  }
  subs.push({ active: true, fn: function (dt) {
    for (var i = pulses.length - 1; i >= 0; i--) {
      var p = pulses[i];
      p.t += dt;
      var k = Math.min(1, p.t / p.dur);
      var at = p.rev ? p.len * k : p.len * (1 - k);
      var pt = p.path.getPointAtLength(at);
      p.dot.setAttribute("cx", pt.x); p.dot.setAttribute("cy", pt.y);
      p.dot.setAttribute("opacity", k > 0.97 ? 0 : 1);
      if (k >= 1) pulses.splice(i, 1);
    }
  }});

  /* ---- bench session clock ---- */
  var benchClock = doc.getElementById("bench-clock"), sessionStart = Date.now();
  setInterval(function () {
    if (!benchClock) return;
    var s = Math.floor((Date.now() - sessionStart) / 1000);
    var mm = String(Math.floor(s / 60)).padStart(2, "0"), ss = String(s % 60).padStart(2, "0");
    benchClock.textContent = "SESSION " + mm + ":" + ss;
  }, 1000);

  /* ---- bench visibility gates the whole instrument ---- */
  if ("IntersectionObserver" in window && bench) {
    new IntersectionObserver(function (entries) {
      benchVisible = entries[0].isIntersecting;
    }, { threshold: 0.05 }).observe(bench);
  }

  /* ---- reduced motion: resolve the scene statically ---- */
  if (reduced) {
    pose = POSES.release; renderArm();
    blockEl.setAttribute("x", 537); blockEl.setAttribute("y", 268);
    setStatus("PLACED · NO RETRAINING", false);
    hint1.textContent = "lower approach"; hint2.textContent = "re-target the grasp";
    drawTrace();
    for (var ck in chans) chans[ck].step();
  }

  /* ================================================================
     SCROLL SYSTEMS
     ================================================================ */

  /* ---- reveal observer ---- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add("in"); io.unobserve(en.target);
        /* once the entrance settles, drop the classes: .reveal.in keeps a 0.6s
           transform transition that out-specifies .tilt and lags the card tilt */
        setTimeout(function () { en.target.classList.remove("reveal", "in"); }, 700);
      }
    });
  }, { threshold: 0.08 });
  doc.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

  /* on narrow screens the chart recorder scrolls; start at NOW (right edge),
     not 2021, so the strongest data points are visible by default */
  if (window.innerWidth < 750) {
    doc.querySelectorAll(".recorder").forEach(function (el) { el.scrollLeft = el.scrollWidth; });
  }

  /* ---- gauges ---- */
  function countUp(el) {
    var to = parseFloat(el.getAttribute("data-to")), prefix = el.getAttribute("data-prefix") || "";
    if (reduced) { el.textContent = prefix + to; return; }
    var t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / 700);
      el.textContent = prefix + Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var gaugeIo = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add("lit");
      var c = en.target.querySelector(".count");
      if (c) countUp(c);
      gaugeIo.unobserve(en.target);
    });
  }, { threshold: 0.4 });
  doc.querySelectorAll(".gauge").forEach(function (el) { gaugeIo.observe(el); });

  /* ---- in-view class for case-study visuals ---- */
  var vizIo = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("in-view"); vizIo.unobserve(en.target); }
    });
  }, { threshold: 0.35 });
  doc.querySelectorAll("#pipeline-viz, #xr-viz, #gate-viz").forEach(function (el) { vizIo.observe(el); });

  /* pipeline: scroll scrubs the 3-5 week bar down to the 18-hour bar */
  var pipeBefore = doc.getElementById("pipe-before");
  var pipeHost = doc.getElementById("cs-linkedchat");
  function updatePipeline() {
    if (!pipeBefore || !pipeHost || reduced) return;
    var r = pipeHost.getBoundingClientRect(), vh = window.innerHeight;
    var p = Math.max(0, Math.min(1, (vh * 0.82 - r.top) / Math.max(1, r.height * 0.9)));
    pipeBefore.setAttribute("width", (360 - 351 * easeSettle(p)).toFixed(1));
  }

  /* SocialTree gate token: propose -> gate -> truth, on loop while visible */
  var gateViz = doc.getElementById("gate-viz");
  var gateToken = doc.getElementById("gate-token");
  var gateBar = doc.getElementById("gate-bar");
  if (gateViz && gateToken && !reduced) {
    var gateVisible = false, gateT = 0, gateAng = 0;
    new IntersectionObserver(function (entries) { gateVisible = entries[0].isIntersecting; }, { threshold: 0.3 }).observe(gateViz);
    subs.push({ active: true, fn: function (dt) {
      if (!gateVisible) return;
      gateT = (gateT + dt) % 4200;
      var t = gateT, x, op = 1;
      if (t < 1100) { x = 120 + (88 * easeSettle(t / 1100)); }            /* approach gate */
      else if (t < 2100) { x = 208; op = (Math.floor(t / 160) % 2) ? 0.45 : 1; } /* waiting at gate */
      else if (t < 3300) { x = 208 + (130 * easeSettle((t - 2100) / 1200)); }    /* confirmed, to DB */
      else { x = 338; op = Math.max(0, 1 - (t - 3300) / 500); }
      gateToken.setAttribute("cx", x); gateToken.setAttribute("cy", 94);
      gateToken.setAttribute("opacity", op.toFixed(2));
      /* the confirm gate physically opens while the token passes */
      var gateTarget = (t >= 2050 && t < 3200) ? -56 : 0;
      gateAng += (gateTarget - gateAng) * 0.14;
      if (gateBar) gateBar.setAttribute("transform", "rotate(" + gateAng.toFixed(1) + " 208 130)");
    }});
  }

  /* ---- motion study: light frames by scroll progress through the article ---- */
  var msFrames = doc.querySelectorAll(".ms-frame");
  var msHost = doc.getElementById("cs-robotics");
  function updateMotionStudy() {
    if (!msHost || !msFrames.length) return;
    var r = msHost.getBoundingClientRect();
    var vh = window.innerHeight;
    var prog = Math.max(0, Math.min(1, (vh * 0.78 - r.top) / Math.max(1, r.height * 0.85)));
    var lit = Math.floor(prog * (msFrames.length + 0.6));
    msFrames.forEach(function (f, i) { f.classList.toggle("lit", i < lit); });
  }

  /* ---- schematic: wire inks itself as you scroll past, pulse on full reveal ---- */
  var schemWire = doc.getElementById("schem-wire"), schemPulse = doc.getElementById("schem-pulse");
  var schemEl = doc.getElementById("schematic"), schemLen = 0;
  if (schemWire && schemPulse && schemEl) {
    if (!reduced) {
      schemLen = schemWire.getTotalLength();
      schemWire.style.strokeDasharray = schemLen;
      schemWire.style.strokeDashoffset = schemLen;
    }
    var schemIo = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        setTimeout(function () { firePulse(schemPulse, schemWire, 1600, true); }, 600);
        schemIo.disconnect();
      }
    }, { threshold: 0.55 });
    schemIo.observe(schemEl);
  }
  function updateSchematic() {
    if (!schemLen) return;
    var r = schemEl.getBoundingClientRect(), vh = window.innerHeight;
    var p = Math.max(0, Math.min(1, (vh * 0.92 - r.top) / (r.height + vh * 0.35)));
    schemWire.style.strokeDashoffset = (schemLen * (1 - p)).toFixed(1);
  }

  /* ---- contact echo pulse: the loop closes where you can reach me ---- */
  var echoPath = doc.getElementById("echo-path"), echoPulse = doc.getElementById("echo-pulse");
  if (echoPath && echoPulse && !reduced) {
    var echoVisible = false, echoAcc = 4200;
    new IntersectionObserver(function (entries) { echoVisible = entries[0].isIntersecting; }, { threshold: 0.2 })
      .observe(doc.getElementById("contact"));
    subs.push({ active: true, fn: function (dt) {
      if (!echoVisible) return;
      echoAcc += dt;
      if (echoAcc > 5000) { echoAcc = 0; firePulse(echoPulse, echoPath, 1900, true); }
    }});
  }

  /* ---- spine playhead + scrollspy ---- */
  var spine = doc.getElementById("spine"), spineHead = doc.getElementById("spine-head");
  var spineLinks = spine ? spine.querySelectorAll("a") : [];
  var navLinks = doc.querySelectorAll(".nav-links a");
  var spyIds = ["top", "proof", "work", "method", "experience", "papers", "capabilities", "contact"];
  var spyIo = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var id = en.target.id;
      spineLinks.forEach(function (a) { a.classList.toggle("active", a.getAttribute("data-spy") === id); });
      navLinks.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + id); });
    });
  }, { rootMargin: "-32% 0px -58% 0px" });
  spyIds.forEach(function (id) { var el = doc.getElementById(id); if (el) spyIo.observe(el); });

  var scrollQueued = false, velLastY = window.scrollY;
  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(function () {
      scrollQueued = false;
      var y = window.scrollY;
      if (spineHead) {
        var track = spine.querySelector(".spine-track");
        var max = track.clientHeight - 14;
        var prog = y / Math.max(1, doc.body.scrollHeight - window.innerHeight);
        spineHead.style.top = (prog * max).toFixed(1) + "px";
      }
      /* the instrument senses you: scroll velocity perturbs the EEG */
      var dv = Math.abs(y - velLastY); velLastY = y;
      if (dv > 8 && !reduced) TRACE.burst = Math.min(0.45, TRACE.burst + dv * 0.00032);
      heroRecede = Math.max(0, Math.min(1, y / (window.innerHeight * 1.15)));
      updateMotionStudy();
      updateSchematic();
      updatePipeline();
      updateWords();
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- contact heading develops word by word ---- */
  var contactH = doc.querySelector(".contact-block h3"), wWords = [];
  if (contactH) {
    (function split(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) {
          var frag = doc.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach(function (tok) {
            if (tok === "" || /^\s+$/.test(tok)) { frag.appendChild(doc.createTextNode(tok)); return; }
            var sp = doc.createElement("span"); sp.className = "w"; sp.textContent = tok;
            frag.appendChild(sp); wWords.push(sp);
          });
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1) split(ch);
      });
    })(contactH);
    contactH.classList.add("wreveal");
  }
  function updateWords() {
    if (!wWords.length) return;
    var r = contactH.getBoundingClientRect(), vh = window.innerHeight;
    var p = Math.max(0, Math.min(1, (vh * 0.92 - r.top) / (vh * 0.5)));
    var lit = Math.round(p * wWords.length);
    wWords.forEach(function (w, i) { w.classList.toggle("on", i < lit); });
  }

  /* ---- hero inertial depth + crosshair probe (fine pointers only) ---- */
  var finePointer = window.matchMedia("(pointer: fine)").matches;
  var heroEl = doc.querySelector(".hero"), heroBg = doc.querySelector(".hero-grid-bg");
  var wellS = doc.getElementById("well-sense"), wellR = doc.getElementById("well-reason"), wellA = doc.getElementById("well-act");
  var heroRecede = 0;
  if (heroEl && bench && finePointer && !reduced) {
    var dTx = 0, dTy = 0, dX = 0, dY = 0;
    heroEl.addEventListener("pointermove", function (e) {
      dTx = (e.clientX / window.innerWidth - 0.5) * 2;
      dTy = (e.clientY / window.innerHeight - 0.5) * 2;
    });
    heroEl.addEventListener("pointerleave", function () { dTx = 0; dTy = 0; });
    subs.push({ active: true, fn: function (dt, ts) {
      dX += (dTx - dX) * 0.09; dY += (dTy - dY) * 0.09;
      /* virtual gaze = cursor steering + a slow idle orbit, so the panel
         visibly sits in 3D even before the cursor moves */
      var ax = dX + Math.sin(ts * 0.00052) * 0.32;
      var ay = dY + Math.cos(ts * 0.00037) * 0.26;
      if (heroBg) heroBg.style.transform = "translate(" + (ax * -10).toFixed(1) + "px," + (ay * -7).toFixed(1) + "px)";
      /* the bench is a real 3D panel: cursor steers it, idle drifts it, scrolling away reclines it */
      bench.style.transform = "perspective(1000px) rotateY(" + (ax * 5).toFixed(2) + "deg) rotateX(" + (-ay * 3.5 + heroRecede * 7).toFixed(2) + "deg) translateY(" + (heroRecede * -12).toFixed(1) + "px)";
      if (wellS) wellS.setAttribute("transform", "translate(" + (ax * 5).toFixed(2) + "," + (ay * 3.4).toFixed(2) + ")");
      if (wellR) wellR.setAttribute("transform", "translate(" + (ax * 2.6).toFixed(2) + "," + (ay * 1.8).toFixed(2) + ")");
      if (wellA) wellA.setAttribute("transform", "translate(" + (ax * 6.2).toFixed(2) + "," + (ay * 4.2).toFixed(2) + ")");
    }});
  }
  var probe = doc.getElementById("probe");
  if (probe && bench && finePointer && !reduced) {
    var pTx = 0, pTy = 0, pX = 0, pY = 0, probeOn = false;
    bench.addEventListener("pointermove", function (e) {
      var r = bench.getBoundingClientRect();
      pTx = e.clientX - r.left; pTy = e.clientY - r.top;
      if (!probeOn) { probeOn = true; pX = pTx; pY = pTy; probe.hidden = false; }
    });
    bench.addEventListener("pointerleave", function () { probeOn = false; probe.hidden = true; });
    subs.push({ active: true, fn: function () {
      if (!probeOn) return;
      pX += (pTx - pX) * 0.22; pY += (pTy - pY) * 0.22;
      probe.style.transform = "translate(" + (pX + 16).toFixed(1) + "px," + (pY + 18).toFixed(1) + "px)";
      var s = Math.floor((Date.now() - sessionStart) / 1000);
      var last = TRACE.pts[TRACE.n - 1] || 0;
      probe.textContent = "T+" + String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0") + " · CH.A " + (0.5 + last * 0.5).toFixed(2);
    }});
  }

  /* ---- cursor tilt on capture plates and bin tiles ---- */
  if (finePointer && !reduced) {
    doc.querySelectorAll(".capture, .bin-item").forEach(function (el) {
      el.classList.add("tilt");
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var rx = ((e.clientY - r.top) / r.height - 0.5) * -3.4;
        var ry = ((e.clientX - r.left) / r.width - 0.5) * 4.0;
        el.style.transform = "perspective(700px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) translateY(-3px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  /* ---- the human node: hand-projected 3D wireframe EEG head (10-20 system) ---- */
  (function headViz() {
    var svg = doc.getElementById("head-viz");
    if (!svg) return;
    var NS = "http://www.w3.org/2000/svg";
    var DEG = Math.PI / 180;
    function sph(elev, azim) {
      var e = elev * DEG, a = azim * DEG;
      return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
    }
    /* the 19 electrodes of the international 10-20 system */
    var ELECTRODES = [
      ["FP1", 18, -18], ["FP2", 18, 18], ["F7", 0, -54], ["F3", 36, -39], ["FZ", 45, 0],
      ["F4", 36, 39], ["F8", 0, 54], ["T3", 0, -90], ["C3", 36, -90], ["CZ", 90, 0],
      ["C4", 36, 90], ["T4", 0, 90], ["T5", 0, -126], ["P3", 36, -141], ["PZ", 45, 180],
      ["P4", 36, 141], ["T6", 0, 126], ["O1", 18, -162], ["O2", 18, 162]
    ].map(function (d) { return { name: d[0], p: sph(d[1], d[2]), flash: 0 }; });
    var LABELED = { FZ: 1, CZ: 1, PZ: 1, T3: 1, T4: 1 };
    /* wireframe: latitude rings + meridians, as point chains */
    var chains = [];
    [-22, 8, 38, 66].forEach(function (elev) {
      var pts = [];
      for (var a = 0; a <= 360; a += 12) pts.push(sph(elev, a));
      chains.push(pts);
    });
    [0, 45, 90, 135].forEach(function (azim) {
      var pts = [];
      for (var e = -38; e <= 90; e += 8) pts.push(sph(e, azim));
      for (var e2 = 90 - 8; e2 >= -38; e2 -= 8) pts.push(sph(e2, azim + 180));
      chains.push(pts);
    });
    var R = 96, PERSP = 0.24;
    function project(p, yaw) {
      var s = Math.sin(yaw), c = Math.cos(yaw);
      var x = p[0] * c + p[2] * s, z = -p[0] * s + p[2] * c, yv = p[1];
      var k = 1 / (1 + z * PERSP * -0.5);
      return { x: x * R * k, y: -yv * R * k, z: z };
    }
    var ringEls = chains.map(function () {
      var el = doc.createElementNS(NS, "path"); el.setAttribute("class", "hd-ring"); svg.appendChild(el); return el;
    });
    var noseEl = doc.createElementNS(NS, "path"); noseEl.setAttribute("class", "hd-nose"); svg.appendChild(noseEl);
    var elEls = ELECTRODES.map(function (e) {
      var c = doc.createElementNS(NS, "circle"); c.setAttribute("class", "hd-el"); svg.appendChild(c);
      var t = null;
      if (LABELED[e.name]) { t = doc.createElementNS(NS, "text"); t.setAttribute("class", "hd-label"); t.textContent = e.name; svg.appendChild(t); }
      return { c: c, t: t };
    });
    var yaw = 0.55, flashAcc = 0;
    function render(dt) {
      yaw += dt * 0.00028;
      flashAcc += dt;
      if (flashAcc > 1700) {
        flashAcc = 0;
        ELECTRODES[Math.floor(rand() * ELECTRODES.length)].flash = 1;
      }
      chains.forEach(function (pts, i) {
        var d = "";
        for (var j = 0; j < pts.length; j++) {
          var q = project(pts[j], yaw);
          d += (j === 0 ? "M" : "L") + q.x.toFixed(1) + "," + q.y.toFixed(1);
        }
        ringEls[i].setAttribute("d", d);
      });
      var n1 = project(sph(-12, -9), yaw), n2 = project(sph(-30, 0), yaw), n3 = project(sph(-12, 9), yaw);
      noseEl.setAttribute("d", "M" + n1.x.toFixed(1) + "," + n1.y.toFixed(1) + " L" + n2.x.toFixed(1) + "," + n2.y.toFixed(1) + " L" + n3.x.toFixed(1) + "," + n3.y.toFixed(1));
      ELECTRODES.forEach(function (e, i) {
        var q = project(e.p, yaw);
        e.flash *= 0.94;
        var front = (q.z + 1) / 2;
        var el = elEls[i];
        el.c.setAttribute("cx", q.x.toFixed(1)); el.c.setAttribute("cy", q.y.toFixed(1));
        el.c.setAttribute("r", (1.6 + front * 1.6 + e.flash * 2.4).toFixed(2));
        el.c.setAttribute("opacity", (0.25 + front * 0.6 + e.flash * 0.15).toFixed(2));
        if (el.t) {
          el.t.setAttribute("x", (q.x + 7).toFixed(1)); el.t.setAttribute("y", (q.y - 5).toFixed(1));
          el.t.setAttribute("opacity", Math.max(0, (q.z + 0.15)).toFixed(2));
        }
      });
    }
    render(0);
    if (reduced) return;
    var headVisible = false;
    new IntersectionObserver(function (entries) { headVisible = entries[0].isIntersecting; }, { threshold: 0.1 }).observe(svg);
    subs.push({ active: true, fn: function (dt) { if (headVisible) render(dt); } });
  })();

  /* ---- specimen turntable: SO-101 wireframe, hand-projected 3D, no WebGL ---- */
  (function turntable() {
    var svg = doc.getElementById("turntable");
    if (!svg) return;
    var NS = "http://www.w3.org/2000/svg";
    var DEG = Math.PI / 180;
    var TILT = 17 * DEG, CT = Math.cos(TILT), ST = Math.sin(TILT);
    function project(p, yaw) {
      var c = Math.cos(yaw), s = Math.sin(yaw);
      var x = p[0] * c + p[2] * s, z = -p[0] * s + p[2] * c;
      var y = p[1] * CT - z * ST, z2 = p[1] * ST + z * CT;
      var f = 320 / (320 - z2);
      return { x: x * f, y: -(y - 30) * f, z: z2 };
    }
    function ringFlat(y, r, n) {
      var pts = [];
      for (var i = 0; i <= n; i++) { var a = i / n * Math.PI * 2; pts.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
      return pts;
    }
    function ringJoint(cx, cy, r) {
      var pts = [];
      for (var i = 0; i <= 8; i++) { var a = i / 8 * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0]); }
      return pts;
    }
    /* an arm segment as a wireframe box: 4 long edges + 2 end caps */
    function linkBox(P, Q, hv, hw, out) {
      var ux = Q[0] - P[0], uy = Q[1] - P[1];
      var L = Math.sqrt(ux * ux + uy * uy); ux /= L; uy /= L;
      var vx = -uy * hv, vy = ux * hv;
      function corner(B, sv, sw) { return [B[0] + vx * sv, B[1] + vy * sv, B[2] + hw * sw]; }
      var SV = [1, 1, -1, -1], SW = [1, -1, -1, 1];
      for (var i = 0; i < 4; i++) out.push({ cls: "tt-arm", pts: [corner(P, SV[i], SW[i]), corner(Q, SV[i], SW[i])] });
      [P, Q].forEach(function (B) {
        var cap = [];
        for (var j = 0; j <= 4; j++) cap.push(corner(B, SV[j % 4], SW[j % 4]));
        out.push({ cls: "tt-arm", pts: cap });
      });
    }
    var SHOULDER = [0, 24, 0], L1 = 40, L2 = 34;
    function buildStrokes(ts) {
      var out = [];
      out.push({ cls: "tt-frame", pts: [[-21, 0, -21], [21, 0, -21], [21, 0, 21], [-21, 0, 21], [-21, 0, -21]] });
      out.push({ cls: "tt-frame", pts: ringFlat(2, 14, 12) });
      [[-6, -6], [6, -6], [6, 6], [-6, 6]].forEach(function (c) {
        out.push({ cls: "tt-frame", pts: [[c[0], 2, c[1]], [c[0], 20, c[1]]] });
      });
      out.push({ cls: "tt-frame", pts: [[-6, 20, -6], [6, 20, -6], [6, 20, 6], [-6, 20, 6], [-6, 20, -6]] });
      /* articulated pose: slow breathing of shoulder and elbow */
      var a1 = (34 + 7 * Math.sin(ts * 0.00047)) * DEG;
      var a12 = a1 + (78 + 16 * Math.cos(ts * 0.00029)) * DEG;
      var E = [SHOULDER[0] + Math.sin(a1) * L1, SHOULDER[1] + Math.cos(a1) * L1, 0];
      var W = [E[0] + Math.sin(a12) * L2, E[1] + Math.cos(a12) * L2, 0];
      out.push({ cls: "tt-joint", pts: ringJoint(SHOULDER[0], SHOULDER[1], 5.5) });
      out.push({ cls: "tt-joint", pts: ringJoint(E[0], E[1], 4.5) });
      linkBox(SHOULDER, E, 3, 3.5, out);
      linkBox(E, W, 2.6, 3, out);
      /* parallel-jaw gripper */
      var ux = Math.sin(a12), uy = Math.cos(a12), vx = Math.cos(a12), vy = -Math.sin(a12);
      var j1 = [W[0] + vx * 4, W[1] + vy * 4, 0], j2 = [W[0] - vx * 4, W[1] - vy * 4, 0];
      out.push({ cls: "tt-arm", pts: [j1, j2] });
      out.push({ cls: "tt-arm", pts: [j1, [j1[0] + ux * 9, j1[1] + uy * 9, 0]] });
      out.push({ cls: "tt-arm", pts: [j2, [j2[0] + ux * 9, j2[1] + uy * 9, 0]] });
      return { strokes: out, joints: [SHOULDER, E, W] };
    }
    /* fixed element pool, built from the first frame */
    var first = buildStrokes(0);
    var strokeEls = first.strokes.map(function (s) {
      var p = doc.createElementNS(NS, "path");
      p.setAttribute("class", s.cls);
      svg.appendChild(p); return p;
    });
    var jointEls = first.joints.map(function () {
      var c = doc.createElementNS(NS, "circle");
      c.setAttribute("class", "tt-dot"); c.setAttribute("r", "1.6");
      svg.appendChild(c); return c;
    });
    function label(x, y, cls, anchor) {
      var t = doc.createElementNS(NS, "text");
      t.setAttribute("x", x); t.setAttribute("y", y);
      t.setAttribute("class", cls); t.setAttribute("text-anchor", anchor);
      svg.appendChild(t); return t;
    }
    label(-74, -54, "tt-readout", "start").textContent = "LEROBOT SO-101 · 5-DOF";
    var azEl = label(74, 42, "tt-readout", "end");
    var simT = 0;
    function render(dt) {
      simT += dt;
      var yaw = simT * 0.0004;
      var f = buildStrokes(simT);
      f.strokes.forEach(function (s, i) {
        var d = "", zsum = 0;
        for (var j = 0; j < s.pts.length; j++) {
          var q = project(s.pts[j], yaw);
          d += (j === 0 ? "M" : "L") + q.x.toFixed(1) + "," + q.y.toFixed(1);
          zsum += q.z;
        }
        strokeEls[i].setAttribute("d", d);
        /* depth cue: strokes nearer the camera read stronger */
        var op = 0.62 + (zsum / s.pts.length) / 70;
        strokeEls[i].setAttribute("opacity", Math.max(0.28, Math.min(1, op)).toFixed(2));
      });
      f.joints.forEach(function (p, i) {
        var q = project(p, yaw);
        jointEls[i].setAttribute("cx", q.x.toFixed(1)); jointEls[i].setAttribute("cy", q.y.toFixed(1));
        jointEls[i].setAttribute("opacity", Math.max(0.35, Math.min(1, 0.7 + q.z / 60)).toFixed(2));
      });
      var az = Math.round(yaw / DEG) % 360;
      azEl.textContent = "AZ " + String(az).padStart(3, "0") + "°";
    }
    render(2600);
    if (reduced) return;
    var ttVisible = false;
    new IntersectionObserver(function (entries) { ttVisible = entries[0].isIntersecting; }, { threshold: 0.15 }).observe(svg);
    subs.push({ active: true, fn: function (dt) { if (ttVisible) render(dt); } });
  })();

  /* ---- redactable live scrub session: detect, tokenize, agent works, restore ---- */
  (function redactLive() {
    var svg = doc.getElementById("redact-viz");
    if (!svg) return;
    var NS = "http://www.w3.org/2000/svg";
    function id(s) { return svg.querySelector("#" + s); }
    var l1 = id("rv-l1"), l2 = id("rv-l2"), l3 = id("rv-l3"), l4 = id("rv-l4"), l5 = id("rv-l5");
    var caret = id("rv-caret"), pii1 = id("rv-pii1"), pii2 = id("rv-pii2");
    var status = id("rv-status"), packet = id("rv-packet");
    var gScrub = id("rv-scrub"), gModel = id("rv-model"), gRestore = id("rv-restore"), chat = id("rv-chat");
    var W1 = id("rv-w1"), W2 = id("rv-w2"), W3 = id("rv-w3");
    if (!l1 || !l5 || !W3) return;

    /* the name is caught by NER, the card by a Luhn checksum (4111... passes) */
    var L1 = "> refund anna weber, card 4111 1111 1111 1111";
    var NAME_AT = 9, NAME_LEN = 10, CARD_AT = 26, CARD_LEN = 19;
    var L2 = [["\u21B3 wire: refund "], ["[NAME_1]", "rv-tok"], [", card "], ["[CARD_1]", "rv-tok"]];
    var L3 = [["\u2192 tool: orders.lookup("], ["[NAME_1]", "rv-tok"], [", "], ["[CARD_1]", "rv-tok"], [")"]];
    var L4 = [["\u2192 tool: refunds.create(order 8841, \u20AC49)"]];
    var L5 = [["< refunded "], ["anna weber", "rv-mail"], [" \u00B7 receipt queued"]];
    function flat(parts) { return parts.map(function (p) { return p[0]; }).join(""); }

    function tspans(el, parts) {
      el.textContent = "";
      parts.forEach(function (p) {
        var t = doc.createElementNS(NS, "tspan");
        t.textContent = p[0];
        if (p[1]) t.setAttribute("class", p[1]);
        el.appendChild(t);
      });
    }
    function setStatus(s) { if (status.textContent !== s) status.textContent = s; }
    function typeInto(el, str, t0, t, rate) {
      var n = Math.max(0, Math.min(str.length, Math.floor((t - t0) / rate)));
      var cur = str.slice(0, n);
      if (el.textContent !== cur) el.textContent = cur;
      return n >= str.length;
    }
    function caretAt(el) {
      caret.setAttribute("opacity", "1");
      var w = 0;
      try { w = el.getComputedTextLength(); } catch (e) {}
      caret.setAttribute("x", 26 + w);
      caret.setAttribute("y", el.getAttribute("y") - 8);
    }
    function placePii(rect, at, len) {
      try {
        var x0 = l1.getSubStringLength(0, at);
        var w = l1.getSubStringLength(at, len);
        rect.setAttribute("x", 24 + x0 - 2);
        rect.setAttribute("y", 31);
        rect.setAttribute("width", w + 4);
      } catch (e) {}
    }
    function packetOn(wire, p) {
      var len = wire.getTotalLength();
      var pt = wire.getPointAtLength(len * Math.min(1, Math.max(0, p)));
      packet.setAttribute("cx", pt.x); packet.setAttribute("cy", pt.y);
      packet.setAttribute("opacity", "1");
    }
    function lit(g, on) { if (g) g.classList.toggle("lit", !!on); }
    var typed = {};
    function reset() {
      [l1, l2, l3, l4, l5].forEach(function (el) { el.textContent = ""; });
      pii1.classList.remove("on"); pii2.classList.remove("on");
      caret.setAttribute("opacity", "0");
      packet.setAttribute("opacity", "0");
      lit(gScrub, false); lit(gModel, false); lit(gRestore, false);
      chat.style.opacity = "1";
      typed = {};
    }
    /* a typing step: returns true once the line is fully typed and tspanned */
    function step(key, el, parts, t0, t, rate) {
      if (typed[key]) return true;
      if (typeInto(el, flat(parts), t0, t, rate)) {
        tspans(el, parts);
        typed[key] = true;
      }
      return typed[key];
    }
    function finalFrame() {
      l1.textContent = L1;
      placePii(pii1, NAME_AT, NAME_LEN); placePii(pii2, CARD_AT, CARD_LEN);
      pii1.classList.add("on"); pii2.classList.add("on");
      tspans(l2, L2); tspans(l3, L3); tspans(l4, L4); tspans(l5, L5);
      setStatus("RECALL GATED IN CI \u00B7 APACHE-2.0");
    }
    if (reduced) { finalFrame(); return; }

    var LOOP = 14400, t = -400, visible = false;
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }, { threshold: 0.2 }).observe(svg);
    subs.push({ active: true, fn: function (dt) {
      if (!visible) return;
      t += dt;
      if (t < 0) return;
      if (t >= LOOP) { t = 0; reset(); return; }

      if (t < 1700) {                              /* the user types */
        var done = typeInto(l1, L1, 0, t, 35);
        if (!done) caretAt(l1); else caret.setAttribute("opacity", "0");
        setStatus("TRANSPARENT PROXY \u00B7 0% RETENTION");
      } else if (t < 2300) {                       /* both tiers catch */
        if (l1.textContent !== L1) { l1.textContent = L1; caret.setAttribute("opacity", "0"); }
        if (!pii1.classList.contains("on")) {
          placePii(pii1, NAME_AT, NAME_LEN); placePii(pii2, CARD_AT, CARD_LEN);
          pii1.classList.add("on"); pii2.classList.add("on");
        }
        setStatus("CAUGHT: NAME (NER) + CARD (LUHN PASS)");
      } else if (t < 2800) {                       /* packet: you -> scrub */
        packetOn(W1, (t - 2300) / 500);
      } else if (t < 3300) {
        packet.setAttribute("opacity", "0");
        lit(gScrub, true);
        setStatus("TOKENIZED \u00B7 KEYMAP NEVER LEAVES THE MACHINE");
      } else if (t < 4300) {                       /* the scrubbed copy goes on the wire */
        step("l2", l2, L2, 3300, t, 20);
      } else if (t < 4800) {                       /* packet: scrub -> agent */
        lit(gScrub, false);
        packetOn(W2, (t - 4300) / 500);
      } else if (t < 5600) {
        packet.setAttribute("opacity", "0");
        lit(gModel, true);
        setStatus("MODEL SEES TOKENS ONLY \u00B7 NOTHING TO RETAIN");
      } else if (t < 7000) {                       /* the agent works, blind to the PII */
        step("l3", l3, L3, 5600, t, 18);
        setStatus("AGENT RUNS TOOLS ON TOKENS");
      } else if (t < 8400) {
        step("l4", l4, L4, 7000, t, 18);
      } else if (t < 9200) {                       /* packet: agent -> restore */
        lit(gModel, false);
        packetOn(W3, (t - 8400) / 800);
      } else if (t < 9600) {
        packet.setAttribute("opacity", "0");
        lit(gRestore, true);
        setStatus("RESTORED LOCALLY \u00B7 0% PII RETENTION");
      } else if (t < 11000) {                      /* the reply, with the real name back */
        step("l5", l5, L5, 9600, t, 30);
      } else if (t < 13600) {
        lit(gRestore, false);
        setStatus("RECALL GATED IN CI \u00B7 APACHE-2.0");
      } else {                                     /* fade and loop */
        chat.style.opacity = String(Math.max(0, 1 - (t - 13600) / 600));
      }
    }});
  })();

  /* ---- magnetic micro-detent on primary controls (precision knob feel) ---- */
  if (!reduced) {
    doc.querySelectorAll(".btn-solid, .btn-ghost, .io-btn").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        el.style.transform = "translate(" + (dx * 4).toFixed(1) + "px," + (dy * 2.5).toFixed(1) + "px)";
      });
      el.addEventListener("mouseleave", function () { el.style.transform = ""; });
    });
  }

  /* ================================================================
     UTILITIES
     ================================================================ */

  /* ---- Berlin clock ---- */
  var clockEl = doc.getElementById("berlin-clock");
  if (clockEl) {
    var fmt;
    try {
      fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    } catch (e) { fmt = null; }
    function tickClock() {
      clockEl.textContent = (fmt ? fmt.format(new Date()) : new Date().toTimeString().slice(0, 8)) + " LOCAL";
    }
    tickClock(); setInterval(tickClock, 1000);
  }

  /* ---- copy email ---- */
  var copyBtn = doc.getElementById("copy-email");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      function done() {
        var old = copyBtn.textContent;
        copyBtn.textContent = "COPIED";
        setTimeout(function () { copyBtn.textContent = old; }, 1400);
      }
      copyText("praneel.bhatia@gmail.com", done);
    });
  }
  function copyText(text, cb) {
    if (navigator.clipboard) { navigator.clipboard.writeText(text).then(cb, cb); return; }
    var ta = doc.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "absolute"; ta.style.left = "-9999px";
    doc.body.appendChild(ta); ta.select();
    try { doc.execCommand("copy"); } catch (e) {}
    doc.body.removeChild(ta);
    if (cb) cb();
  }

  /* ---- year ---- */
  var yearEl = doc.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- command palette ---- */
  var overlay = doc.getElementById("palette-overlay");
  var input = doc.getElementById("palette-input");
  var list = doc.getElementById("palette-list");
  function go(hash) {
    var el = doc.querySelector(hash);
    if (el) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }
  var commands = [
    { ic: "GO", label: "Selected work: systems owned end to end", fn: function () { go("#work"); } },
    { ic: "GO", label: "The harness: how the work gets made", fn: function () { go("#method"); } },
    { ic: "GO", label: "Experience timeline", fn: function () { go("#experience"); } },
    { ic: "GO", label: "Publications and patents", fn: function () { go("#papers"); } },
    { ic: "GO", label: "Capabilities", fn: function () { go("#capabilities"); } },
    { ic: "GO", label: "Contact", fn: function () { go("#contact"); } },
    { ic: "DO", label: "Copy email address", fn: function () { copyText("praneel.bhatia@gmail.com"); } },
    { ic: "DO", label: "Download CV (PDF)", fn: function () { window.location.href = "Praneel_Bhatia_CV.pdf"; } },
    { ic: "DO", label: "Toggle dark / light theme", fn: function () { spdt.click(); } },
    { ic: "OUT", label: "Open LinkedIn", fn: function () { window.open("https://www.linkedin.com/in/praneelbhatia/", "_blank", "noopener"); } },
    { ic: "OUT", label: "Open GitHub", fn: function () { window.open("https://github.com/PraneelBhatia", "_blank", "noopener"); } },
    { ic: "OUT", label: "Open Google Scholar", fn: function () { window.open("https://scholar.google.com/citations?user=w1EwGCEAAAAJ&hl=en", "_blank", "noopener"); } },
    { ic: "OUT", label: "Email praneel.bhatia@gmail.com", fn: function () { window.location.href = "mailto:praneel.bhatia@gmail.com"; } }
  ];
  var filtered = commands.slice(), sel = 0;
  function renderList() {
    list.replaceChildren();
    if (!filtered.length) {
      var e = doc.createElement("div"); e.className = "p-empty"; e.textContent = "No matches.";
      list.appendChild(e); return;
    }
    filtered.forEach(function (c, i) {
      var el = doc.createElement("div");
      el.className = "p-item" + (i === sel ? " sel" : "");
      el.setAttribute("role", "option");
      el.id = "pcmd-" + i;
      el.setAttribute("aria-selected", i === sel ? "true" : "false");
      var ic = doc.createElement("span"); ic.className = "p-ic"; ic.textContent = c.ic;
      var lb = doc.createElement("span"); lb.textContent = c.label;
      el.appendChild(ic); el.appendChild(lb);
      el.addEventListener("click", function () { runCmd(c); });
      el.addEventListener("mousemove", function () { sel = i; updateSel(); });
      list.appendChild(el);
    });
    updateSel();
  }
  function updateSel() {
    Array.prototype.forEach.call(list.children, function (el, i) {
      el.classList.toggle("sel", i === sel);
      el.setAttribute("aria-selected", i === sel ? "true" : "false");
    });
    if (list.children[sel] && list.children[sel].id) list.setAttribute("aria-activedescendant", list.children[sel].id);
  }
  function runCmd(c) { closePalette(); setTimeout(c.fn, 60); }
  var paletteReturnFocus = null;
  function openPalette() {
    paletteReturnFocus = doc.activeElement;
    overlay.hidden = false;
    input.value = ""; filtered = commands.slice(); sel = 0; renderList();
    setTimeout(function () { input.focus(); }, 30);
  }
  function closePalette() {
    overlay.hidden = true;
    if (paletteReturnFocus && paletteReturnFocus.focus) paletteReturnFocus.focus();
  }
  doc.getElementById("palette-btn").addEventListener("click", openPalette);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closePalette(); });
  input.addEventListener("input", function () {
    var q = input.value.toLowerCase().trim();
    filtered = commands.filter(function (c) { return c.label.toLowerCase().indexOf(q) !== -1; });
    sel = 0; renderList();
  });
  doc.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      overlay.hidden ? openPalette() : closePalette();
      return;
    }
    if (overlay.hidden) return;
    if (e.key === "Tab") { e.preventDefault(); input.focus(); } /* the input is the dialog's only focusable element */
    if (e.key === "Escape") closePalette();
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, filtered.length - 1); updateSel(); }
    if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); updateSel(); }
    if (e.key === "Enter" && filtered[sel]) runCmd(filtered[sel]);
  });

  /* ---- go ---- */
  startTicker();
})();
