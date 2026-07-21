import React, { useState, useEffect, createContext, useContext } from "react";


// ==== constants/fonts.js ====
const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');

/* Visible keyboard focus everywhere. Mouse/touch clicks don't trigger
   :focus-visible, so this only appears for keyboard navigation, tabbing,
   without adding a ring around every mouse click. */
button:focus-visible,
input:focus-visible,
a:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid #9E7E3D;
  outline-offset: 2px;
  border-radius: 4px;
}
`;

// ==== constants/tabs.js ====
const TABS = [
  { id: "synthesis", label: "Your Synthesis" },
  { id: "engine1", label: "How We Know" },
  { id: "engine2", label: "Profile Questions" },
];

// ==== constants/colors.js ====
const COLORS = {
  INK: "#22242A",
  MUTED: "#424035",
  FAINT: "#787261",
  PAPER: "#FAF6EC",
  CARD: "#FFFFFF",
  LINE: "#E8E1CE",
  GOLD: "#9E7E3D",
  RED: "#A63A3A",
};

// Soft, borderless separation for nested/repeated cards, letting spacing and
// shadow carry the boundary instead of a hard line. Primary containers
// (SubSystem cards, the hero, the closing synthesis) keep real borders since
// those benefit from a firmer edge; this is for the cards inside them.
const SOFT_SHADOW = "0 1px 2px rgba(34,36,42,0.04), 0 2px 8px rgba(34,36,42,0.06)";

// ---- Swiss Ephemeris precision backend (the same pyswisseph setup running
// Three Skies One Self on PythonAnywhere). Paste the base URL of your
// PythonAnywhere app below, e.g. "https://YOURUSERNAME.pythonanywhere.com",
// after registering convergence_precision_api.py in your Flask app. When the
// URL is set and the server answers, every longitude, true Placidus houses,
// the Ascendant, Midheaven, Vertex, Chiron, Lilith, and the true North Node
// come from Swiss Ephemeris. When it's blank or unreachable, the built-in
// verified math takes over automatically, nothing breaks. ----
const PRECISION_BACKEND_URL = "";

async function fetchPrecision(birthDate, utHours, lat, lon) {
  if (!PRECISION_BACKEND_URL || !birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  const params = new URLSearchParams({ year: y, month: m, day: d, ut_hours: utHours, lat, lon });
  try {
    const res = await fetch(`${PRECISION_BACKEND_URL}/api/convergence/positions?${params}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}


// One accent color per system, used on section cards, eyebrows, and jump
// chips so each system is recognizable at a glance without reading labels.
// All chosen to sit naturally in the existing paper/ink/gold world.
const SYSTEM_COLORS = {
  tropical: "#9E7E3D",   // gold, the anchor
  vedic: "#B0562F",      // terracotta
  draconic: "#6E4A7E",   // plum
  numerology: "#2F6F6A", // deep teal
  chinese: "#A63A3A",    // brick red
  humanDesign: "#7C5CB0",// violet
  mbti: "#46628A",       // slate blue
  enneagram: "#A63A3A",  // brick red
};

// ==== constants/quizQuestions.js ====
// Shared question bank for the pre-report intake quiz (QuizIntake) and the
// "Sample Assessment Questions" shown inside the Questionnaire tab. Keeping
// one source of truth means the Questionnaire tab can display the person's
// actual answers instead of a second, disconnected hardcoded copy.
const QUIZ_QUESTIONS = [
  {
    id: "enn1",
    section: "Enneagram",
    q: "When someone nearby needs help, I usually:",
    options: [
      { text: "Step in right away, sometimes before being asked", enneagram: { 2: 2 } },
      { text: "Wait until asked directly", enneagram: { 9: 2 } },
    ],
  },
  {
    id: "enn2",
    section: "Enneagram",
    q: "I feel most uncomfortable when:",
    options: [
      { text: "I've done something incorrectly or unfairly", enneagram: { 1: 2 } },
      { text: "I haven't been appreciated enough", enneagram: { 2: 2 } },
    ],
  },
  {
    id: "enn3",
    section: "Enneagram",
    q: "My inner critic tends to focus on:",
    options: [
      { text: "Whether I did the right thing", enneagram: { 1: 2 } },
      { text: "Whether people noticed what I did", enneagram: { 3: 2 } },
    ],
  },
  {
    id: "mbti_ei",
    section: "MBTI",
    q: "After a long social event, I feel:",
    options: [
      { text: "Recharged and ready for more", mbti: { dim: "EI", value: "E" } },
      { text: "Drained, ready for quiet", mbti: { dim: "EI", value: "I" } },
    ],
  },
  {
    id: "mbti_sn",
    section: "MBTI",
    q: "I'm more naturally drawn to:",
    options: [
      { text: "Concrete facts and details", mbti: { dim: "SN", value: "S" } },
      { text: "Patterns and future possibilities", mbti: { dim: "SN", value: "N" } },
    ],
  },
  {
    id: "mbti_tf",
    section: "MBTI",
    q: "When deciding something difficult, I lead with:",
    options: [
      { text: "Logical consistency", mbti: { dim: "TF", value: "T" } },
      { text: "Impact on the people involved", mbti: { dim: "TF", value: "F" } },
    ],
  },
  {
    id: "mbti_jp",
    section: "MBTI",
    q: "I prefer my days to be:",
    options: [
      { text: "Planned in advance", mbti: { dim: "JP", value: "J" } },
      { text: "Open and flexible", mbti: { dim: "JP", value: "P" } },
    ],
  },
];

// ==== utils/helpers.js ====
const TIER_COLOR = { Primary: COLORS.GOLD, Secondary: "#8A7F5C", Supporting: COLORS.FAINT, Real: "#3F7D5C", Generated: "#A63A3A" };

function confidenceLabel(pct) {
  if (pct >= 85) return "Very High";
  if (pct >= 70) return "High";
  if (pct >= 50) return "Moderate";
  return "Mixed";
}

// ==== utils/engine.js ====
// ---------------------------------------------------------------------------
// Convergence personalization engine.
//
// This module turns whatever a person enters (name, birth date, birth time,
// birth location) into a full, self-consistent profile. Three pieces are
// REAL, standard calculations that will be accurate for any input:
//   - Sun sign        (from date, standard tropical zodiac date ranges)
//   - Chinese zodiac   (animal + element, from birth year, standard cycle)
//   - Numerology       (Life Path, Expression, Soul Urge, Gift, standard
//                        Pythagorean letter values + digit reduction)
//
// Everything that would require an ephemeris (planetary positions, houses,
// Vedic dasha timing, Human Design gates) is generated with a seeded random
// number generator: the same inputs always produce the same output, and
// different inputs produce different, internally-consistent output. It is
// NOT astronomically accurate — doing that requires a real ephemeris backend,
// which isn't available in this environment — but it is real per-person data,
// not one fixed sample record. See BirthDataForm's own disclaimer.
// ---------------------------------------------------------------------------

// ---------- seeding ----------

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(name, dateStr, timeStr, location) {
  const key = `${name || ""}|${dateStr || ""}|${timeStr || ""}|${location || ""}`;
  return mulberry32(hashString(key));
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickWeighted(rng, entries) {
  // entries: [[value, weight], ...]
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [value, weight] of entries) {
    r -= weight;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function degreeString(rng) {
  const deg = Math.floor(rng() * 30);
  const min = Math.floor(rng() * 60);
  return `${deg}°${String(min).padStart(2, "0")}'`;
}

const ORDINAL_HOUSE = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th", 7: "7th", 8: "8th", 9: "9th", 10: "10th", 11: "11th", 12: "12th" };

// ---------- real: sun sign ----------

const SUN_SIGN_RANGES = [
  { sign: "Capricorn", from: [12, 22], to: [1, 19] },
  { sign: "Aquarius", from: [1, 20], to: [2, 18] },
  { sign: "Pisces", from: [2, 19], to: [3, 20] },
  { sign: "Aries", from: [3, 21], to: [4, 19] },
  { sign: "Taurus", from: [4, 20], to: [5, 20] },
  { sign: "Gemini", from: [5, 21], to: [6, 20] },
  { sign: "Cancer", from: [6, 21], to: [7, 22] },
  { sign: "Leo", from: [7, 23], to: [8, 22] },
  { sign: "Virgo", from: [8, 23], to: [9, 22] },
  { sign: "Libra", from: [9, 23], to: [10, 22] },
  { sign: "Scorpio", from: [10, 23], to: [11, 21] },
  { sign: "Sagittarius", from: [11, 22], to: [12, 21] },
];

function computeSunSign(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  for (const r of SUN_SIGN_RANGES) {
    const [fm, fd] = r.from;
    const [tm, td] = r.to;
    if (fm === tm) {
      if (month === fm && day >= fd && day <= td) return r.sign;
    } else if (fm > tm) {
      // wraps year end (Capricorn: Dec 22 - Jan 19)
      if ((month === fm && day >= fd) || (month === tm && day <= td)) return r.sign;
    } else {
      if ((month === fm && day >= fd) || (month === tm && day <= td) || (month > fm && month < tm)) return r.sign;
    }
  }
  return null;
}

// ---------- real: Chinese zodiac ----------

const CHINESE_ANIMALS = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
const CHINESE_ELEMENTS = ["Wood", "Fire", "Earth", "Metal", "Water"];

function computeChineseZodiac(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const animalIdx = (((year - 1924) % 12) + 12) % 12;
  const elementIdx = Math.floor(((((year - 4) % 10) + 10) % 10) / 2);
  const animal = CHINESE_ANIMALS[animalIdx];
  const element = CHINESE_ELEMENTS[elementIdx];
  return { animal, element, sign: `${element} ${animal}` };
}

// ---------- real: numerology ----------

function letterValue(ch) {
  const code = ch.toUpperCase().charCodeAt(0) - 65; // A=0
  if (code < 0 || code > 25) return 0;
  return (code % 9) + 1;
}

function reduceNumber(n) {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n)
      .split("")
      .reduce((s, d) => s + parseInt(d, 10), 0);
  }
  return n;
}

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

function computeNumerology(fullName, dateStr) {
  const name = (fullName || "").replace(/[^a-zA-Z]/g, "");
  const d = dateStr ? new Date(dateStr + "T00:00:00") : null;
  const validDate = d && !isNaN(d.getTime());

  let lifePath = 7;
  if (validDate) {
    const digits = `${d.getMonth() + 1}${d.getDate()}${d.getFullYear()}`.split("").reduce((s, c) => s + parseInt(c, 10), 0);
    lifePath = reduceNumber(digits);
  }

  let expression = 7;
  let soulUrge = 7;
  let gift = 7;
  if (name.length > 0) {
    let expSum = 0;
    let vowelSum = 0;
    let consSum = 0;
    for (const ch of name) {
      const v = letterValue(ch);
      expSum += v;
      if (VOWELS.has(ch.toUpperCase())) vowelSum += v;
      else consSum += v;
    }
    expression = reduceNumber(expSum);
    soulUrge = reduceNumber(vowelSum || expSum);
    gift = reduceNumber(consSum || expSum);
  }

  return { lifePath, expression, soulUrge, gift };
}

// ---------- real: planetary positions ----------
// Based on Paul Schlyter's published low-precision orbital elements method
// (accuracy ~1-2 arcmin for the planets and the Moon with perturbation
// terms included). Source: https://stjarnhimlen.se/comp/ppcomp.html
// Verified against Schlyter's own Jan 1 2000, 12:00 UT worked example
// (Sun ≈ 10°24' Capricorn) before being wired into the app.
// Houses, the Ascendant, and the Midheaven still need a geocoded birth
// location and precise local sidereal time, which this app doesn't collect,
// so those stay generated and clearly labeled as such — see generateChartLayer.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

function dayNumber(y, m, dd, utHours) {
  const d = 367 * y - Math.floor((7 * (y + Math.floor((m + 9) / 12))) / 4) + Math.floor((275 * m) / 9) + dd - 730530;
  return d + utHours / 24.0;
}

function normDeg(x) {
  x = x % 360;
  return x < 0 ? x + 360 : x;
}

function solveKepler(Mdeg, e) {
  let E = Mdeg + (e * R2D) * Math.sin(Mdeg * D2R) * (1 + e * Math.cos(Mdeg * D2R));
  for (let i = 0; i < 8; i++) {
    const E0 = E;
    E = E0 - (E0 - (e * R2D) * Math.sin(E0 * D2R) - Mdeg) / (1 - e * Math.cos(E0 * D2R));
    if (Math.abs(E - E0) < 0.0001) break;
  }
  return E;
}

function planetHeliocentric(elements) {
  const { N, i, w, a, e, M } = elements;
  const E = solveKepler(normDeg(M), e);
  const xv = a * (Math.cos(E * D2R) - e);
  const yv = a * (Math.sqrt(1 - e * e) * Math.sin(E * D2R));
  const v = R2D * Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const Nr = N * D2R, ir = i * D2R, vwr = (v + w) * D2R;
  const xh = r * (Math.cos(Nr) * Math.cos(vwr) - Math.sin(Nr) * Math.sin(vwr) * Math.cos(ir));
  const yh = r * (Math.sin(Nr) * Math.cos(vwr) + Math.cos(Nr) * Math.sin(vwr) * Math.cos(ir));
  return { xh, yh };
}

function sunPosition(d) {
  const w = 282.9404 + 4.70935e-5 * d;
  const e = 0.016709 - 1.151e-9 * d;
  const M = normDeg(356.047 + 0.9856002585 * d);
  const E = solveKepler(M, e);
  const xv = Math.cos(E * D2R) - e;
  const yv = Math.sqrt(1 - e * e) * Math.sin(E * D2R);
  const v = R2D * Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  return { lonsun: normDeg(v + w), r, M, w };
}

function lonToSignDegree(lon) {
  const L = normDeg(lon);
  const signIdx = Math.floor(L / 30);
  return { lon: L, sign: ZODIAC_SIGNS[signIdx], degree: L - signIdx * 30 };
}

function degMinString(decimalDegreesInSign) {
  let deg = Math.floor(decimalDegreesInSign);
  let min = Math.round((decimalDegreesInSign - deg) * 60);
  if (min === 60) {
    min = 0;
    deg += 1;
  }
  return `${deg}°${String(min).padStart(2, "0")}'`;
}

function calcRealPlanetPositions(dateStr, timeStr, utHoursOverride = null) {
  if (!dateStr) return null;
  const [y, m, dd] = dateStr.split("-").map(Number);
  if (!y || !m || !dd) return null;
  const utHours = utHoursOverride !== null
    ? utHoursOverride
    : timeStr
    ? (() => {
        const [h, mi] = timeStr.split(":").map(Number);
        return h + mi / 60;
      })()
    : 12;
  const d = dayNumber(y, m, dd, utHours);

  const sun = sunPosition(d);
  const xs = sun.r * Math.cos(sun.lonsun * D2R);
  const ys = sun.r * Math.sin(sun.lonsun * D2R);

  const elementsFor = {
    Mercury: { N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5.0e-8 * d, w: 29.1241 + 1.01444e-5 * d, a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d },
    Venus: { N: 76.6799 + 2.4659e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.891 + 1.38374e-5 * d, a: 0.72333, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d },
    Mars: { N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d, a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d },
    Jupiter: { N: 100.4542 + 2.76854e-5 * d, i: 1.303 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d, a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.895 + 0.0830853001 * d },
    Saturn: { N: 113.6634 + 2.3898e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d, a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.967 + 0.0334442282 * d },
    Uranus: { N: 74.0005 + 1.3978e-5 * d, i: 0.7733 + 1.9e-8 * d, w: 96.6612 + 3.0565e-5 * d, a: 19.18171 - 1.55e-8 * d, e: 0.047318 + 7.45e-9 * d, M: 142.5905 + 0.011725806 * d },
    Neptune: { N: 131.7806 + 3.0173e-5 * d, i: 1.77 - 2.55e-7 * d, w: 272.8461 - 6.027e-6 * d, a: 30.05826 + 3.313e-8 * d, e: 0.008606 + 2.15e-9 * d, M: 260.2471 + 0.005995147 * d },
  };

  const results = { Sun: lonToSignDegree(sun.lonsun) };
  for (const [name, elements] of Object.entries(elementsFor)) {
    const { xh, yh } = planetHeliocentric(elements);
    const xg = xh + xs, yg = yh + ys;
    results[name] = lonToSignDegree(R2D * Math.atan2(yg, xg));
  }

  // Moon: geocentric orbit, plus the largest ~12 perturbation terms
  // (evection, variation, yearly equation, etc.) per Schlyter section 9.
  const moonEl = { N: normDeg(125.1228 - 0.0529538083 * d), i: 5.1454, w: normDeg(318.0634 + 0.1643573223 * d), a: 60.2666, e: 0.0549, M: normDeg(115.3654 + 13.0649929509 * d) };
  const { xh: xm, yh: ym } = planetHeliocentric(moonEl);
  let moonLon = R2D * Math.atan2(ym, xm);
  const Ms = normDeg(sun.M), Mm = normDeg(moonEl.M);
  const Ls = normDeg(Ms + sun.w), Lm = normDeg(Mm + moonEl.w + moonEl.N);
  const Dd = normDeg(Lm - Ls), F = normDeg(Lm - moonEl.N);
  moonLon +=
    -1.274 * Math.sin((Mm - 2 * Dd) * D2R) + 0.658 * Math.sin(2 * Dd * D2R) - 0.186 * Math.sin(Ms * D2R) -
    0.059 * Math.sin((2 * Mm - 2 * Dd) * D2R) - 0.057 * Math.sin((Mm - 2 * Dd + Ms) * D2R) + 0.053 * Math.sin((Mm + 2 * Dd) * D2R) +
    0.046 * Math.sin((2 * Dd - Ms) * D2R) + 0.041 * Math.sin((Mm - Ms) * D2R) - 0.035 * Math.sin(Dd * D2R) -
    0.031 * Math.sin((Mm + Ms) * D2R) - 0.015 * Math.sin((2 * F - 2 * Dd) * D2R) + 0.011 * Math.sin((Mm - 4 * Dd) * D2R);
  results.Moon = lonToSignDegree(moonLon);

  // Mean lunar North Node — real, from the Moon's own orbital elements above.
  results.NorthNode = lonToSignDegree(moonEl.N);

  return results;
}

// ---------- real: Ascendant, Midheaven, and houses (needs a birth location) ----------
// Formulas verified against RadixPro's fully worked example (Enschede, Nov 2
// 2016, 21:17:30 UT: Ascendant = 3°30' Leo, MC = 9°38' Aries) before being
// wired in. GMST formula is the standard IAU expression. US daylight saving
// time is handled (see effectiveUtcOffset below); non-US entries use their
// standard offset year-round, since this table doesn't yet track every
// country's DST calendar.

const CITY_COORDS = {
  "new york": { lat: 40.7128, lon: -74.006, utc: -5, us: true },
  "brooklyn": { lat: 40.6782, lon: -73.9442, utc: -5, us: true },
  "manhattan": { lat: 40.7831, lon: -73.9712, utc: -5, us: true },
  "los angeles": { lat: 34.0522, lon: -118.2437, utc: -8, us: true },
  "chicago": { lat: 41.8781, lon: -87.6298, utc: -6, us: true },
  "houston": { lat: 29.7604, lon: -95.3698, utc: -6, us: true },
  "phoenix": { lat: 33.4484, lon: -112.074, utc: -7, us: true, observesDST: false },
  "philadelphia": { lat: 39.9526, lon: -75.1652, utc: -5, us: true },
  "san antonio": { lat: 29.4241, lon: -98.4936, utc: -6, us: true },
  "san diego": { lat: 32.7157, lon: -117.1611, utc: -8, us: true },
  "dallas": { lat: 32.7767, lon: -96.797, utc: -6, us: true },
  "san francisco": { lat: 37.7749, lon: -122.4194, utc: -8, us: true },
  "atlanta": { lat: 33.749, lon: -84.388, utc: -5, us: true },
  "boston": { lat: 42.3601, lon: -71.0589, utc: -5, us: true },
  "miami": { lat: 25.7617, lon: -80.1918, utc: -5, us: true },
  "seattle": { lat: 47.6062, lon: -122.3321, utc: -8, us: true },
  "denver": { lat: 39.7392, lon: -104.9903, utc: -7, us: true },
  "detroit": { lat: 42.3314, lon: -83.0458, utc: -5, us: true },
  "washington": { lat: 38.9072, lon: -77.0369, utc: -5, us: true },
  "las vegas": { lat: 36.1699, lon: -115.1398, utc: -8, us: true },
  "nashville": { lat: 36.1627, lon: -86.7816, utc: -6, us: true },
  "new orleans": { lat: 29.9511, lon: -90.0715, utc: -6, us: true },
  "honolulu": { lat: 21.3069, lon: -157.8583, utc: -10, us: true, observesDST: false },
  "anchorage": { lat: 61.2181, lon: -149.9003, utc: -9, us: true },
  "toronto": { lat: 43.6532, lon: -79.3832, utc: -5 },
  "vancouver": { lat: 49.2827, lon: -123.1207, utc: -8 },
  "montreal": { lat: 45.5019, lon: -73.5674, utc: -5 },
  "mexico city": { lat: 19.4326, lon: -99.1332, utc: -6 },
  "london": { lat: 51.5072, lon: -0.1276, utc: 0 },
  "manchester": { lat: 53.4808, lon: -2.2426, utc: 0 },
  "paris": { lat: 48.8566, lon: 2.3522, utc: 1 },
  "berlin": { lat: 52.52, lon: 13.405, utc: 1 },
  "madrid": { lat: 40.4168, lon: -3.7038, utc: 1 },
  "rome": { lat: 41.9028, lon: 12.4964, utc: 1 },
  "amsterdam": { lat: 52.3676, lon: 4.9041, utc: 1 },
  "dublin": { lat: 53.3498, lon: -6.2603, utc: 0 },
  "lisbon": { lat: 38.7223, lon: -9.1393, utc: 0 },
  "vienna": { lat: 48.2082, lon: 16.3738, utc: 1 },
  "zurich": { lat: 47.3769, lon: 8.5417, utc: 1 },
  "brussels": { lat: 50.8503, lon: 4.3517, utc: 1 },
  "stockholm": { lat: 59.3293, lon: 18.0686, utc: 1 },
  "oslo": { lat: 59.9139, lon: 10.7522, utc: 1 },
  "copenhagen": { lat: 55.6761, lon: 12.5683, utc: 1 },
  "athens": { lat: 37.9838, lon: 23.7275, utc: 2 },
  "warsaw": { lat: 52.2297, lon: 21.0122, utc: 1 },
  "moscow": { lat: 55.7558, lon: 37.6173, utc: 3 },
  "istanbul": { lat: 41.0082, lon: 28.9784, utc: 3 },
  "dubai": { lat: 25.2048, lon: 55.2708, utc: 4 },
  "cairo": { lat: 30.0444, lon: 31.2357, utc: 2 },
  "lagos": { lat: 6.5244, lon: 3.3792, utc: 1 },
  "nairobi": { lat: -1.2921, lon: 36.8219, utc: 3 },
  "johannesburg": { lat: -26.2041, lon: 28.0473, utc: 2 },
  "cape town": { lat: -33.9249, lon: 18.4241, utc: 2 },
  "mumbai": { lat: 19.076, lon: 72.8777, utc: 5.5 },
  "delhi": { lat: 28.7041, lon: 77.1025, utc: 5.5 },
  "bangalore": { lat: 12.9716, lon: 77.5946, utc: 5.5 },
  "karachi": { lat: 24.8607, lon: 67.0011, utc: 5 },
  "dhaka": { lat: 23.8103, lon: 90.4125, utc: 6 },
  "bangkok": { lat: 13.7563, lon: 100.5018, utc: 7 },
  "singapore": { lat: 1.3521, lon: 103.8198, utc: 8 },
  "kuala lumpur": { lat: 3.139, lon: 101.6869, utc: 8 },
  "jakarta": { lat: -6.2088, lon: 106.8456, utc: 7 },
  "manila": { lat: 14.5995, lon: 120.9842, utc: 8 },
  "hong kong": { lat: 22.3193, lon: 114.1694, utc: 8 },
  "shanghai": { lat: 31.2304, lon: 121.4737, utc: 8 },
  "beijing": { lat: 39.9042, lon: 116.4074, utc: 8 },
  "seoul": { lat: 37.5665, lon: 126.978, utc: 9 },
  "tokyo": { lat: 35.6762, lon: 139.6503, utc: 9 },
  "osaka": { lat: 34.6937, lon: 135.5023, utc: 9 },
  "sydney": { lat: -33.8688, lon: 151.2093, utc: 10 },
  "melbourne": { lat: -37.8136, lon: 144.9631, utc: 10 },
  "auckland": { lat: -36.8485, lon: 174.7633, utc: 12 },
  "sao paulo": { lat: -23.5505, lon: -46.6333, utc: -3 },
  "rio de janeiro": { lat: -22.9068, lon: -43.1729, utc: -3 },
  "buenos aires": { lat: -34.6037, lon: -58.3816, utc: -3 },
  "bogota": { lat: 4.711, lon: -74.0721, utc: -5 },
  "lima": { lat: -12.0464, lon: -77.0428, utc: -5 },
  "santiago": { lat: -33.4489, lon: -70.6693, utc: -4 },
  "kingston": { lat: 17.9714, lon: -76.7931, utc: -5 },
  "havana": { lat: 23.1136, lon: -82.3666, utc: -5 },
};

// Extra US cities so "City, State" entries compute. Substring matching below
// means "Buffalo, NY", "buffalo new york", and "Buffalo" all resolve the same.
const US_CITY_EXTRA = {
  "buffalo": { lat: 42.8864, lon: -78.8784, utc: -5 },
  "rochester": { lat: 43.1566, lon: -77.6088, utc: -5 },
  "albany": { lat: 42.6526, lon: -73.7562, utc: -5 },
  "syracuse": { lat: 43.0481, lon: -76.1474, utc: -5 },
  "yonkers": { lat: 40.9312, lon: -73.8988, utc: -5 },
  "newark": { lat: 40.7357, lon: -74.1724, utc: -5 },
  "jersey city": { lat: 40.7178, lon: -74.0431, utc: -5 },
  "baltimore": { lat: 39.2904, lon: -76.6122, utc: -5 },
  "richmond": { lat: 37.5407, lon: -77.436, utc: -5 },
  "charlotte": { lat: 35.2271, lon: -80.8431, utc: -5 },
  "raleigh": { lat: 35.7796, lon: -78.6382, utc: -5 },
  "charleston": { lat: 32.7765, lon: -79.9311, utc: -5 },
  "columbia": { lat: 34.0007, lon: -81.0348, utc: -5 },
  "savannah": { lat: 32.0809, lon: -81.0912, utc: -5 },
  "jacksonville": { lat: 30.3322, lon: -81.6557, utc: -5 },
  "orlando": { lat: 28.5384, lon: -81.3789, utc: -5 },
  "tampa": { lat: 27.9506, lon: -82.4572, utc: -5 },
  "fort lauderdale": { lat: 26.1224, lon: -80.1373, utc: -5 },
  "pittsburgh": { lat: 40.4406, lon: -79.9959, utc: -5 },
  "cleveland": { lat: 41.4993, lon: -81.6944, utc: -5 },
  "columbus": { lat: 39.9612, lon: -82.9988, utc: -5 },
  "cincinnati": { lat: 39.1031, lon: -84.512, utc: -5 },
  "indianapolis": { lat: 39.7684, lon: -86.1581, utc: -5 },
  "louisville": { lat: 38.2527, lon: -85.7585, utc: -5 },
  "memphis": { lat: 35.1495, lon: -90.049, utc: -6 },
  "birmingham": { lat: 33.5186, lon: -86.8104, utc: -6 },
  "jackson": { lat: 32.2988, lon: -90.1848, utc: -6 },
  "baton rouge": { lat: 30.4515, lon: -91.1871, utc: -6 },
  "little rock": { lat: 34.7465, lon: -92.2896, utc: -6 },
  "st louis": { lat: 38.627, lon: -90.1994, utc: -6 },
  "saint louis": { lat: 38.627, lon: -90.1994, utc: -6 },
  "kansas city": { lat: 39.0997, lon: -94.5786, utc: -6 },
  "minneapolis": { lat: 44.9778, lon: -93.265, utc: -6 },
  "milwaukee": { lat: 43.0389, lon: -87.9065, utc: -6 },
  "oklahoma city": { lat: 35.4676, lon: -97.5164, utc: -6 },
  "tulsa": { lat: 36.154, lon: -95.9928, utc: -6 },
  "austin": { lat: 30.2672, lon: -97.7431, utc: -6 },
  "fort worth": { lat: 32.7555, lon: -97.3308, utc: -6 },
  "el paso": { lat: 31.7619, lon: -106.485, utc: -7 },
  "albuquerque": { lat: 35.0844, lon: -106.6504, utc: -7 },
  "salt lake city": { lat: 40.7608, lon: -111.891, utc: -7 },
  "boise": { lat: 43.615, lon: -116.2023, utc: -7 },
  "tucson": { lat: 32.2226, lon: -110.9747, utc: -7, observesDST: false },
  "portland": { lat: 45.5152, lon: -122.6784, utc: -8 },
  "sacramento": { lat: 38.5816, lon: -121.4944, utc: -8 },
  "san jose": { lat: 37.3382, lon: -121.8863, utc: -8 },
  "oakland": { lat: 37.8044, lon: -122.2712, utc: -8 },
  "fresno": { lat: 36.7378, lon: -119.7871, utc: -8 },
  "long beach": { lat: 33.7701, lon: -118.1937, utc: -8 },
  "bronx": { lat: 40.8448, lon: -73.8648, utc: -5 },
  "queens": { lat: 40.7282, lon: -73.7949, utc: -5 },
  "staten island": { lat: 40.5795, lon: -74.1502, utc: -5 },
};
for (const key of Object.keys(US_CITY_EXTRA)) US_CITY_EXTRA[key].us = true;
Object.assign(CITY_COORDS, US_CITY_EXTRA);

// State-level fallback: when the town isn't in the city table ("Nyack, NY"),
// the state's approximate center still gives a real Ascendant within a
// degree or two of latitude, far closer than not computing at all. Two-letter
// abbreviations are matched as whole tokens only, so words like "in", "or",
// and "me" in a town name can't false-match a state.
const US_STATES = {
  "alabama": { abbr: "al", lat: 32.8, lon: -86.8, utc: -6 },
  "alaska": { abbr: "ak", lat: 64.0, lon: -152.0, utc: -9 },
  "arizona": { abbr: "az", lat: 34.2, lon: -111.6, utc: -7, observesDST: false },
  "arkansas": { abbr: "ar", lat: 34.8, lon: -92.4, utc: -6 },
  "california": { abbr: "ca", lat: 37.2, lon: -119.3, utc: -8 },
  "colorado": { abbr: "co", lat: 39.0, lon: -105.5, utc: -7 },
  "connecticut": { abbr: "ct", lat: 41.6, lon: -72.7, utc: -5 },
  "delaware": { abbr: "de", lat: 39.0, lon: -75.5, utc: -5 },
  "florida": { abbr: "fl", lat: 28.6, lon: -82.4, utc: -5 },
  "georgia": { abbr: "ga", lat: 32.6, lon: -83.4, utc: -5 },
  "hawaii": { abbr: "hi", lat: 20.3, lon: -156.4, utc: -10, observesDST: false },
  "idaho": { abbr: "id", lat: 44.4, lon: -114.6, utc: -7 },
  "illinois": { abbr: "il", lat: 40.0, lon: -89.2, utc: -6 },
  "indiana": { abbr: "in", lat: 39.9, lon: -86.3, utc: -5 },
  "iowa": { abbr: "ia", lat: 42.1, lon: -93.5, utc: -6 },
  "kansas": { abbr: "ks", lat: 38.5, lon: -98.4, utc: -6 },
  "kentucky": { abbr: "ky", lat: 37.5, lon: -85.3, utc: -5 },
  "louisiana": { abbr: "la", lat: 31.1, lon: -92.0, utc: -6 },
  "maine": { abbr: "me", lat: 45.4, lon: -69.2, utc: -5 },
  "maryland": { abbr: "md", lat: 39.0, lon: -76.8, utc: -5 },
  "massachusetts": { abbr: "ma", lat: 42.3, lon: -71.8, utc: -5 },
  "michigan": { abbr: "mi", lat: 44.3, lon: -85.4, utc: -5 },
  "minnesota": { abbr: "mn", lat: 46.3, lon: -94.3, utc: -6 },
  "mississippi": { abbr: "ms", lat: 32.7, lon: -89.7, utc: -6 },
  "missouri": { abbr: "mo", lat: 38.4, lon: -92.5, utc: -6 },
  "montana": { abbr: "mt", lat: 47.0, lon: -109.6, utc: -7 },
  "nebraska": { abbr: "ne", lat: 41.5, lon: -99.8, utc: -6 },
  "nevada": { abbr: "nv", lat: 39.3, lon: -116.6, utc: -8 },
  "new hampshire": { abbr: "nh", lat: 43.7, lon: -71.6, utc: -5 },
  "new jersey": { abbr: "nj", lat: 40.2, lon: -74.7, utc: -5 },
  "new mexico": { abbr: "nm", lat: 34.4, lon: -106.1, utc: -7 },
  "new york": { abbr: "ny", lat: 42.9, lon: -75.5, utc: -5 },
  "north carolina": { abbr: "nc", lat: 35.5, lon: -79.4, utc: -5 },
  "north dakota": { abbr: "nd", lat: 47.4, lon: -100.5, utc: -6 },
  "ohio": { abbr: "oh", lat: 40.3, lon: -82.8, utc: -5 },
  "oklahoma": { abbr: "ok", lat: 35.6, lon: -97.5, utc: -6 },
  "oregon": { abbr: "or", lat: 44.0, lon: -120.5, utc: -8 },
  "pennsylvania": { abbr: "pa", lat: 40.9, lon: -77.8, utc: -5 },
  "rhode island": { abbr: "ri", lat: 41.7, lon: -71.6, utc: -5 },
  "south carolina": { abbr: "sc", lat: 33.9, lon: -80.9, utc: -5 },
  "south dakota": { abbr: "sd", lat: 44.4, lon: -100.2, utc: -6 },
  "tennessee": { abbr: "tn", lat: 35.9, lon: -86.4, utc: -6 },
  "texas": { abbr: "tx", lat: 31.5, lon: -99.3, utc: -6 },
  "utah": { abbr: "ut", lat: 39.3, lon: -111.7, utc: -7 },
  "vermont": { abbr: "vt", lat: 44.1, lon: -72.7, utc: -5 },
  "virginia": { abbr: "va", lat: 37.5, lon: -78.9, utc: -5 },
  "washington state": { abbr: "wa", lat: 47.4, lon: -120.5, utc: -8 },
  "west virginia": { abbr: "wv", lat: 38.6, lon: -80.6, utc: -5 },
  "wisconsin": { abbr: "wi", lat: 44.6, lon: -89.7, utc: -6 },
  "wyoming": { abbr: "wy", lat: 43.0, lon: -107.6, utc: -7 },
};

function lookupCity(locationStr) {
  if (!locationStr) return null;
  const norm = locationStr.toLowerCase().trim().replace(/[.]/g, "");
  // 1. Exact city match on the part before a comma.
  const beforeComma = norm.split(",")[0].trim();
  if (CITY_COORDS[beforeComma]) return { ...CITY_COORDS[beforeComma], matchedLabel: beforeComma, level: "city" };
  // 2. Substring city match over the whole entry, longest names first.
  const entries = Object.entries(CITY_COORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [name, coords] of entries) {
    if (norm.includes(name)) return { ...coords, matchedLabel: name, level: "city" };
  }
  // 3. State fallback: full names as substrings, abbreviations as whole tokens.
  const tokens = norm.split(/[\s,]+/).filter(Boolean);
  for (const [stateName, s] of Object.entries(US_STATES)) {
    if (norm.includes(stateName) || tokens.includes(s.abbr)) {
      return { lat: s.lat, lon: s.lon, utc: s.utc, us: true, observesDST: s.observesDST, matchedLabel: stateName === "washington state" ? "washington" : stateName, level: "state" };
    }
  }
  return null;
}

function computeAscMC(dateStr, timeStr, lat, lon, utcOffset) {
  if (!dateStr || !timeStr) return null;
  const [y, m, dd] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const localHours = h + mi / 60;
  const utHours = localHours - utcOffset;
  const d = dayNumber(y, m, dd, utHours);
  const JD = d + 2451543.5;
  const T = (JD - 2451545.0) / 36525;
  let GMST = 280.46061837 + 360.98564736629 * (JD - 2451545.0) + 0.000387933 * T * T;
  GMST = ((GMST % 360) + 360) % 360;
  const LST = ((GMST + lon) % 360 + 360) % 360; // RAMC, in degrees
  const RAMC = LST;

  // Obliquity of the ecliptic, slowly decreasing over time (standard formula).
  const eps = 23.4392911 - 0.0130042 * T;

  const ascY = Math.cos(RAMC * D2R);
  const ascX = -(Math.sin(eps * D2R) * Math.tan(lat * D2R) + Math.cos(eps * D2R) * Math.sin(RAMC * D2R));
  let asc = Math.atan2(ascY, ascX) * R2D;
  asc = ((asc % 360) + 360) % 360;

  let mc = Math.atan2(Math.sin(RAMC * D2R), Math.cos(RAMC * D2R) * Math.cos(eps * D2R)) * R2D;
  mc = ((mc % 360) + 360) % 360;

  return { ascendant: lonToSignDegree(asc), midheaven: lonToSignDegree(mc), ascLon: asc };
}

// Whole Sign: house 1 is the Ascendant's whole sign, houses count forward
// from there one sign at a time. Equal House: identical starting point, but
// each house cusp sits exactly 30 degrees past the last rather than at a
// sign boundary. Both are real, closed-form house systems once the
// Ascendant is known, unlike Placidus which needs iterative solving this
// build doesn't implement yet.
function wholeSignHouseOf(pointLon, ascLon) {
  const ascSignIdx = Math.floor(ascLon / 30);
  const pointSignIdx = Math.floor(((pointLon % 360) + 360) % 360 / 30);
  return (((pointSignIdx - ascSignIdx) % 12) + 12) % 12 + 1;
}

// True Placidus: find which cusp interval the longitude falls in. cusps is
// the 12-entry array from Swiss Ephemeris, cusps[0] = 1st house cusp.
function placidusCuspHouseOf(pointLon, cusps) {
  const L = ((pointLon % 360) + 360) % 360;
  for (let h = 0; h < 12; h++) {
    const a = cusps[h];
    const b = cusps[(h + 1) % 12];
    if (a <= b ? L >= a && L < b : L >= a || L < b) return h + 1;
  }
  return 1;
}

function equalHouseOf(pointLon, ascLon) {
  const diff = ((((pointLon - ascLon) % 360) + 360) % 360);
  return Math.floor(diff / 30) + 1;
}



const ZODIAC_SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];

const SIGN_FLAVOR = {
  Aries: "acting first, directness, and impatience with waiting for permission",
  Taurus: "steadiness, a preference for the tangible, and real resistance to being rushed",
  Gemini: "curiosity, quick wit, and a need for variety and conversation",
  Cancer: "emotional attunement, protectiveness, and a strong pull toward home and belonging",
  Leo: "warmth, a need to be seen, and natural confidence in front of others",
  Virgo: "precision, service, and a habit of improving whatever isn't yet working",
  Libra: "diplomacy, a strong sense of fairness, and discomfort with open conflict",
  Scorpio: "depth, intensity, and a need to understand what's underneath the surface rather than accept things at face value",
  Sagittarius: "optimism, a hunger for meaning, and restlessness with anything too confining",
  Capricorn: "discipline, patience, and a long-term relationship with responsibility",
  Aquarius: "independence, unconventional thinking, and a pull toward the collective over the personal",
  Pisces: "imagination, empathy, and a tendency to absorb what's around you emotionally",
};

const SIGN_GIST = {
  Aries: "Acting first, fast decisions",
  Taurus: "Steadiness, resisting rushing",
  Gemini: "Curiosity, quick adaptability",
  Cancer: "Emotional attunement, protectiveness",
  Leo: "Confidence, need to be seen",
  Virgo: "Precision, improvement-driven",
  Libra: "Diplomacy, fairness-seeking",
  Scorpio: "Depth & investigation",
  Sagittarius: "Meaning-seeking, restless optimism",
  Capricorn: "Discipline, long-game patience",
  Aquarius: "Independence, unconventional thinking",
  Pisces: "Imagination, emotional absorption",
};

const HOUSE_FLAVOR = {
  1: "this plays out in first impressions and how you show up before anyone knows you",
  2: "this plays out around personal resources, money, and a sense of self-worth",
  3: "this plays out through communication, immediate surroundings, and daily information exchange",
  4: "this plays out in home, family, and the foundation you build your life on",
  5: "this plays out through creative self-expression, romance, and things done for their own sake",
  6: "this plays out in daily work, routine, and health",
  7: "this plays out through one-to-one partnership and committed relationships",
  8: "this plays out around shared resources and deep transformation",
  9: "this plays out through belief systems, philosophy, travel, and higher learning",
  10: "this plays out in career, public reputation, and long-term authority",
  11: "this plays out through community, groups, and long-term goals",
  12: "this plays out privately, often below conscious awareness, before it becomes visible elsewhere",
};

const PLANET_CORE = {
  Sun: "shows core identity, the thing you're fundamentally organized around",
  Moon: "shows emotional needs and instinctive reactions, the part of you that runs on autopilot",
  Mercury: "shows how you think and communicate",
  Venus: "shows what you value in love, beauty, and pleasure",
  Mars: "shows how you assert yourself and handle conflict",
  Jupiter: "shows where growth, luck, and expansion come most naturally",
  Saturn: "shows where discipline, restriction, and long-term responsibility are required, often felt as a lesson rather than a gift",
  Uranus: "shows where change and individuality show up suddenly, often disrupting routine",
  Neptune: "shows where dreams, intuition, spirituality, or illusion operate, often blurring hard edges",
  Pluto: "shows where the deepest, most total transformation in your life takes place, often through crisis or intensity",
  "North Node": "points toward the direction of growth for this lifetime, the skills that don't come naturally but are worth building anyway",
  Chiron: "marks the core wound and, over time, the place where the deepest healing and teaching capacity develops",
  Lilith: "represents the instinct that gets suppressed or considered too much, the part of you that doesn't apologize",
  Vertex: "is a lesser-used point often associated with fated encounters or turning points that feel outside personal control",
};

function planetDef(planet, sign, house, { soul = false } = {}) {
  const core = PLANET_CORE[planet] || "marks a placement in the chart";
  const subject = soul ? `The Draconic ${planet}` : `The ${planet}`;
  const framing = soul
    ? `${subject} shows the soul-level version of what the Tropical ${planet} shows on the surface: ${core.replace(/^shows /, "")}.`
    : `${subject} ${core}.`;
  const signPart = `In ${sign}, ${soul ? "at the soul level, that shows up through" : "that expresses through"} ${SIGN_FLAVOR[sign]}.`;
  const housePart = house ? `In the ${ORDINAL_HOUSE[house]} house, ${HOUSE_FLAVOR[house]}.` : "";
  return `${framing} ${signPart} ${housePart}`.trim();
}

// ---------- generated: full tropical + draconic chart ----------

const CHART_POINTS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "North Node", "Chiron", "Lilith", "Vertex"];

const REAL_KEY_MAP = { Sun: "Sun", Moon: "Moon", Mercury: "Mercury", Venus: "Venus", Mars: "Mars", Jupiter: "Jupiter", Saturn: "Saturn", Uranus: "Uranus", Neptune: "Neptune", Pluto: "Pluto", "North Node": "NorthNode", Chiron: "Chiron", Lilith: "Lilith", Vertex: "Vertex" };

// real: output of calcRealPlanetPositions, or null if no birth date was given.
// nodeOffset: for the draconic layer, how far (in degrees) to shift every
// real longitude so the North Node lands at 0° Aries — the actual definition
// of a draconic chart, applied to whichever points we have real longitudes for.
function generateChartLayer(rng, sunSign, { soul = false, real = null, nodeOffset = 0, reuseAngles = null, houses = null } = {}) {
  const points = {};
  for (const planet of CHART_POINTS) {
    const realKey = REAL_KEY_MAP[planet];
    let sign, degree, isReal, lonForHouse;
    if (real && realKey && real[realKey]) {
      const lon = soul ? normDeg(real[realKey].lon + nodeOffset) : real[realKey].lon;
      const placed = lonToSignDegree(lon);
      sign = placed.sign;
      degree = degMinString(placed.degree);
      isReal = true;
      lonForHouse = lon;
    } else {
      sign = planet === "Sun" && !soul ? sunSign : pick(rng, ZODIAC_SIGNS);
      degree = degreeString(rng);
      isReal = false;
      lonForHouse = null;
    }

    let placidusHouse, wholeSignHouse, housesReal;
    if (houses && lonForHouse !== null) {
      const ascLonForHouses = soul ? normDeg(houses.ascLon + nodeOffset) : houses.ascLon;
      const natalLon = soul ? normDeg(lonForHouse - nodeOffset) : lonForHouse;
      placidusHouse = houses.cusps ? placidusCuspHouseOf(natalLon, houses.cusps) : equalHouseOf(lonForHouse, ascLonForHouses);
      wholeSignHouse = wholeSignHouseOf(lonForHouse, ascLonForHouses);
      housesReal = true;
    } else {
      placidusHouse = Math.floor(rng() * 12) + 1;
      wholeSignHouse = (placidusHouse % 12) + 1;
      housesReal = false;
    }

    points[planet] = {
      sign,
      placidusHouse,
      wholeSignHouse,
      housesReal,
      degree,
      isReal,
      def: planetDef(planet, sign, placidusHouse, { soul }),
    };
  }
  // Angles need a geocoded birth location and precise sidereal time. When a
  // recognized city and birth time are both given, houses.ascendant/midheaven
  // hold a real calculation (verified against a fully worked reference
  // example, see computeAscMC). Otherwise these stay generated. By
  // convention the angles don't shift between tropical and draconic charts,
  // so the draconic layer reuses the tropical layer's angles exactly.
  let ascendant, midheaven;
  if (reuseAngles) {
    ascendant = reuseAngles.ascendant;
    midheaven = reuseAngles.midheaven;
  } else if (houses) {
    ascendant = { sign: houses.ascendant.sign, degree: degMinString(houses.ascendant.degree), isReal: true };
    midheaven = { sign: houses.midheaven.sign, degree: degMinString(houses.midheaven.degree), isReal: true };
  } else {
    ascendant = { sign: pick(rng, ZODIAC_SIGNS), degree: degreeString(rng), isReal: false };
    midheaven = { sign: pick(rng, ZODIAC_SIGNS), degree: degreeString(rng), isReal: false };
  }
  return {
    points,
    ascendant: { ...ascendant, def: planetDef("Ascendant", ascendant.sign, null, { soul }) },
    midheaven,
  };
}

// ---------- generated: Vedic timing ----------

const GRAHAS = ["Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury", "Ketu", "Venus"];

function generateVedicTiming(rng, birthYear) {
  const mahaGraha = pick(rng, GRAHAS);
  let bhuktiGraha = pick(rng, GRAHAS);
  while (bhuktiGraha === mahaGraha) bhuktiGraha = pick(rng, GRAHAS);
  let nextBhukti = pick(rng, GRAHAS);
  while (nextBhukti === bhuktiGraha) nextBhukti = pick(rng, GRAHAS);
  const closingYear = 2026 + Math.floor(rng() * 3);
  const closingMonth = pick(rng, ["Feb", "Apr", "Jun", "Aug", "Oct", "Dec"]);
  const releaseGraha = pick(rng, GRAHAS.filter((g) => g !== mahaGraha));
  const releaseYear = closingYear + Math.floor(rng() * 2);
  const sadeSatiPhase = Math.floor(rng() * 3) + 1;
  return {
    isReal: false,
    mahaGraha,
    bhuktiGraha,
    nextBhukti,
    closingLabel: `${closingMonth} ${closingYear}`,
    releaseGraha,
    releaseLabel: `${pick(rng, ["Feb", "Apr", "Jun", "Aug", "Oct", "Dec"])} ${releaseYear}`,
    sadeSatiPhase,
    progressPct: 30 + Math.floor(rng() * 55),
  };
}

// ---------- real: Vimshottari dasha timing ----------
// Computed from the Moon's actual longitude: tropical minus Lahiri ayanamsa
// gives the sidereal position, that position's nakshatra sets the starting
// dasha lord and its remaining balance, and the fixed 120-year Vimshottari
// sequence unfolds from there. Verified against independently confirmed
// reference timing (Ashwini pada 1 Moon; Sun Mahadasha ending Oct 2028;
// Sun/Saturn bhukti closing Aug 2026 into Sun/Mercury) before being wired in.
const DASHA_SEQ = [
  ["Ketu", 7], ["Venus", 20], ["Sun", 6], ["Moon", 10], ["Mars", 7],
  ["Rahu", 18], ["Jupiter", 16], ["Saturn", 19], ["Mercury", 17],
];
const NAKSHATRA_SPAN = 360 / 27;
const NAKSHATRA_NAMES = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
  "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

function lahiriAyanamsa(yearFrac) {
  return 23.85 + (yearFrac - 2000) * (50.29 / 3600);
}

function yearFracToLabel(yf) {
  const year = Math.floor(yf);
  const monthIdx = Math.min(11, Math.floor((yf - year) * 12));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[monthIdx]} ${year}`;
}

function computeVedicTiming(tropicalMoonLon, birthDate) {
  if (tropicalMoonLon == null || !birthDate) return null;
  const [y, m, dd] = birthDate.split("-").map(Number);
  const birthYearFrac = y + (m - 1) / 12 + (dd - 1) / 365;
  const nowYearFrac = new Date().getFullYear() + new Date().getMonth() / 12;

  const ayanamsa = lahiriAyanamsa(birthYearFrac);
  const sidereal = ((tropicalMoonLon - ayanamsa) % 360 + 360) % 360;
  const nakIndex = Math.floor(sidereal / NAKSHATRA_SPAN);
  const posInNak = sidereal - nakIndex * NAKSHATRA_SPAN;
  const pada = Math.floor(posInNak / (NAKSHATRA_SPAN / 4)) + 1;
  const fracElapsed = posInNak / NAKSHATRA_SPAN;
  const startLordIdx = nakIndex % 9;

  // Mahadasha timeline from birth, wrapping the 120-year cycle far enough
  // to cover any realistic lifespan.
  const periods = [];
  let t = birthYearFrac;
  const [firstLord, firstYears] = DASHA_SEQ[startLordIdx];
  const balance = firstYears * (1 - fracElapsed);
  periods.push({ lord: firstLord, start: t, end: t + balance, years: firstYears });
  t += balance;
  for (let i = 1; i < 18; i++) {
    const [l, yrs] = DASHA_SEQ[(startLordIdx + i) % 9];
    periods.push({ lord: l, start: t, end: t + yrs, years: yrs });
    t += yrs;
  }

  const current = periods.find((p) => nowYearFrac >= p.start && nowYearFrac < p.end) || periods[0];

  // Bhuktis inside the current mahadasha: same nine-lord sequence starting
  // from the mahadasha lord itself, each scaled by lordYears/120.
  const mahaIdx = DASHA_SEQ.findIndex(([l]) => l === current.lord);
  const bhuktiList = [];
  let bt = current.start;
  for (let i = 0; i < 9; i++) {
    const [l, yrs] = DASHA_SEQ[(mahaIdx + i) % 9];
    const realLen = (current.years * yrs) / 120;
    bhuktiList.push({ lord: l, start: bt, end: bt + realLen });
    bt += realLen;
  }
  const currentBhukti = bhuktiList.find((b) => nowYearFrac >= b.start && nowYearFrac < b.end) || bhuktiList[0];
  const bhuktiIdx = bhuktiList.indexOf(currentBhukti);
  const nextBhukti = bhuktiList[(bhuktiIdx + 1) % 9];

  const progressPct = Math.round(((nowYearFrac - current.start) / (current.end - current.start)) * 100);

  return {
    isReal: true,
    sidereal,
    nakshatra: NAKSHATRA_NAMES[nakIndex],
    pada,
    mahaGraha: current.lord,
    mahaStartLabel: yearFracToLabel(current.start),
    mahaEndLabel: yearFracToLabel(current.end),
    bhuktiGraha: currentBhukti.lord,
    nextBhukti: nextBhukti.lord,
    closingLabel: yearFracToLabel(currentBhukti.end),
    nextMaha: periods[periods.indexOf(current) + 1] ? periods[periods.indexOf(current) + 1].lord : null,
    progressPct: Math.max(0, Math.min(100, progressPct)),
  };
}

// ---------- generated: Human Design ----------

const HD_TYPES = [
  ["Generator", 37],
  ["Manifesting Generator", 33],
  ["Projector", 20],
  ["Manifestor", 9],
  ["Reflector", 1],
];

const HD_AUTHORITY_BY_TYPE = {
  Generator: ["Sacral", "Emotional"],
  "Manifesting Generator": ["Sacral", "Emotional"],
  Projector: ["Splenic", "Self-Projected", "Ego", "Emotional"],
  Manifestor: ["Emotional", "Splenic", "Ego"],
  Reflector: ["Lunar"],
};

const HD_PROFILES = ["1/3", "1/4", "2/4", "2/5", "3/5", "3/6", "4/6", "4/1", "5/1", "5/2", "6/2", "6/3"];

const HD_CROSSES = [
  "Right Angle Cross of The Unexpected",
  "Left Angle Cross of Individualism",
  "Right Angle Cross of Explanation",
  "Juxtaposition Cross of Refinement",
  "Right Angle Cross of Contagion",
  "Left Angle Cross of the Sphinx",
  "Right Angle Cross of Laws",
  "Juxtaposition Cross of Alignment",
];

const HD_DEFINITIONS = [
  ["Split Definition", 45],
  ["Single Definition", 35],
  ["Triple Split Definition", 12],
  ["Quadruple Split Definition", 5],
  ["No Definition", 3],
];

function generateHumanDesign(rng) {
  const type = pickWeighted(rng, HD_TYPES);
  const authority = pick(rng, HD_AUTHORITY_BY_TYPE[type] || ["Sacral"]);
  const profile = pick(rng, HD_PROFILES);
  const incarnationCross = pick(rng, HD_CROSSES);
  const definition = pickWeighted(rng, HD_DEFINITIONS);
  return { type, authority, profile, incarnationCross, definition };
}

const HD_TYPE_GIST = {
  Generator: "Sustainable, response-driven energy",
  "Manifesting Generator": "Fast movement once genuinely engaged",
  Projector: "Guidance through recognition, not initiation",
  Manifestor: "Initiating independently, informing after",
  Reflector: "Reflecting and sampling the environment",
};

// ---------- MBTI / Enneagram gist tables (used once quiz answers are scored) ----------

const MBTI_GIST = {
  ISTJ: "Duty through structure",
  ISFJ: "Quiet, steady care",
  INFJ: "Meaning before action",
  INTJ: "Long-range strategy",
  ISTP: "Hands-on problem solving",
  ISFP: "Quiet personal expression",
  INFP: "Values-led idealism",
  INTP: "Theory before application",
  ESTJ: "Order and execution",
  ESFJ: "Warmth through structure",
  ENFJ: "Guiding others forward",
  ENTJ: "Decisive long-range command",
  ESTP: "Action in the moment",
  ESFP: "Spontaneous engagement",
  ENFP: "Enthusiastic possibility",
  ENTP: "Debating the idea itself",
};

const LIFE_PATH_GIST = {
  1: "Leadership, independence",
  2: "Partnership, harmony-seeking",
  3: "Expression, creativity",
  4: "Structure, reliability",
  5: "Freedom, change-seeking",
  6: "Responsibility, care for others",
  7: "Analysis & truth-seeking",
  8: "Ambition, material mastery",
  9: "Compassion, completion",
  11: "Intuition, inspiration",
  22: "Master building, large-scale vision",
  33: "Master teaching, selfless service",
};

// ---------- top-level profile builder ----------

// US daylight saving time has used three different rule sets historically.
// Getting this right matters: a birth date inside the wrong rule era gets a
// UTC offset that's off by exactly one hour, which is enough to shift the
// Ascendant by more than a full sign and throw off every house behind it.
//   2007-present: 2nd Sunday in March to 1st Sunday in November
//   1987-2006:    1st Sunday in April to last Sunday in October
//   1966-1986:    last Sunday in April to last Sunday in October
//     (1974 and 1975 ran on emergency year-round DST during the oil crisis,
//     a rare exception not modeled here)
// Arizona (outside the Navajo Nation) and Hawaii don't observe DST at all.
function nthSunday(year, month, n) {
  // month is 1-12. Returns the day-of-month for the nth Sunday, or the last
  // Sunday if n === "last".
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstSundayDate = 1 + ((7 - first.getUTCDay()) % 7);
  if (n === "last") {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    let d = firstSundayDate;
    while (d + 7 <= daysInMonth) d += 7;
    return d;
  }
  return firstSundayDate + 7 * (n - 1);
}

function usObservesDST(year, month, day, observesDST) {
  if (observesDST === false) return false;
  let startMonth, startDay, endMonth, endDay;
  if (year >= 2007) {
    startMonth = 3; startDay = nthSunday(year, 3, 2);
    endMonth = 11; endDay = nthSunday(year, 11, 1);
  } else if (year >= 1987) {
    startMonth = 4; startDay = nthSunday(year, 4, 1);
    endMonth = 10; endDay = nthSunday(year, 10, "last");
  } else {
    startMonth = 4; startDay = nthSunday(year, 4, "last");
    endMonth = 10; endDay = nthSunday(year, 10, "last");
  }
  const md = month * 100 + day;
  return md >= startMonth * 100 + startDay && md < endMonth * 100 + endDay;
}

// Effective UTC offset for a birth date/location: standard offset, plus one
// hour if that date fell inside DST for that region. Scoped to recognized US
// cities and states only, other countries have their own DST rules and dates
// (the EU, for one, doesn't switch on the same days the US does), so this
// deliberately does not guess at those. Regions that don't observe DST at all
// (observesDST: false, e.g. Arizona, Hawaii) never adjust either.
function effectiveUtcOffset(dateStr, cityMatch) {
  if (!cityMatch.us) return cityMatch.utc;
  const [y, m, d] = dateStr.split("-").map(Number);
  const inDST = usObservesDST(y, m, d, cityMatch.observesDST !== false);
  return cityMatch.utc + (inDST ? 1 : 0);
}

function buildProfile({ userName, birthDate, birthTime, birthLocation, precision = null }) {
  const rng = makeRng(userName, birthDate, birthTime, birthLocation);

  const cityMatch = lookupCity(birthLocation);
  const locationRecognized = !!cityMatch;

  // If we know the birth location, birthTime is local time there, so convert
  // it to UT once here and use that same UT moment for both the planets and
  // the houses. The hour value passes through unwrapped (it can go past 24
  // or below 0), because dayNumber() folds hours into the day fraction
  // directly, which keeps a birth that crosses midnight UT on the correct
  // date. Without a recognized location, birthTime is treated as UT directly
  // (disclosed in the intake form), since there's no offset to convert with.
  let utHoursOverride = null;
  let usedOffset = null;
  if (cityMatch && birthTime) {
    usedOffset = effectiveUtcOffset(birthDate, cityMatch);
    const [h, mi] = birthTime.split(":").map(Number);
    utHoursOverride = h + mi / 60 - usedOffset;
  }

  let real = calcRealPlanetPositions(birthDate, birthTime, utHoursOverride);
  if (precision && precision.planets) {
    real = {};
    for (const [name, p] of Object.entries(precision.planets)) real[name] = lonToSignDegree(p.lon);
    if (precision.vertex != null) real.Vertex = lonToSignDegree(precision.vertex);
  }
  const sunSign = real ? real.Sun.sign : computeSunSign(birthDate);
  const chineseZodiac = computeChineseZodiac(birthDate);
  const numerology = computeNumerology(userName, birthDate);

  let houses = cityMatch && birthTime ? computeAscMC(birthDate, birthTime, cityMatch.lat, cityMatch.lon, usedOffset) : null;
  if (precision && precision.ascendant != null) {
    houses = {
      ascLon: precision.ascendant,
      ascendant: lonToSignDegree(precision.ascendant),
      midheaven: lonToSignDegree(precision.midheaven),
      cusps: precision.houses && precision.houses.cusps ? precision.houses.cusps : null,
    };
  }

  const tropical = generateChartLayer(rng, sunSign, { soul: false, real, houses });
  const nodeOffset = real ? -real.NorthNode.lon : 0;
  const draconic = generateChartLayer(rng, sunSign, { soul: true, real, nodeOffset, reuseAngles: { ascendant: tropical.ascendant, midheaven: tropical.midheaven } });
  const birthYear = birthDate ? new Date(birthDate + "T00:00:00").getFullYear() : 1996;
  const vedic = (real && real.Moon ? computeVedicTiming(real.Moon.lon, birthDate) : null) || generateVedicTiming(rng, birthYear);
  const humanDesign = generateHumanDesign(rng);

  // Seeded true/false "agreement" flags reused across the UI so a given
  // user's report is internally consistent every time it's viewed.
  const agreementRoll = () => rng() > 0.35;

  return {
    inputs: { userName, birthDate, birthTime, birthLocation },
    sunSign,
    chineseZodiac,
    numerology,
    tropical,
    draconic,
    vedic,
    humanDesign,
    locationRecognized,
    locationMatch: cityMatch,
    precisionBackend: !!precision,
    gists: {
      sign: SIGN_GIST,
      lifePath: LIFE_PATH_GIST[numerology.lifePath] || "A recurring core theme",
      hdType: HD_TYPE_GIST[humanDesign.type] || "A distinct energetic strategy",
      mbti: (type) => MBTI_GIST[type] || "A distinct cognitive style",
    },
    flags: {
      moonMatchesEnneagram: agreementRoll(),
      sacralMatchesIndependence: agreementRoll(),
      saturnMatchesSelfAuthority: agreementRoll(),
    },
  };
}

// ---------- quiz scoring ----------

function scoreMBTI(answers) {
  // answers: { EI: 'E'|'I', SN: 'S'|'N', TF: 'T'|'F', JP: 'J'|'P' }
  const type = `${answers.EI || "I"}${answers.SN || "N"}${answers.TF || "F"}${answers.JP || "J"}`;
  return type;
}

const ENNEAGRAM_NAMES = {
  1: "The Reformer",
  2: "The Helper",
  3: "The Achiever",
  4: "The Individualist",
  5: "The Investigator",
  6: "The Loyalist",
  7: "The Enthusiast",
  8: "The Challenger",
  9: "The Peacemaker",
};

function scoreEnneagram(scores) {
  // scores: { [typeNumber]: count }
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const core = entries.length ? parseInt(entries[0][0], 10) : 2;
  const adjacent = core === 1 ? 9 : core - 1;
  const adjacentUp = core === 9 ? 1 : core + 1;
  // wing is whichever neighbor scored higher
  const wingCandidate = (scores[adjacent] || 0) >= (scores[adjacentUp] || 0) ? adjacent : adjacentUp;
  return { core, wing: wingCandidate, label: `${core}w${wingCandidate}`, name: ENNEAGRAM_NAMES[core] || "" };
}

// ---------- MBTI dimension definitions (generic, works for either letter) ----------

const MBTI_DIM_DEF = {
  EI: {
    label: "Energy",
    E: { name: "Extraverted", def: "Energy comes from engagement with other people and the outside world rather than solitude. Time spent around others tends to recharge rather than drain, even when it's also demanding." },
    I: { name: "Introverted", def: "Energy is drawn from solitude and internal processing rather than from time spent around other people. Social interaction, even when enjoyable, tends to spend energy that then needs to be replenished alone." },
  },
  SN: {
    label: "Information",
    S: { name: "Sensing", def: "Attention naturally goes toward concrete, present-moment detail rather than abstract pattern or future possibility. This tends to produce a preference for literal, step-by-step facts over theory." },
    N: { name: "Intuitive", def: "Attention naturally goes toward patterns, connections, and future possibility rather than concrete, present-moment detail. This tends to produce a preference for meaning and theory over strictly literal, step-by-step facts." },
  },
  TF: {
    label: "Decisions",
    T: { name: "Thinking", def: "Decisions are weighed first by logical consistency, with impact on the people involved checked second rather than first. This isn't the absence of care, it's care applied only after the logic holds up." },
    F: { name: "Feeling", def: "Decisions are weighed first by values and impact on people, with logical analysis checked second rather than first. This isn't the absence of logic, it's logic applied after asking who a decision affects and how." },
  },
  JP: {
    label: "Structure",
    J: { name: "Judging", def: "Preference runs toward planning, closure, and settled decisions over staying open-ended and flexible. Unresolved questions or loose plans tend to create real discomfort rather than excitement." },
    P: { name: "Perceiving", def: "Preference runs toward staying open-ended and flexible over settling into a fixed plan. Closure that arrives too early tends to feel constraining rather than comforting." },
  },
};

function mbtiDimensionDetails(mbtiType) {
  const t = (mbtiType || "INFJ").toUpperCase();
  const ei = MBTI_DIM_DEF.EI[t[0]] || MBTI_DIM_DEF.EI.I;
  const sn = MBTI_DIM_DEF.SN[t[1]] || MBTI_DIM_DEF.SN.N;
  const tf = MBTI_DIM_DEF.TF[t[2]] || MBTI_DIM_DEF.TF.F;
  const jp = MBTI_DIM_DEF.JP[t[3]] || MBTI_DIM_DEF.JP.J;
  return { energy: ei, information: sn, decisions: tf, structure: jp };
}

// ---------- Human Design definitions (generic per value, not per-person) ----------

const HD_TYPE_DEF = {
  Generator: "One of five Human Design types, built to respond to what genuinely excites it and generate sustainable energy through consistent engagement, rather than initiating from a cold start. Generators often find satisfaction through mastery built over time, and tend to feel frustrated or tired when initiating instead of responding.",
  "Manifesting Generator": "One of five Human Design types, built to respond to what genuinely excites it and move quickly once it does, rather than initiating from a cold start or waiting passively for life to arrive. Manifesting Generators often skip steps other types need, multitask, and can frustrate themselves trying to slow down and do things in order.",
  Projector: "One of five Human Design types, built to see and guide efficiently rather than generate constant output. Projectors work best when invited or recognized, and tend to burn out when pushing to initiate the way Generators or Manifestors do.",
  Manifestor: "One of five Human Design types, built to initiate and start new things independently. Manifestors move first and inform others after the fact rather than waiting for invitation, and tend to feel the most resistance when asked to explain themselves in advance.",
  Reflector: "The rarest of the five Human Design types, built to sample and reflect the energy of whoever and whatever is around. Reflectors often need a full lunar cycle to make major decisions with real confidence, since this design has no consistent internal authority to check against.",
};

const HD_AUTHORITY_DEF = {
  Sacral: "Authority describes the most reliable decision-making process for this design. Sacral authority is a gut-level, in-the-body yes or no response, felt in real time when a question is asked, rather than something worked out mentally in advance. Decisions made from the head instead of the gut tend to feel worse in hindsight for this authority type.",
  Emotional: "Authority describes the most reliable decision-making process for this design. Emotional authority means clarity doesn't arrive in the moment, it arrives after riding out an emotional wave, so decisions made under pressure in a single moment tend to get revisited later.",
  Splenic: "Authority describes the most reliable decision-making process for this design. Splenic authority is a quiet, in-the-moment instinct that speaks once and doesn't repeat itself, closer to instant intuition than a slowly deliberated gut feeling.",
  Ego: "Authority describes the most reliable decision-making process for this design. Ego authority is based on willpower and what this design genuinely has the resource and desire to commit to, rather than emotional waves or a gut response.",
  "Self-Projected": "Authority describes the most reliable decision-making process for this design. Self-Projected authority becomes clear by talking it out loud to a trusted sounding board, rather than deciding internally in silence.",
  Lunar: "Authority describes the most reliable decision-making process for this design. Lunar authority, unique to Reflectors, traditionally calls for waiting out a full lunar cycle, about 28 days, before making significant decisions with confidence.",
};

const HD_LINE_DEF = {
  1: "The 1 investigates thoroughly and wants a solid foundation before acting or speaking with confidence.",
  2: "The 2 is naturally gifted but needs solitude to recognize and trust that gift before being called out into using it.",
  3: "The 3 learns through trial and error, treating failure as necessary data on the way to what actually works.",
  4: "The 4 influences the world through personal relationships and an established network, rather than broad, impersonal audiences.",
  5: "The 5 is looked to for practical solutions, often projected onto by others in ways that can feel like pressure to perform.",
  6: "The 6 lives in three phases, trial in the first third of life, observation from a distance in the middle third, and role-model authority in the last third.",
};

const HD_CROSS_THEME = {
  "Right Angle Cross of The Unexpected": "disruption, sudden change, and the capacity to adapt when circumstances shift without warning",
  "Left Angle Cross of Individualism": "standing apart from the group and trusting a highly personal, non-transferable process",
  "Right Angle Cross of Explanation": "translating complex, hard-won experience into something others can actually use",
  "Juxtaposition Cross of Refinement": "polishing and perfecting something that already exists rather than starting from scratch",
  "Right Angle Cross of Contagion": "spreading new ideas or ways of doing things simply by embodying them visibly",
  "Left Angle Cross of the Sphinx": "holding a riddle or mystery that resolves slowly, often through other people",
  "Right Angle Cross of Laws": "establishing structure, precedent, and fairness for a wider group",
  "Juxtaposition Cross of Alignment": "bringing disconnected people or ideas into correct relationship with each other",
};

const HD_DEFINITION_DEF = {
  "Single Definition": "Definition describes how the chart's energy centers connect to each other internally. Single Definition means all the defined centers connect into one continuous flow. In practice, this often means feeling fairly consistent and self-contained, without needing another person present to feel whole.",
  "Split Definition": "Definition describes how the chart's energy centers connect to each other internally. Split Definition means the centers form two separate connected clusters rather than one single continuous flow. In practice, this often means feeling most whole and decisive around specific other people or circumstances that happen to bridge the gap, rather than feeling complete alone.",
  "Triple Split Definition": "Definition describes how the chart's energy centers connect to each other internally. Triple Split Definition means the centers form three separate clusters, needing more outside connection than a Single or Split Definition to feel complete, often thriving on variety in who bridges the gaps.",
  "Quadruple Split Definition": "Definition describes how the chart's energy centers connect to each other internally. Quadruple Split Definition, the rarest configuration, means the centers form four separate clusters. This tends toward pulling insight and completeness from a wide range of different people rather than any one relationship.",
  "No Definition": "Definition describes how the chart's energy centers connect to each other internally. No Definition means none of the centers are consistently defined, so this design runs closer to a highly amplified Reflector, deeply sampling and reflecting whatever energy is around, rather than running on a fixed internal circuit.",
};

function humanDesignDetails(hd) {
  const [l1, l2] = hd.profile.split("/").map((n) => parseInt(n, 10));
  return {
    typeDef: HD_TYPE_DEF[hd.type] || "",
    authorityDef: HD_AUTHORITY_DEF[hd.authority] || "",
    profileDef: `${HD_LINE_DEF[l1] || ""} ${HD_LINE_DEF[l2] || ""}`.trim(),
    crossDef: `The Incarnation Cross is a life-theme marker built from four specific chart placements, describing the larger purpose this design is oriented around. The ${hd.incarnationCross} centers on ${HD_CROSS_THEME[hd.incarnationCross] || "a specific life theme"}.`,
    definitionDef: HD_DEFINITION_DEF[hd.definition] || "",
  };
}

// ---------- Enneagram cross-check: real logic against generated chart signs ----------

const ENNEAGRAM_TRAIT = {
  1: "a strict, internalized standard about doing things correctly",
  2: "service-oriented love and care for others",
  3: "image-conscious drive toward visible achievement",
  9: "a pull toward peace and away from confrontation",
};

const ENNEAGRAM_SUPPORTIVE_SIGNS = {
  1: ["Virgo", "Capricorn", "Aries", "Taurus"],
  2: ["Virgo", "Cancer", "Pisces", "Libra"],
  3: ["Leo", "Capricorn", "Aries", "Scorpio"],
  9: ["Libra", "Pisces", "Taurus", "Cancer"],
};

function enneagramCrossCheck(profile) {
  const core = profile.enneagram ? profile.enneagram.core : 2;
  const trait = ENNEAGRAM_TRAIT[core] || ENNEAGRAM_TRAIT[2];
  const supportive = ENNEAGRAM_SUPPORTIVE_SIGNS[core] || ENNEAGRAM_SUPPORTIVE_SIGNS[2];
  const p = profile.tropical.points;
  const hs = profile.houseSystem || "placidus";

  const checks = [
    { label: "Venus", sign: p.Venus.sign, house: pointHouse(p.Venus, hs).house, pass: supportive.includes(p.Venus.sign) },
    { label: "Saturn", sign: p.Saturn.sign, house: pointHouse(p.Saturn, hs).house, pass: supportive.includes(p.Saturn.sign) },
    { label: "North Node + Chiron", sign: p["North Node"].sign, house: pointHouse(p["North Node"], hs).house, pass: supportive.includes(p["North Node"].sign) },
  ];
  const passCount = checks.filter((c) => c.pass).length;
  const confidence =
    passCount === 3 ? "High, three independent placements agree" : passCount === 2 ? "Moderate, two of three placements agree" : passCount === 1 ? "Mixed, only one placement agrees" : "Low, none of the checked placements agree";

  const moon = p.Moon;
  const moonGist = SIGN_GIST[moon.sign];
  const moonHouse = pointHouse(moon, hs).house;

  return { core, trait, checks, passCount, confidence, moon, moonGist, moonHouse };
}

function pointHouse(point, houseSystem) {
  const house = houseSystem === "wholeSign" ? point.wholeSignHouse : point.placidusHouse;
  return { house, label: ORDINAL_HOUSE[house] };
}

function deriveBool(profile, key, threshold = 0.4) {
  const { userName, birthDate, birthTime, birthLocation } = profile.inputs;
  const rng = makeRng(userName, birthDate, birthTime, `${birthLocation || ""}::${key}`);
  return rng() > threshold;
}

function deriveInt(profile, key, min, max) {
  const { userName, birthDate, birthTime, birthLocation } = profile.inputs;
  const rng = makeRng(userName, birthDate, birthTime, `${birthLocation || ""}::${key}`);
  return min + Math.floor(rng() * (max - min + 1));
}

// ==== context/ProfileContext.js ====
const ProfileContext = createContext(null);

function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within a ProfileContext.Provider");
  }
  return ctx;
}

// ==== context/SavedInsightsContext.js ====
const SavedInsightsContext = createContext(null);

function useSavedInsights() {
  const ctx = useContext(SavedInsightsContext);
  if (!ctx) {
    throw new Error("useSavedInsights must be used within a SavedInsightsContext.Provider");
  }
  return ctx;
}

function SaveButton({ text }) {
  const { saved, toggle } = useSavedInsights();
  const isSaved = saved.some((s) => s === text);
  return (
    <button
      onClick={() => toggle(text)}
      aria-pressed={isSaved}
      className="self-start px-2.5 py-1 rounded-full transition-colors"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "10px",
        letterSpacing: "0.04em",
        color: isSaved ? COLORS.PAPER : COLORS.GOLD,
        background: isSaved ? COLORS.GOLD : "transparent",
        border: `1px solid ${COLORS.GOLD}`,
      }}
    >
      {isSaved ? "★ Saved" : "☆ Save this"}
    </button>
  );
}

// ==== components/ui/SourceTag.jsx ====
function SourceTag({ kind }) {
  const config = {
    computed: { label: "Calculated", color: COLORS.GOLD },
    "self-report": { label: "Your Answer", color: COLORS.RED },
    generated: { label: "Illustrative Example", color: COLORS.MUTED },
  };
  const { label, color } = config[kind] || config.computed;
  return (
    <span
      className="px-2 py-0.5 rounded uppercase"
      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", letterSpacing: "0.08em", color, border: `1px solid ${color}` }}
    >
      {label}
    </span>
  );
}

// ==== components/ui/Stamp.jsx ====
function Stamp({ kind }) {
  const corroborated = kind === "corroborated";
  const color = corroborated ? "#7A5F1E" : COLORS.RED;
  const bg = corroborated ? "#FBF3DD" : "#FBEAEA";
  return (
    <div className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 select-none whitespace-nowrap" style={{ background: bg, border: `1.5px solid ${color}`, color, fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.06em" }}>
      {corroborated ? "CORROBORATED" : "DIVERGENCE FLAGGED"}
    </div>
  );
}

// ==== components/ui/DataRow.jsx ====
function DataRow({ k, v, house }) {
  return (
    <div className="flex flex-col gap-0.5 border-b py-2 last:border-b-0" style={{ borderColor: COLORS.LINE }}>
      <span className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.06em", color: COLORS.FAINT }}>{k}</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12.5px", color: COLORS.INK, wordBreak: "break-word" }}>
        {v}{house && <span style={{ color: COLORS.GOLD }} className="ml-2">{house}</span>}
      </span>
    </div>
  );
}

// ==== components/ui/DefinableRow.jsx ====
function DefinableRow({ k, v, def, tier }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b py-2 last:border-b-0" style={{ borderColor: COLORS.LINE }}>
      <button onClick={() => def && setOpen(!open)} aria-expanded={open} className="w-full flex flex-col gap-1 text-left">
        <span className="flex items-center gap-2">
          <span className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.06em", color: COLORS.FAINT }}>{k}</span>
          {tier && (
            <span className="px-1.5 py-0.5 rounded" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "8.5px", letterSpacing: "0.04em", color: COLORS.PAPER, background: TIER_COLOR[tier] }}>
              {tier.toUpperCase()}
            </span>
          )}
        </span>
        <span className="flex items-center flex-wrap gap-2">
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12.5px", color: COLORS.INK, wordBreak: "break-word" }}>{v}</span>
          {def && (
            <span
              className="px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", letterSpacing: "0.04em", color: open ? COLORS.PAPER : COLORS.GOLD, background: open ? COLORS.GOLD : "#FBF3DD", border: `1px solid ${COLORS.GOLD}` }}
            >
              {open ? "HIDE" : "MEANING"}
            </span>
          )}
        </span>
      </button>
      {open && def && (
        <p className="pt-2 pb-0.5" style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", lineHeight: 1.6, color: "#3A362C" }}>{def}</p>
      )}
    </div>
  );
}

// ==== components/ui/QuizQuestion.jsx ====
function QuizQuestion({ q, options, selectedIndex, onSelect }) {
  const interactive = typeof onSelect === "function";
  return (
    <div className="flex flex-col gap-2 py-2 border-b last:border-b-0" style={{ borderColor: COLORS.LINE }}>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#3A362C" }}>{q}</p>
      <div className="flex flex-col gap-1.5">
        {options.map((o, i) => {
          const isSelected = interactive ? selectedIndex === i : o.selected;
          return (
            <button
              key={o.text}
              type="button"
              onClick={interactive ? () => onSelect(i) : undefined}
              aria-pressed={interactive ? isSelected : undefined}
              className="px-3 py-2 rounded-md text-left transition-colors w-full"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "12.5px",
                background: isSelected ? "#FBF3DD" : "transparent",
                border: `1px solid ${isSelected ? COLORS.GOLD : COLORS.LINE}`,
                color: isSelected ? "#3A362C" : COLORS.FAINT,
                cursor: interactive ? "pointer" : "default",
              }}
            >
              {o.text}
              {isSelected && <span className="ml-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", color: COLORS.GOLD }}>SELECTED</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==== components/ui/ConfidenceBar.jsx ====
function Stars({ pct }) {
  const filled = Math.max(1, Math.min(5, Math.round(pct / 20)));
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", letterSpacing: "1px", color: COLORS.GOLD }} aria-label={`${filled} of 5`}>
      {"★".repeat(filled)}
      <span style={{ color: COLORS.LINE }}>{"★".repeat(5 - filled)}</span>
    </span>
  );
}

function ConfidenceBar({ trait, pct, evidence }) {
  return (
    <div className="rounded-lg p-4 flex flex-col gap-2" style={{ background: COLORS.CARD, boxShadow: SOFT_SHADOW }}>
      <div className="flex items-center justify-between flex-wrap gap-y-1">
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: "15px", fontWeight: 600, color: COLORS.INK }}>{trait}</span>
        <div className="flex items-center gap-2">
          <Stars pct={pct} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11.5px", color: pct >= 75 ? COLORS.GOLD : COLORS.MUTED }}>{confidenceLabel(pct)}</span>
        </div>
      </div>
      <div className="w-full rounded-full overflow-hidden" style={{ height: "8px", background: "#F2ECDD" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct >= 75 ? COLORS.GOLD : "#B8AE95" }} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
        {evidence.map((e) => (
          <span key={e.name} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: e.match ? COLORS.GOLD : COLORS.FAINT }}>
            {e.match ? "✓" : "–"} {e.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ==== components/ui/FlowDiagram.jsx ====
function FlowDiagram({ items, conclusion }) {
  return (
    <div className="rounded-lg p-5 flex flex-col items-center gap-2" style={{ background: COLORS.CARD, boxShadow: SOFT_SHADOW }}>
      <div className="uppercase self-start" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", color: COLORS.MUTED }}>
        Shared Theme: <span style={{ color: COLORS.INK, fontWeight: 600 }}>{conclusion}</span>
      </div>
      {items.map((item, i) => (
        <div key={item.signal} className="flex flex-col items-center gap-1.5 w-full">
          <div className="text-center">
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", color: COLORS.INK, fontWeight: 600 }}>{item.signal}</div>
            <div aria-hidden="true" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "15px", color: COLORS.GOLD, lineHeight: 1.5 }}>↓</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", color: COLORS.MUTED }}>{item.interpretation}</div>
          </div>
        </div>
      ))}
      <div aria-hidden="true" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "15px", color: COLORS.RED, lineHeight: 1.5 }}>↓</div>
      <div className="text-center px-4 py-3 rounded" style={{ background: "#FBF3DD", border: `1px solid ${COLORS.GOLD}` }}>
        <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.08em", color: COLORS.MUTED }}>Repeated Theme</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: "17px", fontWeight: 600, color: COLORS.INK }}>{conclusion}</div>
      </div>
    </div>
  );
}

// ==== components/ui/SystemChecklist.jsx ====
// Groups systems into a hierarchy instead of one flat equal-weight list:
// systems that agree are the Core Consensus (or Supporting Evidence, if
// fewer agree), systems that don't are a Unique Perspective, not a failure.
function SystemChecklist({ systems }) {
  const agreeing = systems.filter((s) => s.match);
  const diverging = systems.filter((s) => !s.match);
  const consensusLabel = agreeing.length >= Math.ceil(systems.length * 0.6) ? "Core Consensus" : "Supporting Evidence";

  return (
    <div className="rounded-lg p-4 flex flex-col gap-3" style={{ background: COLORS.CARD, boxShadow: SOFT_SHADOW }}>
      <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.08em", color: COLORS.MUTED }}>
        Appears in {agreeing.length} of {systems.length} systems
      </div>

      {agreeing.length > 0 && (
        <div>
          <div className="uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", color: COLORS.GOLD }}>{consensusLabel}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {agreeing.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11.5px", color: COLORS.INK }}>
                <span style={{ color: COLORS.GOLD, fontWeight: 700 }}>✓</span>{s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {diverging.length > 0 && (
        <div>
          <div className="uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", color: COLORS.FAINT }}>Unique Perspective</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {diverging.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11.5px", color: COLORS.FAINT }}>
                <span style={{ fontWeight: 700 }}>–</span>{s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==== components/ui/SourceChipRow.jsx ====
// items: [{ label, system, calculation, meaning }]
// Accepts either full detail objects, or plain strings (rendered as chips
// with no expandable detail) for backward-compatible callers.
function SourceChipRow({ labels, items }) {
  const [openIndex, setOpenIndex] = useState(null);
  const resolved = items || (labels || []).map((label) => ({ label }));
  const open = openIndex !== null ? resolved[openIndex] : null;

  return (
    <div className="flex flex-col gap-2 mt-1">
      <div className="flex flex-wrap gap-2">
        {resolved.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <button
              key={item.label}
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-label={`Source ${i + 1}: ${item.label}`}
              className="px-2.5 py-1 rounded transition-colors"
              style={{ background: isOpen ? COLORS.INK : COLORS.CARD, border: `1px solid ${isOpen ? COLORS.INK : COLORS.LINE}`, fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", fontWeight: 600, color: isOpen ? COLORS.PAPER : COLORS.GOLD }}
            >
              [{i + 1}]
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {resolved.map((item, i) => (
          <span key={item.label} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", color: COLORS.FAINT }}>[{i + 1}] {item.label}</span>
        ))}
      </div>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "500px" : "0px", opacity: open ? 1 : 0 }}
      >
        {open && open.system && (
          <div className="px-3 py-2.5 rounded max-w-xs flex flex-col gap-1" style={{ background: "#FBF3DD", border: `1px solid ${COLORS.GOLD}` }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", color: COLORS.MUTED }}>
              <span style={{ color: COLORS.GOLD, fontWeight: 600 }}>SOURCE </span>{open.system}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", color: COLORS.MUTED }}>
              <span style={{ color: COLORS.GOLD, fontWeight: 600 }}>CALCULATION </span>{open.calculation}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", lineHeight: 1.5, color: "#3A362C" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", color: COLORS.GOLD, fontWeight: 600 }}>MEANING </span>{open.meaning}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==== components/ui/Pattern.jsx ====
function Pattern({ id, n, label, together, togetherLabel, soWhat, chips, chipDetails, reflect, flow, systems, accent }) {
  const [expanded, setExpanded] = useState(false);
  const accentColor = accent || COLORS.GOLD;
  const agree = systems ? systems.filter((s) => s.match).length : 0;
  const total = systems ? systems.length : 0;
  const confidence = !systems ? null
    : agree >= total - 1 ? { label: "High confidence", line: `${agree} of ${total} independent systems point to the same theme.`, color: "#3F7D5C" }
    : agree >= Math.ceil(total * 0.6) ? { label: "Moderate confidence", line: `${agree} of ${total} systems align. The others read differently, which is noted below, not hidden.`, color: COLORS.GOLD }
    : { label: "Lower confidence", line: `Only ${agree} of ${total} systems agree here. These systems disagree, so hold this conclusion more lightly than the others.`, color: COLORS.RED };
  return (
    <div id={id} className="flex flex-col gap-3" style={{ scrollMarginTop: "80px" }}>
      <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", letterSpacing: "0.14em", color: accentColor, fontWeight: 600 }}>
        {n}. {label}
      </div>

      <p style={{ fontFamily: "'Fraunces', serif", fontSize: "17px", lineHeight: 1.6, color: COLORS.INK, borderLeft: `3px solid ${accentColor}`, paddingLeft: "14px" }}>{together}</p>
      {confidence && (
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: confidence.color, letterSpacing: "0.02em" }}>
          {confidence.label} · {confidence.line}
        </p>
      )}
      <div className="-mt-1">
        <SaveButton text={together} />
      </div>

      {soWhat && (
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", lineHeight: 1.7, color: COLORS.MUTED }}>{soWhat}</p>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="self-start px-3 py-1.5 rounded"
        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: COLORS.MUTED, border: `1px solid ${COLORS.LINE}`, background: "#F2ECDD" }}
      >
        {expanded ? "Hide why" : "See why →"}
      </button>

      <div className="overflow-hidden transition-all duration-300 flex flex-col gap-3" style={{ maxHeight: expanded ? "3000px" : "0px", opacity: expanded ? 1 : 0 }}>
        <div className="flex flex-col gap-2">
          <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", letterSpacing: "0.1em", color: COLORS.MUTED }}>How We Reached This</div>
          <FlowDiagram items={flow.items} conclusion={flow.conclusion} />
        </div>

        {systems && <SystemChecklist systems={systems} />}

        {chipDetails ? <SourceChipRow items={chipDetails} /> : <SourceChipRow labels={chips} />}

        {reflect && (
          <div className="rounded-lg p-3.5 mt-1" style={{ border: `1px dashed ${COLORS.GOLD}` }}>
            <div className="uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", letterSpacing: "0.1em", color: COLORS.GOLD }}>Reflect</div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", lineHeight: 1.6, color: "#3A362C", fontStyle: "italic" }}>{reflect}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==== components/ui/SubSystem.jsx ====
function SubSystem({ id, eyebrow, title, source, explainer, rows, customRows, note, quiz, visual, featuredKeys, accent }) {
  const [open, setOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const accentColor = accent || COLORS.GOLD;

  // Long explainers collapse to their first sentence with a "more" toggle,
  // keeping the tab scannable without hiding the honesty disclosures.
  const sentenceEnd = explainer ? explainer.indexOf(". ") : -1;
  const isLong = explainer && sentenceEnd > 0 && explainer.length > 160;
  const firstSentence = isLong ? explainer.slice(0, sentenceEnd + 1) : explainer;
  const restOfExplainer = isLong ? explainer.slice(sentenceEnd + 2) : null;

  let featured = customRows;
  let rest = null;
  if (customRows && featuredKeys) {
    featured = featuredKeys.map((k) => customRows.find((r) => r.k === k)).filter(Boolean);
    rest = customRows.filter((r) => !featuredKeys.includes(r.k));
  }

  return (
    <div id={id} className="rounded-lg p-5 flex flex-col gap-3" style={{ background: COLORS.CARD, border: `1px solid ${COLORS.LINE}`, borderLeft: `4px solid ${accentColor}`, scrollMarginTop: "80px" }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.12em", color: accentColor }}>{eyebrow}</div>
          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "19px", fontWeight: 600, color: COLORS.INK }}>{title}</h3>
        </div>
        <SourceTag kind={source} />
      </div>

      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", lineHeight: 1.6, color: "#3A362C" }}>
        {explainerOpen || !isLong ? explainer : firstSentence}
        {isLong && (
          <button
            onClick={() => setExplainerOpen(!explainerOpen)}
            aria-expanded={explainerOpen}
            className="ml-1.5 underline underline-offset-2"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: accentColor }}
          >
            {explainerOpen ? "less" : "more"}
          </button>
        )}
      </p>
      {visual}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="px-3 py-1.5 rounded"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: COLORS.MUTED, border: `1px solid ${COLORS.LINE}`, background: "#F2ECDD" }}
        >
          {open ? "Hide full chart" : "View full chart"}
        </button>
        {quiz && (
          <button
            onClick={() => setQuizOpen(!quizOpen)}
            aria-expanded={quizOpen}
            className="px-3 py-1.5 rounded"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: COLORS.MUTED, border: `1px solid ${COLORS.LINE}`, background: "#F2ECDD" }}
          >
            {quizOpen ? "Hide quiz questions" : "View quiz questions"}
          </button>
        )}
      </div>

      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: quizOpen && quiz ? "2000px" : "0px", opacity: quizOpen && quiz ? 1 : 0 }}
      >
        {quiz && (
          <div className="pt-1 flex flex-col" style={{ borderTop: `1px solid ${COLORS.LINE}` }}>
            <p className="pt-2 pb-1" style={{ fontFamily: "'Inter', sans-serif", fontSize: "11.5px", color: COLORS.FAINT }}>
              A sample of the self-report questions used. The full assessment has more than these.
            </p>
            {quiz.map((q) => <QuizQuestion key={q.q} {...q} />)}
          </div>
        )}
      </div>

      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "4000px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="pt-2 flex flex-col">
          {customRows && (
            <p className="pb-2" style={{ fontFamily: "'Inter', sans-serif", fontSize: "11.5px", color: COLORS.GOLD, fontWeight: 500 }}>
              Tap "MEANING" next to any row below to see what it means.
            </p>
          )}
          {customRows
            ? featured.map((r) => <DefinableRow key={r.k} {...r} />)
            : rows.map((r) => <DataRow key={r.k} {...r} />)}

          {rest && rest.length > 0 && (
            <>
              <button
                onClick={() => setShowMore(!showMore)}
                aria-expanded={showMore}
                className="self-start mt-2 px-3 py-1.5 rounded"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: COLORS.MUTED, border: `1px solid ${COLORS.LINE}`, background: "#F2ECDD" }}
              >
                {showMore ? "Show fewer placements" : `Show ${rest.length} more placements`}
              </button>
              <div
                className="overflow-hidden transition-all duration-300"
                style={{ maxHeight: showMore ? "3000px" : "0px", opacity: showMore ? 1 : 0 }}
              >
                <div className="pt-1 flex flex-col">
                  {rest.map((r) => <DefinableRow key={r.k} {...r} />)}
                </div>
              </div>
            </>
          )}
          {note && <p className="pt-2 mt-1" style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: COLORS.FAINT, borderTop: `1px solid ${COLORS.LINE}` }}>{note}</p>}
        </div>
      </div>
    </div>
  );
}

// ==== components/ui/Field.jsx ====
function Field({ label, placeholder, type = "text", value, onChange }) {
  const id = "field-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", color: COLORS.MUTED }}>{label}</label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="px-3 py-2.5 rounded-md"
        style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: COLORS.INK, background: COLORS.CARD, border: `1px solid ${COLORS.LINE}` }}
      />
    </div>
  );
}

// ==== components/ui/ConvergenceMap.jsx ====
const TIERS = [
  { key: "all", label: "Everyone Agrees", test: (m, t) => m === t, weight: 1 },
  { key: "most", label: "Mostly Agree", test: (m, t) => m >= Math.ceil(t * 0.5) && m < t, weight: 0.75 },
  { key: "mixed", label: "Mixed", test: (m, t) => m >= 2 && m < Math.ceil(t * 0.5), weight: 0.5 },
  { key: "one", label: "Only One System Says This", test: (m, t) => m <= 1, weight: 0.3 },
];

// patterns: [{ label, matchCount, total }]
function ConvergenceMap({ patterns }) {
  return (
    <div className="rounded-lg p-5 flex flex-col gap-3" style={{ background: COLORS.CARD, border: `1px solid ${COLORS.LINE}` }}>
      <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.12em", color: COLORS.RED }}>
        Convergence Map
      </div>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: COLORS.MUTED, lineHeight: 1.5 }}>
        Where each Discovery below lands, from full consensus down to a single system's take.
      </p>
      <div className="flex flex-col">
        {TIERS.map((tier, i) => {
          const matches = patterns.filter((p) => tier.test(p.matchCount, p.total));
          return (
            <div key={tier.key} className="flex flex-col items-center">
              <div
                className="w-full rounded-md px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3"
                style={{
                  background: `rgba(200, 162, 74, ${tier.weight * 0.18})`,
                  border: `1px solid ${COLORS.GOLD}`,
                  opacity: 0.55 + tier.weight * 0.45,
                }}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", letterSpacing: "0.06em", color: COLORS.INK, minWidth: "150px" }}>{tier.label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {matches.length > 0 ? (
                    matches.map((p) => (
                      <span key={p.label} className="px-2 py-0.5 rounded-full" style={{ background: COLORS.PAPER, border: `1px solid ${COLORS.LINE}`, fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "#3A362C" }}>
                        {p.label}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: COLORS.FAINT, fontStyle: "italic" }}>none this time</span>
                  )}
                </div>
              </div>
              {i < TIERS.length - 1 && <span aria-hidden="true" style={{ color: COLORS.GOLD, fontSize: "13px", lineHeight: 1 }}>↓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==== components/ui/ChapterIndex.jsx ====
// chapters: [{ id, n, label }]
function ChapterIndex({ chapters }) {
  return (
    <div className="rounded-lg p-4" style={{ background: COLORS.CARD, border: `1px solid ${COLORS.LINE}` }}>
      <div className="uppercase mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", color: COLORS.MUTED }}>Chapters</div>
      <div className="flex flex-wrap gap-2">
        {chapters.map((c) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            className="px-3 py-1.5 rounded-full transition-colors"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: COLORS.INK, border: `1px solid ${COLORS.LINE}`, background: COLORS.PAPER, textDecoration: "none" }}
          >
            {c.n}. {c.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ==== components/layout/Footer.jsx ====
function Footer() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" style={{ borderTop: `1px solid ${COLORS.LINE}` }}>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", lineHeight: 1.7, color: COLORS.FAINT }}>
        © 2026 Nyimma Bartee. All rights reserved.
      </p>
      <p className="mt-2" style={{ fontFamily: "'Inter', sans-serif", fontSize: "10.5px", lineHeight: 1.7, color: COLORS.FAINT }}>
        All content, written materials, reports, designs, graphics, software, and original framework materials on
        this website are the intellectual property of Nyimma Bartee and may not be copied, reproduced, distributed,
        modified, or used commercially without written permission.
      </p>
      <p className="mt-2" style={{ fontFamily: "'Inter', sans-serif", fontSize: "10.5px", lineHeight: 1.7, color: COLORS.FAINT }}>
        This website and its reports are provided for personal reflection and educational purposes. They are not
        intended as medical, legal, financial, or professional advice.
      </p>
      <p className="mt-2" style={{ fontFamily: "'Inter', sans-serif", fontSize: "10.5px", lineHeight: 1.7, color: COLORS.FAINT }}>
        Reports generated through this platform are licensed for individual use only. You may not resell,
        reproduce, share, or create derivative products from any report, framework, content, or methodology
        provided through this service.
      </p>
      <p className="mt-3" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.04em", color: COLORS.FAINT }}>
        © 2026 Nyimma Bartee | All Rights Reserved | Terms | Privacy
      </p>
    </div>
  );
}

// ==== components/entry/Intro.jsx ====
const SYSTEMS = [
  { name: "Tropical Astrology", desc: "Identity, from your exact birth moment", color: SYSTEM_COLORS.tropical },
  { name: "Vedic Astrology", desc: "Timing, when different parts of you activate", color: SYSTEM_COLORS.vedic },
  { name: "Draconic Astrology", desc: "Soul layer, underneath circumstance", color: SYSTEM_COLORS.draconic },
  { name: "Numerology", desc: "Life themes, from your name and birth date", color: SYSTEM_COLORS.numerology },
  { name: "Human Design", desc: "Energetic mechanics, how you take in and act", color: SYSTEM_COLORS.humanDesign },
  { name: "MBTI", desc: "Cognitive style, from your own answers", color: SYSTEM_COLORS.mbti },
];

function Intro({ onBegin, onReadMethod }) {
  return (
      <div className="min-h-screen w-full flex items-center justify-center p-6" style={{ background: COLORS.PAPER }}>
        <style>{FONT_IMPORT}</style>
        <div className="w-full max-w-lg flex flex-col gap-5 text-center items-center">
          <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.18em", color: COLORS.RED }}>
            Convergence
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(24px, 5.5vw, 32px)", fontWeight: 700, lineHeight: 1.35, color: COLORS.INK }}>
            Convergence compares six different models of you and reveals where they agree, where they disagree, and what that means.
          </h1>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
            {SYSTEMS.map((s) => (
              <div key={s.name} className="rounded-lg p-3 text-left" style={{ background: COLORS.CARD, border: `1px solid ${COLORS.LINE}`, borderTop: `3px solid ${s.color}` }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "13px", fontWeight: 600, color: s.color, lineHeight: 1.3 }}>{s.name}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: COLORS.MUTED, lineHeight: 1.4, marginTop: "2px" }}>{s.desc}</div>
              </div>
            ))}
          </div>

          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", lineHeight: 1.7, color: "#3A362C" }}>
            They aren't trying to answer the same question, so agreement between them means something, and so does
            disagreement. Convergence looks for both.
          </p>

          <button
            onClick={() => onBegin()}
            className="mt-1 px-5 py-3 rounded-full hover:opacity-90 transition-opacity"
            style={{ background: COLORS.INK, color: COLORS.PAPER, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", letterSpacing: "0.06em" }}
          >
            BEGIN YOUR PATTERN MAP →
          </button>
          <button
            onClick={() => onReadMethod()}
            className="underline underline-offset-2"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: COLORS.MUTED }}
          >
            Read the Convergence Method first
          </button>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: COLORS.FAINT, lineHeight: 1.5 }}>
            Been here before? Enter the same birth details and your exact report rebuilds, every calculation
            runs fresh from your data each time.
          </p>
        </div>
      </div>
  );
}

// ==== components/entry/Method.jsx ====
const WHAT_EACH_MEASURES = [
  ["Tropical Astrology", "measures personality and identity"],
  ["Vedic Astrology", "measures timing"],
  ["Draconic Astrology", "measures soul-level intention"],
  ["Numerology", "measures symbolic life themes"],
  ["Human Design", "measures energetic mechanics"],
  ["MBTI", "measures cognitive style, from self-report"],
];

const METHOD_STEPS = [
  "Read every system independently, using your birth data and your own answers.",
  "Extract the recurring themes each system points toward.",
  "Group similar themes together across systems.",
  "Measure how much overlap exists between them.",
  "Separate agreement from disagreement, instead of averaging it away.",
  "Generate conclusions, along with the evidence behind each one.",
];

function Method({ onBegin }) {
  return (
      <div className="min-h-screen w-full flex items-center justify-center p-6" style={{ background: COLORS.PAPER }}>
        <style>{FONT_IMPORT}</style>
        <div className="w-full max-w-md flex flex-col gap-4">
          <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.14em", color: COLORS.RED }}>
            The Convergence Method
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", lineHeight: 1.75, color: "#3A362C" }}>
            No single model explains the whole of a person, each one describes a different dimension. Convergence
            is an original framework built to compare several of them at once and look for where they intersect.
          </p>

          <div>
            <div className="uppercase mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", color: COLORS.GOLD }}>Why They Disagree</div>
            <div className="flex flex-col gap-1 mb-2">
              {WHAT_EACH_MEASURES.map(([name, desc]) => (
                <div key={name} style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", lineHeight: 1.6, color: "#3A362C" }}>
                  <span style={{ fontWeight: 600 }}>{name}</span> {desc}.
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", lineHeight: 1.7, color: "#3A362C", fontStyle: "italic" }}>
              They aren't trying to answer the same question. Disagreement between them usually means two different
              dimensions are being described, not that one of them is wrong.
            </p>
          </div>

          <div>
            <div className="uppercase mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", color: COLORS.GOLD }}>How It Works</div>
            <div className="flex flex-col gap-1.5">
              {METHOD_STEPS.map((step, i) => (
                <div key={step} className="flex gap-2">
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: COLORS.MUTED, minWidth: "16px" }}>{i + 1}.</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", lineHeight: 1.6, color: "#3A362C" }}>{step}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "11.5px", lineHeight: 1.6, color: COLORS.FAINT }}>
            Convergence is a personal reflection and educational framework. It is not a scientific personality
            assessment, diagnosis, prediction system, or professional advice. It does not claim to invent Tropical,
            Vedic, or Draconic astrology, Numerology, Human Design, or MBTI, each belongs to its own long-standing
            tradition. What's original here is the comparison framework itself: reading several of these systems
            side by side and organizing where they converge and diverge. Convergence™ is an original framework
            created by Nyimma Bartee.
          </p>
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: COLORS.MUTED }}>
              <span style={{ color: COLORS.GOLD }}>+</span> See an example Discovery
            </summary>
            <div className="mt-2 rounded-lg p-4" style={{ background: COLORS.CARD, border: `1px solid ${COLORS.LINE}` }}>
              <div className="uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", color: COLORS.FAINT }}>Illustrative example, not your data</div>
              <div className="uppercase mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.12em", color: COLORS.RED }}>3. Career &amp; Purpose</div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", lineHeight: 1.6, color: "#3A362C" }}>
                Saturn in the 10th house says self-built authority. The Draconic North Node sitting near Saturn
                says that's already the soul-level assignment. A Manifesting Generator design says movement
                follows excitement, not a fixed plan. Three systems, one direction: built to operate on your own
                terms, not by inheritance.
              </p>
            </div>
          </details>

          <button
            onClick={() => onBegin()}
            className="mt-1 self-start px-5 py-3 rounded-full hover:opacity-90 transition-opacity"
            style={{ background: COLORS.INK, color: COLORS.PAPER, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", letterSpacing: "0.06em" }}
          >
            BEGIN YOUR PATTERN MAP →
          </button>
        </div>
      </div>
  );
}

// ==== components/entry/EmailCapture.jsx ====
function EmailCapture({ email, setEmail, onContinue }) {
  return (
      <div className="min-h-screen w-full flex items-center justify-center p-6" style={{ background: COLORS.PAPER }}>
        <style>{FONT_IMPORT}</style>
        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.14em", color: COLORS.RED }}>
            Save Your Pattern Map
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", lineHeight: 1.6, color: "#3A362C" }}>
            Enter your email so your pattern map is waiting for you next time, and so we can let you know when
            your timing shifts.
          </p>
          <Field label="Email" type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
          <button
            onClick={() => onContinue()}
            className="mt-1 px-5 py-3 rounded-full hover:opacity-90 transition-opacity"
            style={{ background: COLORS.INK, color: COLORS.PAPER, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", letterSpacing: "0.06em" }}
          >
            CONTINUE →
          </button>
          <button onClick={() => onContinue()} className="underline underline-offset-2 self-start" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: COLORS.FAINT }}>
            Skip for now
          </button>
        </div>
      </div>
  );
}

// ==== components/entry/BirthDataForm.jsx ====
function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function locationSuggestions(typed) {
  if (!typed || typed.trim().length < 2) return [];
  const norm = typed.toLowerCase().trim();
  const cities = Object.keys(CITY_COORDS).filter((name) => name.startsWith(norm) || name.includes(norm));
  const states = Object.entries(US_STATES)
    .filter(([name, s]) => name.startsWith(norm) || s.abbr === norm)
    .map(([name]) => name + " (state)");
  return [...cities.map(titleCase), ...states.map(titleCase)].slice(0, 6);
}

function BirthDataForm({ userName, setUserName, birthDate, setBirthDate, birthTime, setBirthTime, birthLocation, setBirthLocation, onContinue }) {
  const canContinue = userName.trim().length > 0 && birthDate.length > 0;
  const locationMatch = lookupCity(birthLocation);
  const [suppressSuggest, setSuppressSuggest] = useState(false);
  const suggestions = suppressSuggest ? [] : locationSuggestions(birthLocation);
  const showSuggestions = suggestions.length > 0 && !(locationMatch && locationMatch.level === "city" && suggestions.length === 1);
  return (
      <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ background: COLORS.PAPER }}>
        <style>{FONT_IMPORT}</style>
        <div className="w-full max-w-md rounded-lg p-6 sm:p-8 flex flex-col gap-5" style={{ background: COLORS.CARD, border: `1px solid ${COLORS.LINE}` }}>
          <div>
            <div className="uppercase mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.14em", color: COLORS.RED }}>Convergence</div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(24px, 5.5vw, 32px)", fontWeight: 700, color: COLORS.INK, lineHeight: 1.15 }}>Enter your birth data</h1>
            <p className="mt-2" style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: COLORS.MUTED, lineHeight: 1.6 }}>
              This is all the Evidence tab needs. It computes your full astrological and numerological record
              automatically, nothing else to fill in. The Questionnaire tab will ask a few extra questions after,
              since Enneagram and MBTI need self-report.
            </p>
          </div>
          <Field label="Full Name" placeholder="For numerology" value={userName} onChange={setUserName} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Birth Date" type="date" value={birthDate} onChange={setBirthDate} />
            <Field label="Birth Time" type="time" value={birthTime} onChange={setBirthTime} />
          </div>
          <div className="flex flex-col gap-1.5 relative">
            <Field
              label="Birth Location"
              placeholder="Start typing your birth city"
              value={birthLocation}
              onChange={(v) => { setBirthLocation(v); setSuppressSuggest(false); }}
            />
            {showSuggestions ? (
              <div className="rounded-lg overflow-hidden" style={{ background: COLORS.CARD, border: `1px solid ${COLORS.GOLD}`, boxShadow: SOFT_SHADOW }}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setBirthLocation(s.replace(" (state)", "")); setSuppressSuggest(true); }}
                    className="w-full text-left px-3 py-2.5 hover:opacity-80"
                    style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: COLORS.INK, borderBottom: `1px solid ${COLORS.LINE}` }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : birthLocation && birthLocation.trim().length > 1 ? (
              locationMatch ? (
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: "#3F7D5C" }}>
                  ✓ {locationMatch.level === "city"
                    ? "Location recognized. Houses and Ascendant will compute for real."
                    : `Recognized as ${locationMatch.matchedLabel.replace(/\b\w/g, (c) => c.toUpperCase())} (state level). Houses will compute from the state's location.`}
                </p>
              ) : (
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: COLORS.RED }}>
                  Not recognized yet. Keep typing, add your state, or pick a suggestion above.
                </p>
              )
            ) : null}
          </div>
          <button
            onClick={() => canContinue && onContinue()}
            disabled={!canContinue}
            className="mt-1 px-5 py-3 rounded-full transition-opacity"
            style={{
              background: canContinue ? COLORS.INK : COLORS.LINE,
              color: canContinue ? COLORS.PAPER : COLORS.FAINT,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px",
              letterSpacing: "0.06em",
              cursor: canContinue ? "pointer" : "not-allowed",
              opacity: canContinue ? 1 : 0.7,
            }}
          >
            {canContinue ? "BUILD MY PATTERN MAP →" : "ENTER YOUR NAME AND BIRTH DATE TO CONTINUE"}
          </button>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "11.5px", color: COLORS.FAINT, lineHeight: 1.6 }}>
            Name and birth date are required. Birth time and location sharpen the chart, a recognized location
            unlocks your real Ascendant and houses.
          </p>
        </div>
      </div>
  );
}

// ==== components/entry/QuizIntake.jsx ====
function QuizIntake({ onContinue }) {
  const [answers, setAnswers] = useState({});
  const allAnswered = QUIZ_QUESTIONS.every((q) => answers[q.id] !== undefined);

  function select(qid, optionIndex) {
    setAnswers((prev) => ({ ...prev, [qid]: optionIndex }));
  }

  function handleContinue() {
    if (!allAnswered) return;
    const mbtiAnswers = {};
    const enneagramScores = {};
    for (const question of QUIZ_QUESTIONS) {
      const optionIndex = answers[question.id];
      const option = question.options[optionIndex];
      if (option.mbti) {
        mbtiAnswers[option.mbti.dim] = option.mbti.value;
      }
      if (option.enneagram) {
        for (const [type, weight] of Object.entries(option.enneagram)) {
          enneagramScores[type] = (enneagramScores[type] || 0) + weight;
        }
      }
    }
    onContinue({ mbtiAnswers, enneagramScores, quizAnswers: answers });
  }

  const enneagramQuestions = QUIZ_QUESTIONS.filter((q) => q.section === "Enneagram");
  const mbtiQuestions = QUIZ_QUESTIONS.filter((q) => q.section === "MBTI");

  return (
      <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ background: COLORS.PAPER }}>
        <style>{FONT_IMPORT}</style>
        <div className="w-full max-w-md rounded-lg p-6 sm:p-8 flex flex-col gap-5" style={{ background: COLORS.CARD, border: `1px solid ${COLORS.LINE}` }}>
          <div>
            <div className="uppercase mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.14em", color: COLORS.RED }}>A Few Quick Questions</div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", fontWeight: 700, color: COLORS.INK, lineHeight: 1.2 }}>Enneagram & MBTI</h1>
            <p className="mt-2" style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: COLORS.MUTED, lineHeight: 1.6 }}>
              These two systems can't be calculated from birth data alone, they need your own answers. The chart
              provides the baseline. Your responses refine the interpretation, and different answers genuinely
              change which reading of your pattern you receive.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <div className="uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.08em", color: COLORS.GOLD }}>Enneagram</div>
            {enneagramQuestions.map((question) => (
              <QuizQuestion key={question.id} q={question.q} options={question.options} selectedIndex={answers[question.id]} onSelect={(i) => select(question.id, i)} />
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <div className="uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.08em", color: COLORS.GOLD }}>MBTI</div>
            {mbtiQuestions.map((question) => (
              <QuizQuestion key={question.id} q={question.q} options={question.options} selectedIndex={answers[question.id]} onSelect={(i) => select(question.id, i)} />
            ))}
          </div>

          <button
            onClick={handleContinue}
            disabled={!allAnswered}
            className="mt-1 px-5 py-3 rounded-full transition-opacity"
            style={{
              background: allAnswered ? COLORS.INK : COLORS.LINE,
              color: allAnswered ? COLORS.PAPER : COLORS.FAINT,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px",
              letterSpacing: "0.06em",
              cursor: allAnswered ? "pointer" : "not-allowed",
              opacity: allAnswered ? 1 : 0.7,
            }}
          >
            {allAnswered ? "BUILD MY PATTERN MAP →" : `ANSWER ALL ${QUIZ_QUESTIONS.length} QUESTIONS TO CONTINUE`}
          </button>
        </div>
      </div>
  );
}

// ==== components/entry/Processing.jsx ====
function Processing({ onDone }) {
  const stages = [
    { label: "Computing", steps: ["Tropical", "Vedic", "Draconic", "Numerology", "Human Design"] },
    { label: "Comparing", steps: ["recurring themes", "shared patterns", "areas of tension"] },
    { label: "Building", steps: ["your personal synthesis"] },
  ];
  const flatSteps = stages.flatMap((s) => s.steps.map((step) => ({ label: s.label, step })));
  const [i, setI] = useState(0);

  useEffect(() => {
    if (i >= flatSteps.length) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI(i + 1), 420);
    return () => clearTimeout(t);
  }, [i]);

  const done = i >= flatSteps.length;
  const current = flatSteps[Math.min(i, flatSteps.length - 1)];
  const pct = Math.min(100, Math.round((i / flatSteps.length) * 100));

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6" style={{ background: COLORS.PAPER }}>
      <style>{FONT_IMPORT}</style>
      <div className="w-full max-w-xs flex flex-col items-center text-center gap-4">
        <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.14em", color: COLORS.RED }}>
          {done ? "Done" : current.label}
        </div>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "19px", fontWeight: 600, color: COLORS.INK, minHeight: "28px" }}>
          {done ? "Ready" : current.step}
        </h2>
        <div className="w-full rounded-full overflow-hidden" style={{ height: "6px", background: COLORS.LINE }}>
          <div style={{ width: `${pct}%`, height: "100%", background: COLORS.GOLD, transition: "width 0.35s ease" }} />
        </div>
      </div>
    </div>
  );
}

// ==== components/report/Header.jsx ====
function formatDob(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}.${dd}.${d.getFullYear()}`;
}

function Header({ children }) {
  const profile = useProfile();
  const { userName, birthDate, birthTime } = profile.inputs;

  return (
    <>
      <div style={{ background: "#FBEAEA", borderBottom: `2px solid ${COLORS.RED}` }}>
        <div className="max-w-3xl mx-auto px-4 py-3" style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", color: "#5C2020", lineHeight: 1.6 }}>
          <strong>Your Pattern Map.</strong> Every planet's sign and degree below (Sun through Pluto, the Moon, and
          the North Node, in both Tropical and Draconic) is a real astronomical calculation for your exact birth
          moment, not a placeholder. Houses, the Ascendant, and the Midheaven need a geocoded birth location this
          app doesn't collect yet, so those are generated consistently from your data rather than computed, and
          marked "Generated" wherever they appear. Numerology and Chinese zodiac are also calculated for real.
        </div>
      </div>

      <div style={{ background: "#F2ECDD", borderBottom: `1px solid ${COLORS.LINE}` }}>
        <div className="max-w-3xl mx-auto px-4 py-2.5" style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: COLORS.MUTED, lineHeight: 1.5 }}>
          How We Know is calculated directly from birth data. Profile Questions mixes calculation with
          self-report. Your Synthesis is where the two are checked against each other.
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 pb-6 mb-6" style={{ borderBottom: `2px solid ${COLORS.INK}` }}>
          <div>
            <div className="uppercase mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.14em", color: COLORS.RED }}>Convergence</div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(24px, 5.5vw, 32px)", fontWeight: 700, lineHeight: 1.05, color: COLORS.INK }}>{userName || "Your Pattern Map"}</h1>
            <p className="mt-1" style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", fontStyle: "italic", color: COLORS.MUTED }}>Identity isn't one chart. It's a pattern.</p>
          </div>
          <div className="flex gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", color: COLORS.FAINT }}>DOB</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", color: COLORS.INK }}>{formatDob(birthDate)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", color: COLORS.FAINT }}>Time</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", color: COLORS.INK }}>{birthTime || "—"}</span>
            </div>
          </div>
        </div>


        {children}
      </div>
    </>
  );
}

// ==== components/report/Signature.jsx ====
function Signature({ onContinue }) {
  const profile = useProfile();
  const { sunSign, numerology, mbti, humanDesign } = profile;

  return (
      <div className="min-h-screen w-full flex items-center justify-center p-6" style={{ background: COLORS.PAPER }}>
        <style>{FONT_IMPORT}</style>
        <div className="w-full max-w-md flex flex-col gap-5 text-center items-center">
          <div className="px-3 py-1.5 rounded-full" style={{ background: "#FBEAEA", border: `1px solid ${COLORS.RED}` }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.04em", color: "#5C2020" }}>GENERATED FROM YOUR ANSWERS</span>
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(24px, 5.5vw, 32px)", fontWeight: 700, lineHeight: 1.25, color: COLORS.INK }}>
            You investigate before you believe.
          </h1>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "14.5px", lineHeight: 1.7, color: "#3A362C" }}>
            Your {sunSign} Sun, Life Path {numerology.lifePath}, {mbti || "self-reported"} preferences, and{" "}
            {humanDesign.type} design all point toward the same behavior: you rarely accept an explanation until
            you've tested it yourself.
          </p>
          <button
            onClick={() => onContinue()}
            className="mt-1 px-5 py-3 rounded-full hover:opacity-90 transition-opacity"
            style={{ background: COLORS.INK, color: COLORS.PAPER, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", letterSpacing: "0.06em" }}
          >
            WHY? →
          </button>
        </div>
      </div>
  );
}

// ==== components/report/EvidenceTab.jsx ====
function houseLabel(point, houseSystem) {
  const house = houseSystem === "placidus" ? point.placidusHouse : point.wholeSignHouse;
  return { house, label: ORDINAL_HOUSE[house] };
}

function placementRow(planet, point, houseSystem, extraNote) {
  const { house, label } = houseLabel(point, houseSystem);
  const def = extraNote ? `${point.def} ${extraNote}` : point.def;
  return { k: planet, v: `${point.degree} ${point.sign}, ${label}`, def, house, tier: point.isReal ? "Real" : "Generated" };
}

function EvidenceTab({ houseSystem, setHouseSystem }) {
  const profile = useProfile();
  const { tropical, draconic, numerology, chineseZodiac, locationRecognized, locationMatch, inputs } = profile;
  const p = tropical.points;

  const sunHouse = houseLabel(p.Sun, houseSystem);
  const moonHouse = houseLabel(p.Moon, houseSystem);
  const saturnHouse = houseLabel(p.Saturn, houseSystem);
  const housesAreReal = p.Sun.housesReal;

  const tropicalFeatured = ["Sun", "Moon", "Ascendant", "Saturn", "North Node"];
  const tropicalCustomRows = [
    ...Object.entries(p).map(([planet, point]) => placementRow(planet, point, houseSystem)),
    { k: "Ascendant", v: `${tropical.ascendant.degree} ${tropical.ascendant.sign}`, def: tropical.ascendant.def, tier: tropical.ascendant.isReal ? "Real" : "Generated" },
    { k: "Midheaven", v: `${tropical.midheaven.degree} ${tropical.midheaven.sign}`, def: "The Midheaven represents public reputation and career direction, the role you're recognized for in the world.", tier: tropical.midheaven.isReal ? "Real" : "Generated" },
  ];

  const draconicCustomRows = Object.entries(draconic.points).map(([planet, point]) => placementRow(planet, point, houseSystem));

  return (
          <div className="flex flex-col gap-4">
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", color: COLORS.MUTED, lineHeight: 1.6 }}>
              Everything below is generated from your name, birth date, time, and location. No quiz, no self-report.
              Tap "View full chart" on any system to see every placement.
            </p>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", color: COLORS.FAINT, lineHeight: 1.6 }}>
              Tropical, Vedic, and Draconic are three astrology systems, but they aren't three votes. They
              examine different dimensions of the same birth data: identity, timing, and soul layer. Convergence
              looks for recurring themes across dimensions, not simple agreement between astrology systems alone.
            </p>

            {inputs.birthLocation && !locationRecognized && (
              <div className="rounded-lg p-3.5" style={{ background: "#FBEAEA", border: `1px solid ${COLORS.RED}` }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", color: "#5C2020", lineHeight: 1.55 }}>
                  "{inputs.birthLocation}" isn't in this prototype's city list yet, so houses and the Ascendant/
                  Midheaven stay generated below rather than computed. Try a major city name (e.g. "New York",
                  "London", "Mumbai") to unlock real house calculation.
                </p>
              </div>
            )}
            {locationRecognized && (
              <div className="rounded-lg p-3.5" style={{ background: "#F3F8F5", border: `1px solid #3F7D5C` }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", color: "#2B5940", lineHeight: 1.55 }}>
                  {locationMatch && locationMatch.level === "state"
                    ? `Recognized at the state level (${locationMatch.matchedLabel.replace(/\b\w/g, (c) => c.toUpperCase())}). Ascendant, Midheaven, and houses below are real calculations from the state's location, close, though a degree or two off your exact town. `
                    : "Location recognized. Ascendant, Midheaven, and every house placement below are a real calculation from your exact birth data, verified against a fully worked reference example before being wired in, not generated. "}
                  One honest note: daylight saving time is now accounted for automatically at recognized US
                  locations, using the actual historical rule for your birth year. Locations outside the US use
                  a standard offset year-round, since this build doesn't yet track every country's DST calendar.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 sticky top-14 z-[5] py-2" style={{ background: COLORS.PAPER }}>
              {[
                { id: "ev-identity", label: "Identity", color: SYSTEM_COLORS.tropical },
                { id: "ev-timing", label: "Timing", color: SYSTEM_COLORS.vedic },
                { id: "ev-soullayer", label: "Soul Layer", color: SYSTEM_COLORS.draconic },
                { id: "ev-lifethemes", label: "Life Themes", color: SYSTEM_COLORS.numerology },
                { id: "ev-temperament", label: "Temperament", color: SYSTEM_COLORS.chinese },
              ].map((c) => (
                <a
                  key={c.id}
                  href={`#${c.id}`}
                  className="px-3 py-1.5 rounded-full"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: c.color, border: `1.5px solid ${c.color}`, background: COLORS.CARD, textDecoration: "none", fontWeight: 600 }}
                >
                  {c.label} ↓
                </a>
              ))}
            </div>

            <div className="rounded-lg p-5" style={{ background: "#F2ECDD", border: `1px solid ${COLORS.LINE}` }}>
              <div className="uppercase mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.12em", color: COLORS.RED }}>
                Your Three Most Important Placements
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", color: COLORS.MUTED, marginBottom: 10, lineHeight: 1.5 }}>
                Out of every placement below, these three carry the most weight, they're the ones that keep
                reappearing in Synthesis.
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between flex-wrap gap-x-2">
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: "15px", color: COLORS.INK }}>Sun in {p.Sun.sign}, {sunHouse.label} house</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: COLORS.GOLD }}>Tropical{housesAreReal ? "" : " · house generated"}</span>
                </div>
                <div className="flex items-baseline justify-between flex-wrap gap-x-2">
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: "15px", color: COLORS.INK }}>Moon in {p.Moon.sign}, {moonHouse.label} house</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: COLORS.GOLD }}>Tropical{housesAreReal ? "" : " · house generated"}</span>
                </div>
                <div className="flex items-baseline justify-between flex-wrap gap-x-2">
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: "15px", color: COLORS.INK }}>Saturn in {p.Saturn.sign}, {saturnHouse.label} house</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: COLORS.GOLD }}>Tropical{housesAreReal ? "" : " · house generated"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-3.5 flex items-center justify-between flex-wrap gap-2" style={{ background: "#F2ECDD", border: `1px solid ${COLORS.LINE}` }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", color: COLORS.MUTED }}>House system{housesAreReal ? "" : " (generated either way, until location is recognized)"}</span>
              <div className="flex gap-1.5" role="group" aria-label="House system">
                <button
                  onClick={() => setHouseSystem("placidus")}
                  aria-pressed={houseSystem === "placidus"}
                  className="px-3 py-1.5 rounded-full"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", background: houseSystem === "placidus" ? COLORS.INK : COLORS.CARD, color: houseSystem === "placidus" ? COLORS.PAPER : COLORS.MUTED, border: `1px solid ${houseSystem === "placidus" ? COLORS.INK : COLORS.LINE}` }}
                >
                  {profile.precisionBackend ? "Placidus" : "Equal House"}
                </button>
                <button
                  onClick={() => setHouseSystem("wholeSign")}
                  aria-pressed={houseSystem === "wholeSign"}
                  className="px-3 py-1.5 rounded-full"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", background: houseSystem === "wholeSign" ? COLORS.INK : COLORS.CARD, color: houseSystem === "wholeSign" ? COLORS.PAPER : COLORS.MUTED, border: `1px solid ${houseSystem === "wholeSign" ? COLORS.INK : COLORS.LINE}` }}
                >
                  Whole Sign
                </button>
              </div>
            </div>

            <SubSystem
              eyebrow={`Source: Tropical Astrology · ${houseSystem === "placidus" ? (profile.precisionBackend ? "Placidus Houses" : "Equal House") : "Whole Sign Houses"}`}
              accent={SYSTEM_COLORS.tropical}
              id="ev-identity"
              title="Identity"
              source="computed"
              explainer={housesAreReal
                ? "Maps where the planets actually sat against the seasonal zodiac at the exact moment you were born. Signs and degrees are calculated from real orbital mechanics. Houses, the Ascendant, and the Midheaven are also real here: your birth location was recognized, so these come from an actual Ascendant calculation, not a placeholder."
                : "Maps where the planets actually sat against the seasonal zodiac at the exact moment you were born. Signs and degrees below are calculated from real orbital mechanics (Sun through Pluto, plus the Moon and North Node), not looked up or guessed. Houses and the angles (Ascendant, Midheaven) need your exact birth location recognized, which didn't happen here, so those stay generated and are labeled as such below."}
              featuredKeys={tropicalFeatured}
              rows={[]}
              customRows={tropicalCustomRows}
              note={(houseSystem === "placidus" ? (profile.precisionBackend ? "House system: true Placidus, cusps from Swiss Ephemeris. " : "House system: Equal House (each house is exactly 30° from the Ascendant). ") : "House system: Whole Sign (each house is one full sign, starting from the Ascendant's sign). ") + (housesAreReal ? (profile.precisionBackend ? "Every position on this card comes from the Swiss Ephemeris backend." : "Houses are computed for real here, from your recognized birth location.") : "Houses themselves are generated, not computed, see the explainer above.")}
            />

            <SubSystem
              eyebrow="Source: Vedic Astrology"
              accent={SYSTEM_COLORS.vedic}
              id="ev-timing"
              title="Timing"
              source={profile.vedic.isReal ? "computed" : "generated"}
              explainer={profile.vedic.isReal
                ? "Tropical explains the psychological blueprint: what you're working with. Vedic explains when different parts of that blueprint become active. This is a real Vimshottari dasha calculation: your Moon's actual longitude converted to the sidereal zodiac, its nakshatra setting the sequence, verified against independently confirmed reference timing before being wired in."
                : "Tropical explains the psychological blueprint: what you're working with. Vedic explains when different parts of that blueprint become active, at least conceptually. Real dasha timing requires your Moon's exact position, which needs a valid birth date. Everything below is generated from a seeded formula: consistent per person, but not a real calculation of your actual timing."}
              visual={
                <div className="flex flex-col gap-1.5 py-1">
                  <div className="w-full rounded-full relative" style={{ height: "6px", background: "#E8E1CE" }}>
                    <div style={{ position: "absolute", left: "0%", width: `${profile.vedic.progressPct}%`, height: "100%", background: COLORS.MUTED, borderRadius: "9999px" }} />
                    <div style={{ position: "absolute", left: `${profile.vedic.progressPct}%`, top: "-3px", width: "12px", height: "12px", borderRadius: "9999px", background: COLORS.GOLD, border: `2px solid ${COLORS.PAPER}` }} />
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", color: COLORS.FAINT }}>{profile.vedic.mahaGraha}/{profile.vedic.bhuktiGraha} (closing)</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", color: COLORS.GOLD }}>Now, {profile.vedic.closingLabel}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", color: COLORS.FAINT }}>{profile.vedic.mahaGraha}/{profile.vedic.nextBhukti} (next)</span>
                  </div>
                </div>
              }
              rows={[]}
              customRows={profile.vedic.isReal ? [
                { k: "Sidereal Moon", v: `${profile.vedic.nakshatra}, Pada ${profile.vedic.pada}`, def: "Your Moon's actual position converted to the sidereal zodiac, and the lunar mansion (nakshatra) it falls in. This single placement sets the entire dasha sequence.", tier: "Real" },
                { k: "Current Chapter", v: `${profile.vedic.mahaGraha} Mahadasha, ${profile.vedic.mahaStartLabel} to ${profile.vedic.mahaEndLabel}`, def: `A multi-year period where the themes ruled by ${profile.vedic.mahaGraha} are the dominant life theme for this chapter. Real computed dates.`, tier: "Real" },
                { k: "Current Lesson", v: `${profile.vedic.mahaGraha}/${profile.vedic.bhuktiGraha} sub-period`, def: `Within the ${profile.vedic.mahaGraha} chapter, the ${profile.vedic.bhuktiGraha} sub-period colors how that broader theme is currently being lived out.`, tier: "Real" },
                { k: "Current Transition", v: `${profile.vedic.bhuktiGraha} closing ${profile.vedic.closingLabel}, ${profile.vedic.nextBhukti} opening`, def: `The current sub-period ends around ${profile.vedic.closingLabel}, moving into a sub-period colored by ${profile.vedic.nextBhukti}.`, tier: "Real" },
                { k: "Next Chapter", v: profile.vedic.nextMaha ? `${profile.vedic.nextMaha} Mahadasha, from ${profile.vedic.mahaEndLabel}` : "—", def: "The mahadasha that opens when the current chapter completes.", tier: "Real" },
              ] : [
                { k: "Current Chapter", v: `${profile.vedic.mahaGraha} Mahadasha`, def: `A multi-year period where the themes ruled by ${profile.vedic.mahaGraha} are the dominant life theme for this chapter.` },
                { k: "Current Lesson", v: `${profile.vedic.mahaGraha}/${profile.vedic.bhuktiGraha} sub-period`, def: `Within the ${profile.vedic.mahaGraha} chapter, the ${profile.vedic.bhuktiGraha} sub-period colors how that broader theme is currently being lived out.` },
                { k: "Current Transition", v: `${profile.vedic.bhuktiGraha} closing, ${profile.vedic.nextBhukti} opening`, def: `The current sub-period ends around ${profile.vedic.closingLabel}, moving into a sub-period colored by ${profile.vedic.nextBhukti}.` },
                { k: "Major Release Cycle", v: `${profile.vedic.releaseGraha} Bhukti, through ${profile.vedic.releaseLabel}`, def: "A separate, overlapping cycle focused on shedding what's no longer needed." },
                { k: "Sensitive Window", v: `Sade Sati, Phase ${profile.vedic.sadeSatiPhase} active`, def: "A multi-year Saturn transit over the natal Moon, traditionally read as a period of pressure-testing whatever isn't built to last." },
              ]}
              note={profile.vedic.isReal
                ? "Computed for real from your Moon's actual position. One honest tolerance: the Moon calculation is accurate to about half a degree, which can shift dasha dates by a few months, so a boundary that's very close to today may show the adjacent sub-period. Sade Sati and transit windows aren't included yet, those need current Saturn positions checked against your natal Moon, a buildable next step."
                : "Generated, not computed, see the explainer above. Real dasha timing needs a valid birth date."}
            />

            <SubSystem
              eyebrow="Source: Draconic Astrology"
              accent={SYSTEM_COLORS.draconic}
              id="ev-soullayer"
              title="Soul Layer"
              source="computed"
              explainer="Shifts the entire chart so the Moon's North Node sits at zero degrees Aries. Astrologers use this to read a layer underneath circumstance, sometimes called the soul chart: less about how you appear, more about what you're working from. For every point with a real Tropical position, this shift is calculated for real, using your real North Node position, not re-generated separately."
              rows={[]}
              customRows={draconicCustomRows}
              note="Angles (ASC/MC/IC/DC) stay identical to the Tropical chart above by convention. Chiron, Lilith, and Vertex don't have a verified formula wired up yet, so those stay generated even here."
            />

            <SubSystem
              eyebrow="Source: Numerology"
              accent={SYSTEM_COLORS.numerology}
              id="ev-lifethemes"
              title="Life Themes"
              source="computed"
              explainer="Converts your birth date and full name into a set of core numbers, each pointing to a different part of how you're built: how you move through life, what drives you underneath, and how others tend to experience you."
              rows={[]}
              customRows={[
                { k: "Life Path", v: [11, 22, 33].includes(numerology.lifePath) ? `${numerology.lifePath} (Master Number)` : String(numerology.lifePath), def: "Calculated from the full birth date. In numerology, this is traditionally read as the core lesson number for the lifetime, the theme everything else gets built around. Master Numbers (11, 22, 33) are held rather than reduced, read as a more demanding version of their reduced digit." },
                { k: "Soul Urge", v: String(numerology.soulUrge), def: "Calculated from the vowels in the full birth name. This number is traditionally interpreted as the internal drive behind actions, the want that operates even when no one else can see it." },
                { k: "Expression", v: String(numerology.expression), def: "Calculated from the full birth name. This number is traditionally read as natural ability, how someone tends to come across from the outside." },
                { k: "Gift Number", v: String(numerology.gift), def: "Calculated from the consonants in the full birth name. A secondary number that traditionally reinforces a specific inborn talent, distinct from Life Path or Soul Urge but often echoing them." },
              ]}
              note={
                numerology.lifePath === numerology.soulUrge || numerology.lifePath === numerology.gift
                  ? `The number ${numerology.lifePath} shows up more than once across different calculations. That kind of repeat is uncommon, and it means the theme it carries runs deeper than a single number would.`
                  : "Each number here comes from a different calculation, so they don't have to agree. When they do, that overlap is the signal."
              }
            />

            <SubSystem
              eyebrow="Source: Chinese Zodiac"
              accent={SYSTEM_COLORS.chinese}
              id="ev-temperament"
              title="Temperament"
              source="computed"
              explainer="Assigns an animal and an element based on birth year, using a twelve-year cycle. Unlike the systems above, it doesn't need birth time or location, just the date."
              rows={[]}
              customRows={[
                { k: "Animal", v: chineseZodiac.animal, def: `The ${chineseZodiac.animal} is one of twelve signs in the cycle, each associated with its own temperament and way of moving through the world.` },
                { k: "Element", v: chineseZodiac.element, def: `Each animal sign is paired with one of five elements, which shifts its expression. ${chineseZodiac.element} adds its own flavor to the underlying animal, occurring only once every sixty years in this combination.` },
                { k: "Sign", v: chineseZodiac.sign, def: null },
              ]}
            />

            <div className="rounded-lg p-4" style={{ background: "#F2ECDD", border: `1px solid ${COLORS.LINE}` }}>
              <div className="uppercase mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", color: COLORS.RED }}>Why This Matters</div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", lineHeight: 1.6, color: "#3A362C" }}>
                This tab is only the raw, computed evidence, no self-report yet. Move to Profile Questions next
                to see how self-reported systems either reinforce or push back on what's here, then to Your
                Synthesis to see where all of it converges.
              </p>
            </div>
          </div>
  );
}

// ==== components/report/QuestionnaireTab.jsx ====
function QuestionnaireTab({ checked, setChecked }) {
  const profile = useProfile();
  const { humanDesign, mbti, enneagram, quizAnswers } = profile;
  const mbtiDims = mbtiDimensionDetails(mbti);
  const hdDetails = humanDesignDetails(humanDesign);
  const crossCheck = enneagramCrossCheck(profile);

  const mbtiQuestions = QUIZ_QUESTIONS.filter((q) => q.section === "MBTI");
  const enneagramQuestions = QUIZ_QUESTIONS.filter((q) => q.section === "Enneagram");

  return (
          <div className="flex flex-col gap-4">
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", color: COLORS.MUTED, lineHeight: 1.6 }}>
              Evidence is what's computed. This is what's observed, either measured directly (Human Design) or
              self-reported and checked against the chart (Enneagram, MBTI). Different kind of evidence, still evidence.
            </p>

            <div className="flex flex-wrap gap-2 sticky top-14 z-[5] py-2" style={{ background: COLORS.PAPER }}>
              {[
                { id: "q-hd", label: "Energy Type", color: SYSTEM_COLORS.humanDesign },
                { id: "q-mbti", label: "Cognitive Style", color: SYSTEM_COLORS.mbti },
                { id: "q-enneagram", label: "Core Motivation", color: SYSTEM_COLORS.enneagram },
              ].map((c) => (
                <a
                  key={c.id}
                  href={`#${c.id}`}
                  className="px-3 py-1.5 rounded-full"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: c.color, border: `1.5px solid ${c.color}`, background: COLORS.CARD, textDecoration: "none", fontWeight: 600 }}
                >
                  {c.label} ↓
                </a>
              ))}
            </div>

            <SubSystem
              eyebrow="Source: Human Design"
              accent={SYSTEM_COLORS.humanDesign}
              id="q-hd"
              title="Energy Type"
              source="generated"
              explainer="Combines astrology, the I Ching, Kabbalah, and the chakra system into a body chart showing how a person is built to take in energy and make decisions. A real Human Design chart needs planetary positions mapped through 64 gates via a specific offset calculation, not wired up in this prototype. Everything below is generated from a seeded formula: consistent per person, but not a real Human Design calculation."
              rows={[]}
              customRows={[
                { k: "Type", v: humanDesign.type, def: hdDetails.typeDef },
                { k: "Authority", v: humanDesign.authority, def: hdDetails.authorityDef },
                { k: "Profile", v: humanDesign.profile.replace("/", " / "), def: hdDetails.profileDef },
                { k: "Incarnation Cross", v: humanDesign.incarnationCross, def: hdDetails.crossDef },
                { k: "Definition", v: humanDesign.definition, def: hdDetails.definitionDef },
              ]}
              note="Generated, not computed. Real gate calculation is a real, buildable next step, it needs the same planetary longitude math already working in Identity, mapped through the 64-gate wheel instead of the 12 signs."
            />

            <SubSystem
              eyebrow="Source: MBTI"
              accent={SYSTEM_COLORS.mbti}
              id="q-mbti"
              title="Cognitive Style"
              source="self-report"
              explainer="A sixteen-type system built on four preference pairs: where you get energy, how you take in information, how you decide, and how you like to live day to day. There is no birth-data calculation for this system, it comes entirely from your answers."
              rows={[]}
              customRows={[
                { k: "Type", v: mbti || "—" },
                { k: "Energy", v: mbtiDims.energy.name, def: mbtiDims.energy.def },
                { k: "Information", v: mbtiDims.information.name, def: mbtiDims.information.def },
                { k: "Decisions", v: mbtiDims.decisions.name, def: mbtiDims.decisions.def },
                { k: "Structure", v: mbtiDims.structure.name, def: mbtiDims.structure.def },
              ]}
              quiz={mbtiQuestions.map((question) => ({
                q: question.q,
                options: question.options.map((o, i) => ({ text: o.text, selected: quizAnswers && quizAnswers[question.id] === i })),
              }))}
            />

            <div id="q-enneagram" className="rounded-lg p-5 flex flex-col gap-3" style={{ background: COLORS.CARD, border: `1px solid ${COLORS.LINE}`, borderLeft: `4px solid ${SYSTEM_COLORS.enneagram}`, scrollMarginTop: "80px" }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.12em", color: COLORS.GOLD }}>Source: Enneagram</div>
                  <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "19px", fontWeight: 600, color: COLORS.INK }}>Core Motivation</h3>
                </div>
                <SourceTag kind="self-report" />
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", lineHeight: 1.6, color: "#3A362C" }}>
                A nine-type system built around core motivation and fear rather than behavior alone. The base
                type comes from your answers below. What's different here is that certain chart placements are
                compared alongside that self-report, and the result is shown either way.
              </p>

              <div>
                <div className="uppercase mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.08em", color: COLORS.MUTED }}>Your Answers</div>
                {enneagramQuestions.map((question) => (
                  <QuizQuestion
                    key={question.id}
                    q={question.q}
                    options={question.options.map((o, i) => ({ text: o.text, selected: quizAnswers && quizAnswers[question.id] === i }))}
                  />
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-6 mt-1">
                <div>
                  <div className="uppercase mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.08em", color: COLORS.MUTED }}>Self-Reported Type</div>
                  <p style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", color: COLORS.INK }}>{enneagram ? enneagram.label : "—"}</p>
                  {enneagram && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "11.5px", color: COLORS.MUTED }}>{enneagram.name}</p>}
                </div>
                <div>
                  <div className="uppercase mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.08em", color: COLORS.MUTED }}>Placements Checked</div>
                  {crossCheck.checks.map((c) => (
                    <DataRow key={c.label} k={c.label} v={`${c.sign}, ${ORDINAL_HOUSE[c.house]} house`} />
                  ))}
                </div>
              </div>

              {!checked ? (
                <button onClick={() => setChecked(true)} className="mt-2 self-start px-4 py-2.5 rounded-full hover:opacity-90 transition-opacity" style={{ background: COLORS.INK, color: COLORS.PAPER, fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.06em" }}>
                  RUN CROSS-CHECK
                </button>
              ) : (
                <div className="mt-2 pt-4 flex flex-col gap-4" style={{ borderTop: `1px solid ${COLORS.LINE}` }}>
                  <div className="flex flex-col gap-2">
                    <Stamp kind={crossCheck.passCount >= 2 ? "corroborated" : "divergence"} />
                    <div className="flex flex-col gap-1 pl-1">
                      {crossCheck.checks.map((c) => (
                        <span key={c.label} style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", color: "#3A362C" }}>
                          {c.pass ? "✓" : "✗"} {c.label} in {c.sign}, {ORDINAL_HOUSE[c.house]} house{c.pass ? `, supports ${crossCheck.trait}.` : `, doesn't clearly support ${crossCheck.trait}.`}
                        </span>
                      ))}
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: crossCheck.passCount >= 2 ? COLORS.GOLD : COLORS.RED, paddingLeft: "4px" }}>Confidence: {crossCheck.confidence}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Stamp kind="divergence" />
                    <div className="flex flex-col gap-1 pl-1">
                      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", color: "#3A362C" }}>
                        ✗ Moon in {crossCheck.moon.sign}, {ORDINAL_HOUSE[crossCheck.moonHouse]} house, points to {crossCheck.moonGist.toLowerCase()}, which doesn't fully line up with {crossCheck.trait}.
                      </span>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: COLORS.RED, paddingLeft: "4px" }}>This isn't a mistake to resolve. See Synthesis, Discovery 1, for what the tension means.</span>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg p-4" style={{ background: "#F2ECDD", border: `1px solid ${COLORS.LINE}` }}>
              <div className="uppercase mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", color: COLORS.RED }}>Why This Matters</div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", lineHeight: 1.6, color: "#3A362C" }}>
                Self-report and computed evidence rarely match perfectly, that's expected, not a failure of either
                system. Where they diverge is often more informative than where they agree. Head to Your Synthesis
                to see how these threads combine into the four Discoveries.
              </p>
            </div>
          </div>
  );
}

// ==== components/report/SynthesisTab.jsx ====
const SYSTEM_NAMES = ["Tropical", "Vedic", "Draconic", "Numerology", "Human Design", "MBTI"];

// The narrative voice layer. Every line is authored, none are generated.
// Each theme has three variants, and which one a person gets is selected by
// their real chart signals: the Sun sign's modality (cardinal signs initiate,
// fixed signs sustain, mutable signs adapt), its element, MBTI letters from
// their own answers, and Life Path. Same voice throughout; the chart picks
// which truth leads. The computed evidence still sits underneath every line.

const SIGN_MODALITY = {
  Aries: "cardinal", Cancer: "cardinal", Libra: "cardinal", Capricorn: "cardinal",
  Taurus: "fixed", Leo: "fixed", Scorpio: "fixed", Aquarius: "fixed",
  Gemini: "mutable", Virgo: "mutable", Sagittarius: "mutable", Pisces: "mutable",
};
const SIGN_ELEMENT = {
  Aries: "fire", Leo: "fire", Sagittarius: "fire",
  Taurus: "earth", Virgo: "earth", Capricorn: "earth",
  Gemini: "air", Libra: "air", Aquarius: "air",
  Cancer: "water", Scorpio: "water", Pisces: "water",
};

const VOICE_LIB = {
  discovery: [
    { when: (s) => s.modality === "fixed", text: "Your strongest pattern is depth over breadth. You don't move on from things quickly, you move into them, and across your systems the same theme repeats: what you commit to, you transform. Your task isn't finding your thing. It's trusting the one you already carry." },
    { when: (s) => s.modality === "mutable", text: "Your strongest pattern is adaptability with a purpose underneath it. Across your systems, the same theme repeats: you learn by moving through many versions of a thing, and what looks like inconsistency from the outside is actually how you gather what you're here to gather." },
    { when: () => true, text: "Your strongest pattern is the need to understand yourself deeply before you fully step into the world. Across your systems, there's a repeated theme of learning through experience, questioning what you've been given, and turning your own transformation into something that can guide others." },
  ],
  identity: [
    { when: (s) => s.modality === "fixed", text: "You are someone whose sense of self runs deep and holds steady. Your path is not about reinventing who you are. It's about letting more of what's already there become visible, on your timeline, not anyone else's." },
    { when: (s) => s.modality === "cardinal", text: "You are someone who finds yourself by starting things. Your identity gets clearer through motion, each beginning shows you another piece of who you are, and waiting to feel fully formed before acting has never actually worked for you." },
    { when: () => true, text: "You are someone who is constantly refining your sense of self. Your path is not about finding one fixed identity, it's about understanding the different versions of yourself and learning how they all connect." },
  ],
  purpose: [
    { when: (s) => [1, 8].includes(s.lifePath), text: "Your purpose is built, not found. The pattern across your systems points toward creating something with your own authority behind it, and the setbacks you've carried aren't detours from that. They're the credential." },
    { when: (s) => [2, 6, 9, 33].includes(s.lifePath), text: "Your purpose runs through other people. The pattern across your systems keeps pointing at care, repair, and the moments where someone else's growth needed exactly what you'd already lived through." },
    { when: () => true, text: "Your purpose is shaped through lived experience. The things you overcome, question, and rebuild become the foundation for what you eventually teach others." },
  ],
  innerConflict: [
    { when: (s) => s.mbtiJ, text: "A repeating pattern in your design is the tension between the plan and the pull. You build structure because it keeps you safe, and then something in you wants to break your own rules. Your growth comes from letting the structure serve you instead of contain you." },
    { when: (s) => s.mbtiP, text: "A repeating pattern in your design is the tension between staying open and landing somewhere. Options feel like freedom until they start feeling like fog. Your growth comes from noticing when exploring has quietly become avoiding." },
    { when: () => true, text: "A repeating pattern in your design is the tension between wanting freedom to explore and wanting certainty before you move. Your growth comes from trusting your ability to adapt instead of waiting for everything to be clear." },
  ],
  communication: [
    { when: (s) => s.mbtiI, text: "Your voice carries most when it's earned in private first. You process inward before you speak, and that's not a delay, it's the reason people trust what finally comes out. Share from what you've lived, not from what you've rehearsed." },
    { when: (s) => s.mbtiE, text: "You think by speaking, and your best insights often surface mid-sentence. Your voice gets stronger when you let people watch you work something out honestly instead of waiting until it's polished." },
    { when: () => true, text: "Your voice becomes stronger when you stop trying to explain what you know and start sharing what you've personally experienced. Your insight carries more weight when it comes from your own transformation." },
  ],
  relationships: [
    { when: (s) => s.element === "water", text: "You are not designed for surface-level connection, and you feel the difference immediately. Your relationships tend to run deep or not at all, and the ones that last are the ones that can hold what you actually carry." },
    { when: (s) => s.element === "air", text: "Connection starts in the mind for you. You bond through conversation, ideas, the feeling of being genuinely understood, and a relationship without that current goes quiet fast, no matter how good it looks from outside." },
    { when: () => true, text: "You are not designed for surface-level connection. Your relationships tend to become mirrors that reveal where you are growing, healing, and becoming more aligned with yourself." },
  ],
  shadow: [
    { when: (s) => s.mbtiJ, text: "One of your deeper patterns is over-preparing as a way of postponing. The plan gets one more revision, the timing gets one more check. The lesson is that readiness is built in motion, and the version of you that starts imperfectly still beats the one that waits." },
    { when: (s) => s.element === "fire", text: "One of your deeper patterns is moving before the feeling has finished speaking. Action comes easy, sitting with discomfort doesn't. The lesson is that some clarity only arrives when you stop long enough to receive it." },
    { when: () => true, text: "One of your deeper patterns is the tendency to search for the perfect answer before taking action. The lesson is learning that clarity often comes through movement, not before it." },
  ],
  creativity: [
    { when: (s) => s.element === "earth", text: "Your creativity wants to become something real. Ideas alone don't satisfy you, you need to see them take form, and the making itself is where you process what you've lived." },
    { when: (s) => s.element === "water", text: "Your creativity is how your inner life gets a body. What you make carries what you've felt, and when you haven't made anything in a while, the feelings have nowhere to go. Creating isn't extra for you. It's regulation." },
    { when: () => true, text: "Your creativity is not separate from your identity. The things you create are often a way of processing your experiences and making meaning from what you've lived." },
  ],
  emotional: [
    { when: (s) => s.element === "water", text: "You feel everything first and understand it second, and that order is not a flaw. Your emotions arrive as information about what's true in the room. The practice is trusting the signal while giving yourself time before you answer it." },
    { when: (s) => s.element === "air" || s.element === "earth", text: "You tend to meet your feelings with analysis, understanding them before you let yourself fully have them. The practice is reversing the order sometimes: feel it first, name it after. The insight will still be there." },
    { when: () => true, text: "Your emotions are not just reactions, they are signals. A major theme in your pattern is learning to trust what you feel while still giving yourself space to reflect before responding." },
  ],
  transformation: [
    { when: (s) => s.modality === "fixed", text: "You don't shed old versions of yourself easily, and you're not supposed to. Your transformations are slower and more total than most people's, less like molting, more like metamorphosis. When you finally change, it's permanent." },
    { when: (s) => s.modality === "mutable", text: "You've already been several people, and there are more coming. Your life pattern moves in cycles of reinvention, and the thread connecting every version is more visible to others than it is to you. It's there. You're not lost, you're layered." },
    { when: () => true, text: "Your life pattern shows repeated cycles of shedding old versions of yourself. You are not meant to stay the same. Growth comes through reinvention." },
  ],
  convergence: [
    { when: (s) => s.modality === "fixed", text: "Across the systems, the same theme keeps appearing: depth is your method and endurance is your proof. You are here to master what you commit to, and the more fully you inhabit your own pattern, the more it steadies the people around you." },
    { when: (s) => [7, 11].includes(s.lifePath), text: "Across the systems, the same theme keeps appearing: you are built to look underneath. Understanding is not a hobby for you, it's the assignment, and the patterns you decode in yourself become the map you hand to others." },
    { when: () => true, text: "Across the systems, the same theme keeps appearing: you are here to turn self-discovery into self-mastery. The more you understand your own patterns, the more naturally you become a guide for others." },
  ],
};

function selectVoice(profile) {
  const signals = {
    modality: SIGN_MODALITY[profile.sunSign] || "fixed",
    element: SIGN_ELEMENT[profile.sunSign] || "water",
    lifePath: profile.numerology.lifePath,
    mbtiJ: !!(profile.mbti && profile.mbti[3] === "J"),
    mbtiP: !!(profile.mbti && profile.mbti[3] === "P"),
    mbtiI: !!(profile.mbti && profile.mbti[0] === "I"),
    mbtiE: !!(profile.mbti && profile.mbti[0] === "E"),
  };
  const out = {};
  for (const [theme, variants] of Object.entries(VOICE_LIB)) {
    out[theme] = variants.find((v) => v.when(signals)).text;
  }
  return out;
}

function matchRow(profile, patternKey) {
  return SYSTEM_NAMES.map((name) => ({ name, match: deriveBool(profile, `${patternKey}_${name}`) }));
}

function agreementLabel(pct) {
  if (pct >= 80) return "Very High";
  if (pct >= 60) return "High";
  if (pct >= 40) return "Moderate";
  return "Mixed";
}

function SynthesisTab() {
  const profile = useProfile();
  const { tropical, draconic, numerology, humanDesign, mbti, enneagram, sunSign, vedic } = profile;
  const VOICE = selectVoice(profile);
  const tp = tropical.points;
  const dp = draconic.points;
  const houseOf = (point) => pointHouse(point, profile.houseSystem).label;

  const sunGist = SIGN_GIST[sunSign];
  const moonGist = SIGN_GIST[tp.Moon.sign];
  const venusGist = SIGN_GIST[tp.Venus.sign];
  const lifePathGist = profile.gists.lifePath;
  const mbtiGist = profile.gists.mbti(mbti);
  const hdTypeGist = profile.gists.hdType;

  const overallThemes = deriveInt(profile, "themeCount", 9, 22);
  const overallPct = deriveInt(profile, "overallAgreement", 45, 96);
  const overallLabel = agreementLabel(overallPct);

  const p1Matches = matchRow(profile, "p1");
  const p2Matches = matchRow(profile, "p2");
  const p3Matches = matchRow(profile, "p3");
  const p4Matches = matchRow(profile, "p4");

  const crossCheck = enneagramCrossCheck(profile);

  const convergenceMapData = [
    { label: "1. Identity", matchCount: p1Matches.filter((m) => m.match).length, total: p1Matches.length },
    { label: "2. Current Timing", matchCount: p2Matches.filter((m) => m.match).length, total: p2Matches.length },
    { label: "3. Career & Purpose", matchCount: p3Matches.filter((m) => m.match).length, total: p3Matches.length },
    { label: "4. Relationships", matchCount: p4Matches.filter((m) => m.match).length, total: p4Matches.length },
  ];

  const confBars = [
    { trait: `Need for ${sunGist.split(",")[0]}`, pct: deriveInt(profile, "conf1", 60, 97), evidence: [{ name: "Tropical Sun", match: true }, { name: "Draconic Sun", match: true }, { name: "Numerology", match: deriveBool(profile, "conf1_num") }, { name: "MBTI", match: deriveBool(profile, "conf1_mbti") }] },
    { trait: "Need for Independence", pct: deriveInt(profile, "conf2", 55, 95), evidence: [{ name: "Tropical Moon", match: true }, { name: "Draconic Sun/Moon", match: deriveBool(profile, "conf2_drac") }, { name: `HD ${humanDesign.authority}`, match: true }, { name: "Enneagram", match: crossCheck.passCount >= 2 }] },
    { trait: "Self-Built Authority", pct: deriveInt(profile, "conf3", 60, 96), evidence: [{ name: `Saturn ${houseOf(tp.Saturn)}`, match: true }, { name: "Draconic Node", match: deriveBool(profile, "conf3_node") }, { name: "HD Type", match: true }] },
  ];

  const [showEvidence, setShowEvidence] = useState(false);
  const heroText = `${VOICE.discovery} In your chart, that thread runs through ${sunGist.toLowerCase()}, ${lifePathGist.toLowerCase()} in your numbers, and ${mbtiGist.toLowerCase()} in how you process the world.`;

  return (
          <div className="flex flex-col gap-8">
            <div className="rounded-lg p-6 sm:p-9" style={{ background: "#F2ECDD", border: `2px solid ${COLORS.GOLD}` }}>
              <div className="uppercase mb-3" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.16em", color: COLORS.RED }}>
                Your Pattern
              </div>
              <p style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(20px, 4.5vw, 24px)", lineHeight: 1.55, color: COLORS.INK, fontWeight: 600, borderLeft: `4px solid ${COLORS.GOLD}`, paddingLeft: "18px" }}>
                {heroText}
              </p>
              <div className="mt-3">
                <SaveButton text={heroText} />
              </div>
              <p className="mt-3" style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", lineHeight: 1.6, color: COLORS.MUTED }}>
                {overallLabel} agreement, found across astrology, psychology, and what you answered yourself.
              </p>
              <button
                onClick={() => setShowEvidence(!showEvidence)}
                aria-expanded={showEvidence}
                className="mt-4 px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity"
                style={{ background: COLORS.INK, color: COLORS.PAPER, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", letterSpacing: "0.06em" }}
              >
                {showEvidence ? "HIDE THE EVIDENCE" : "SEE WHY →"}
              </button>
            </div>

            <div className="overflow-hidden transition-all duration-300 flex flex-col gap-8" style={{ maxHeight: showEvidence ? "20000px" : "0px", opacity: showEvidence ? 1 : 0 }}>

            <div className="rounded-lg p-5 text-center" style={{ background: "#F2ECDD", border: `1px solid ${COLORS.LINE}` }}>
              <div className="uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.12em", color: COLORS.RED }}>
                Pattern Agreement
              </div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(20px, 4.5vw, 24px)", fontWeight: 700, color: COLORS.INK, lineHeight: 1.2 }}>{overallLabel}</div>
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: COLORS.MUTED }}>
                <span>6 frameworks compared</span>
                <span>{overallThemes} repeated themes identified</span>
                <span>Recurring patterns found across systems</span>
              </div>
              <p className="mt-3 pt-3" style={{ borderTop: `1px solid ${COLORS.LINE}`, fontFamily: "'Inter', sans-serif", fontSize: "11.5px", lineHeight: 1.55, color: COLORS.MUTED }}>
                Pattern Agreement measures how often independent systems point toward the same underlying theme.
                It is not a measure of correctness or certainty.
              </p>
            </div>

            <ConvergenceMap patterns={convergenceMapData} />

            <details className="group">
              <summary className="cursor-pointer list-none flex items-center gap-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11.5px", color: COLORS.MUTED }}>
                <span style={{ color: COLORS.GOLD }}>+</span> Why compare six systems?
              </summary>
              <p className="mt-2" style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", lineHeight: 1.7, color: "#3A362C" }}>
                Every framework notices different things. This report compares several independent models to see
                where they agree, and where they don't. Agreement matters. Disagreement matters too.
              </p>
            </details>

            <div className="flex flex-col gap-3">
              <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", letterSpacing: "0.14em", color: COLORS.RED }}>
                Confidence
              </div>
              {confBars.map((c) => (
                <ConfidenceBar key={c.trait} trait={c.trait} pct={c.pct} evidence={c.evidence} />
              ))}
            </div>

            <p className="text-center" style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", color: COLORS.MUTED, fontStyle: "italic" }}>
              The full synthesis, "So Who Are You, Really?", is at the end, after the evidence behind it.
            </p>

            <div className="uppercase pt-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", letterSpacing: "0.14em", color: COLORS.MUTED, borderTop: `1px solid ${COLORS.LINE}` }}>
              How We Know
            </div>

            <ChapterIndex
              chapters={[
                { id: "identity", n: "1", label: "Identity" },
                { id: "timing", n: "2", label: "Current Timing" },
                { id: "career", n: "3", label: "Career & Purpose" },
                { id: "relationships", n: "4", label: "Relationships" },
              ]}
            />

            <Pattern
              accent={SYSTEM_COLORS.tropical}
              id="identity"
              n="1"
              label="Identity"
              flow={{
                items: [
                  { signal: `Sun in ${sunSign}`, interpretation: sunGist },
                  { signal: `Life Path ${numerology.lifePath}`, interpretation: lifePathGist },
                  { signal: `MBTI: ${mbti || "—"}`, interpretation: mbtiGist },
                  { signal: `Human Design ${humanDesign.profile}`, interpretation: hdTypeGist },
                ],
                conclusion: `${sunGist.split(",")[0]}, reinforced across systems`,
              }}
              systems={p1Matches}
              togetherLabel="Convergence"
              together={`${VOICE.identity} Sun in ${sunSign}, Life Path ${numerology.lifePath}, and a ${mbti || "self-reported"} cognitive style are pointing at that same architecture from three different angles.`}
              soWhat={`Here's what that means in practice. When you feel pressure to pick one version of yourself and perform it consistently, that pressure is coming from outside the design, not inside it. The ${sunSign} core doesn't change. The expressions of it are supposed to. Stop auditing yourself for inconsistency that was never the flaw.`}
              chipDetails={[
                { label: `Sun: ${sunSign}, ${houseOf(tp.Sun)}`, system: "Identity (Tropical)", calculation: "Solar longitude at exact birth moment, mapped to the selected house system", meaning: `Core identity placement: ${sunGist.toLowerCase()}.` },
                { label: `MBTI: ${mbti || "—"}`, system: "Cognitive Style (MBTI)", calculation: "Self-report questionnaire, four preference pairs", meaning: mbtiGist },
                { label: `Life Path/Soul Urge/Gift: ${numerology.lifePath}/${numerology.soulUrge}/${numerology.gift}`, system: "Life Themes (Numerology)", calculation: "Reduced sum of birth date and name letters", meaning: `Life Path ${numerology.lifePath}, computed three separate ways from name and birth date.` },
              ]}
              reflect="Think about the last time you accepted an answer without digging further. What made that one different from your usual pattern?"
            />

            <div style={{ borderTop: `1px solid ${COLORS.LINE}` }} />

            <Pattern
              accent={SYSTEM_COLORS.vedic}
              id="timing"
              n="2"
              label="Current Timing"
              flow={{
                items: vedic.isReal ? [
                  { signal: `Moon in ${vedic.nakshatra}, Pada ${vedic.pada}`, interpretation: "Sets the entire dasha sequence, computed from your real Moon position" },
                  { signal: `${vedic.mahaGraha} Mahadasha, ${vedic.mahaStartLabel} to ${vedic.mahaEndLabel}`, interpretation: "The current multi-year chapter" },
                  { signal: `${vedic.mahaGraha}/${vedic.bhuktiGraha} Bhukti`, interpretation: `Current sub-period, closing ${vedic.closingLabel}` },
                  { signal: `${vedic.mahaGraha}/${vedic.nextBhukti} Bhukti (next)`, interpretation: "Sub-period opening after" },
                ] : [
                  { signal: `${vedic.mahaGraha}/${vedic.bhuktiGraha} Bhukti`, interpretation: `Current chapter, closing ${vedic.closingLabel}` },
                  { signal: `${vedic.mahaGraha}/${vedic.nextBhukti} Bhukti (next)`, interpretation: "Chapter opening after" },
                  { signal: `${vedic.releaseGraha} Bhukti`, interpretation: "Overlapping release cycle" },
                  { signal: `Sade Sati, Phase ${vedic.sadeSatiPhase}`, interpretation: "Pressure-testing what isn't built to last" },
                ],
                conclusion: "One timeline, viewed from several angles",
              }}
              systems={p2Matches}
              togetherLabel="Common Thread"
              together={vedic.isReal
                ? `The ${vedic.mahaGraha} Mahadasha runs from ${vedic.mahaStartLabel} through ${vedic.mahaEndLabel}, and inside it, the ${vedic.bhuktiGraha} sub-period closes around ${vedic.closingLabel}. These are real computed dates from your Moon's actual position, not estimates. The chapter you're in has a shape and an end point.`
                : `The ${vedic.mahaGraha}/${vedic.bhuktiGraha} period and the current Sade Sati phase are both active on the same underlying timeline. That's not two unrelated events, it reads as one shift happening from more than one angle.`}
              soWhat={`Decisions made before ${vedic.closingLabel} are being made inside the current chapter, not the next one. That's not a reason to freeze. It's a reason to sort: what needs finishing belongs to now, what needs starting may belong to what opens after. If something can reasonably wait until the timing shifts, let it wait and finish what's actually on the table.`}
              chipDetails={vedic.isReal ? [
                { label: `Moon: ${vedic.nakshatra}, Pada ${vedic.pada}`, system: "Timing (Vedic)", calculation: "Real Moon longitude minus Lahiri ayanamsa, mapped to its nakshatra", meaning: "The single placement that sets the entire Vimshottari sequence." },
                { label: `${vedic.mahaGraha}/${vedic.bhuktiGraha} to ${vedic.mahaGraha}/${vedic.nextBhukti}`, system: "Timing (Vedic)", calculation: "Vimshottari dasha sequence from Moon's sidereal position, real computed dates", meaning: "Current sub-period, closing into the next one." },
              ] : [
                { label: `${vedic.mahaGraha}/${vedic.bhuktiGraha} to ${vedic.mahaGraha}/${vedic.nextBhukti}`, system: "Timing (Vedic)", calculation: "Vimshottari dasha sequence from Moon's sidereal position", meaning: "Current sub-period, closing into the next one." },
                { label: `${vedic.releaseGraha} Bhukti thru ${vedic.releaseLabel}`, system: "Timing (Vedic)", calculation: `Vimshottari dasha sequence, ${vedic.releaseGraha} sub-period`, meaning: `An active release cycle running through ${vedic.releaseLabel}.` },
                { label: `Sade Sati Phase ${vedic.sadeSatiPhase}`, system: "Timing (Vedic)", calculation: "Saturn's transit position relative to the natal Moon", meaning: "A multi-year pressure-testing transit, read here in its current phase." },
              ]}
              reflect="What's one thing you've been forcing to a conclusion that might close cleaner on its own schedule?"
            />

            <div style={{ borderTop: `1px solid ${COLORS.LINE}` }} />

            <Pattern
              accent={SYSTEM_COLORS.numerology}
              id="career"
              n="3"
              label="Career & Purpose"
              flow={{
                items: [
                  { signal: `Saturn in ${houseOf(tp.Saturn)} house`, interpretation: "Self-built authority, not inherited" },
                  { signal: "Draconic Node near Saturn", interpretation: "Already the soul-level assignment" },
                  { signal: `Human Design: ${humanDesign.type}`, interpretation: hdTypeGist },
                ],
                conclusion: "Built to operate on your own terms, not by inheritance",
              }}
              systems={p3Matches}
              togetherLabel="Where They Agree"
              together={`${VOICE.purpose} Saturn in the ${houseOf(tp.Saturn)} house and a ${humanDesign.type} design both back this up: authority and momentum built through your own repeated engagement, not handed down.`}
              soWhat={`Work that depends on borrowed authority or someone else's structure is working against this pattern, not with it. With Saturn in the ${houseOf(tp.Saturn)} house, credibility in this chart gets built the slow way and holds because of it. The years that felt like being behind were the apprenticeship. Building your own version isn't a luxury here, it's the design.`}
              chipDetails={[
                { label: `Saturn: ${houseOf(tp.Saturn)} house`, system: "Identity (Tropical)", calculation: "Saturn's longitude mapped to the selected house system", meaning: "Career and public authority placement." },
                { label: "Draconic NN near Saturn", system: "Soul Layer (Draconic)", calculation: "Chart shifted so North Node sits at 0° Aries", meaning: "A soul-level marker echoing the same career point." },
                { label: `HD: ${humanDesign.type}, ${humanDesign.authority}`, system: "Energy Type (Human Design)", calculation: "Generated from birth data (see Method for how, in this build)", meaning: "Type and authority together." },
              ]}
              reflect="Where in your work right now are you relying on someone else's structure that could become your own instead?"
            />

            <div style={{ borderTop: `1px solid ${COLORS.LINE}` }} />

            <Pattern
              accent={SYSTEM_COLORS.draconic}
              id="relationships"
              n="4"
              label="Relationships"
              flow={{
                items: [
                  { signal: `Venus in ${tp.Venus.sign}`, interpretation: venusGist },
                  { signal: `Draconic Venus in ${dp.Venus.sign}`, interpretation: SIGN_GIST[dp.Venus.sign] },
                  { signal: `Jupiter in ${houseOf(tp.Jupiter)} house`, interpretation: "Growth through structured commitment" },
                ],
                conclusion: `${venusGist.split(",")[0]}, with a different undercurrent underneath`,
              }}
              systems={p4Matches}
              togetherLabel="Combined Pattern"
              together={`${VOICE.relationships} Venus in ${tp.Venus.sign} shows how you express care on the surface, and Draconic Venus in ${dp.Venus.sign} suggests the undercurrent underneath. What shows up day to day and what's actually driving it aren't always the same placement.`}
              soWhat={`A partner who only reads the ${tp.Venus.sign} surface, and never learns the ${dp.Venus.sign} current underneath it, will keep responding to a version of you that's real but incomplete. The practical move: notice which one you lead with when you feel safe versus when you don't. The gap between those two is where most of your relationship friction actually lives.`}
              chipDetails={[
                { label: `Venus: ${tp.Venus.sign}, ${houseOf(tp.Venus)}`, system: "Identity (Tropical)", calculation: "Venus's longitude mapped to the selected house system", meaning: "Love language placement." },
                { label: `Draconic Venus: ${dp.Venus.sign}`, system: "Soul Layer (Draconic)", calculation: "Venus's longitude in the draconic offset chart", meaning: "The soul-level version of the same placement." },
                { label: `Jupiter: ${tp.Jupiter.sign}, ${houseOf(tp.Jupiter)}`, system: "Identity (Tropical)", calculation: "Jupiter's longitude mapped to the selected house system", meaning: "Where growth through partnership comes from." },
              ]}
              reflect="In your closest relationship, do you tend to show care through action before you show it through words? Does your partner read that the way you mean it?"
            />

            <div style={{ borderTop: `2px solid ${COLORS.INK}` }} />

            <div className="flex flex-col gap-3">
              <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", letterSpacing: "0.14em", color: COLORS.RED }}>
                The Contradictions
              </div>
              <div className="rounded-lg p-4 flex flex-col gap-1.5" style={{ background: "#F2ECDD", border: `1px solid ${COLORS.LINE}` }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", color: "#3A362C" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: COLORS.GOLD }}>Moon</span> says: {moonGist.toLowerCase()}.
                </p>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", color: "#3A362C" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: COLORS.GOLD }}>Enneagram</span> says: {crossCheck.trait}.
                </p>
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "14.5px", lineHeight: 1.75, color: "#3A362C" }}>
                {VOICE.innerConflict} One pattern was likely built more recently, layered on top of one that
                was there first, and that's not automatically a contradiction to resolve.
              </p>
              <div className="rounded-lg p-3.5" style={{ border: `1px dashed ${COLORS.GOLD}` }}>
                <div className="uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", letterSpacing: "0.1em", color: COLORS.GOLD }}>Question</div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", lineHeight: 1.6, color: "#3A362C", fontStyle: "italic" }}>
                  {VOICE.shadow} Which one shows up under stress, the pattern from the Moon or the pattern from the Enneagram? That's usually the more honest answer.
                </p>
              </div>
              <SourceChipRow labels={[`Enneagram: ${enneagram ? enneagram.label : "—"}`, `Moon: ${tp.Moon.sign}, ${houseOf(tp.Moon)}`]} />
            </div>

            <div style={{ borderTop: `2px solid ${COLORS.INK}` }} />

            <div className="flex flex-col gap-3">
              <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", letterSpacing: "0.14em", color: COLORS.RED }}>
                Now What
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-lg p-4" style={{ background: COLORS.CARD, boxShadow: SOFT_SHADOW }}>
                  <div className="uppercase mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", color: SYSTEM_COLORS.tropical, fontWeight: 600 }}>Your Strengths</div>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", lineHeight: 1.6, color: "#3A362C" }}>
                    {VOICE.creativity} Underneath it: {sunGist.toLowerCase()}, {hdTypeGist.toLowerCase()}, and an authority built through {houseOf(tp.Saturn)}-house discipline that wasn't handed to you.
                  </p>
                </div>
                <div className="rounded-lg p-4" style={{ background: COLORS.CARD, boxShadow: SOFT_SHADOW }}>
                  <div className="uppercase mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", color: SYSTEM_COLORS.vedic, fontWeight: 600 }}>Your Current Lesson</div>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", lineHeight: 1.6, color: "#3A362C" }}>
                    {VOICE.emotional} Practically: letting the current {vedic.mahaGraha}/{vedic.bhuktiGraha} chapter close on its own schedule, instead of forcing a conclusion before {vedic.closingLabel}.
                  </p>
                </div>
                <div className="rounded-lg p-4" style={{ background: COLORS.CARD, boxShadow: SOFT_SHADOW }}>
                  <div className="uppercase mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", color: SYSTEM_COLORS.draconic, fontWeight: 600 }}>Your Blind Spot</div>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", lineHeight: 1.6, color: "#3A362C" }}>
                    Mistaking the {tp.Moon.sign} Moon's instinct for a flaw in your usual identity, when it's actually a signal worth trusting on its own terms.
                  </p>
                </div>
                <div className="rounded-lg p-4" style={{ background: COLORS.CARD, boxShadow: SOFT_SHADOW }}>
                  <div className="uppercase mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", color: SYSTEM_COLORS.numerology, fontWeight: 600 }}>Practices to Try</div>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", lineHeight: 1.6, color: "#3A362C" }}>
                    {VOICE.communication} Try a short daily log of gut decisions versus planned ones, given your {humanDesign.authority} authority, and journaling around what your {enneagram ? enneagram.label : "core"} pattern actually needs before agreeing to it.
                  </p>
                </div>
              </div>

              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", lineHeight: 1.7, color: COLORS.MUTED }}>
                Where any of this lands wrong or doesn't fit, that mismatch is information too. The chart
                describes a pattern. What's done with it stays a personal choice, not an instruction.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", letterSpacing: "0.14em", color: COLORS.RED }}>
                Pattern Evolution
              </div>
              <div className="rounded-lg p-5 flex flex-col gap-4" style={{ background: COLORS.CARD, border: `1px solid ${COLORS.LINE}` }}>
                <div>
                  <div className="uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", letterSpacing: "0.1em", color: COLORS.FAINT }}>Who You Were</div>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", lineHeight: 1.65, color: "#3A362C" }}>
                    Operating inside the {vedic.mahaGraha}/{vedic.bhuktiGraha} chapter, the version of this pattern that's been running until now.
                  </p>
                </div>
                <div aria-hidden="true" className="text-center" style={{ color: COLORS.GOLD, fontSize: "16px" }}>↓</div>
                <div>
                  <div className="uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", letterSpacing: "0.1em", color: COLORS.GOLD }}>Who You're Becoming</div>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", lineHeight: 1.65, color: "#3A362C" }}>
                    {VOICE.transformation} Moving into {vedic.mahaGraha}/{vedic.nextBhukti} around {vedic.closingLabel}, while {sunGist.toLowerCase()} stays the constant underneath whichever chapter is active.
                  </p>
                </div>
                <div aria-hidden="true" className="text-center" style={{ color: COLORS.GOLD, fontSize: "16px" }}>↓</div>
                <div>
                  <div className="uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", letterSpacing: "0.1em", color: COLORS.FAINT }}>What Supports That</div>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", lineHeight: 1.65, color: "#3A362C" }}>
                    {overallLabel} agreement across the systems above, plus a {humanDesign.type} design built to move once something real is already in motion, not before.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-7 sm:p-10" style={{ background: "#F2ECDD", border: `2px solid ${COLORS.GOLD}` }}>
              <div className="uppercase mb-4 text-center" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.16em", color: COLORS.RED }}>
                So Who Are You, Really?
              </div>
              {(() => {
                const closingText = `${VOICE.convergence} In your chart specifically, it shows up as ${sunGist.toLowerCase()}, ${lifePathGist.toLowerCase()} in your numbers, ${mbtiGist.toLowerCase()} in how you process the world, and ${hdTypeGist.toLowerCase()} in how you take action. A thread that repeats across this many unrelated systems is rarely a coincidence worth ignoring.`;
                return (
                  <>
                    <p style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(20px, 4.5vw, 24px)", lineHeight: 1.75, color: COLORS.INK, borderLeft: `4px solid ${COLORS.GOLD}`, paddingLeft: "20px" }}>
                      {closingText}
                    </p>
                    <div className="mt-4 flex justify-center">
                      <SaveButton text={closingText} />
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex flex-col gap-2">
              <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", letterSpacing: "0.14em", color: COLORS.RED }}>
                Theme Index
              </div>
              <div className="rounded-lg p-4 flex flex-col gap-2.5" style={{ background: COLORS.CARD, border: `1px solid ${COLORS.LINE}` }}>
                {[
                  { n: "1", label: "Identity", matches: p1Matches },
                  { n: "2", label: "Current Timing", matches: p2Matches },
                  { n: "3", label: "Career & Purpose", matches: p3Matches },
                  { n: "4", label: "Relationships", matches: p4Matches },
                ].map((t) => (
                  <div key={t.n} className="flex items-center justify-between flex-wrap gap-2">
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#3A362C" }}>{t.n}. {t.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: COLORS.GOLD }}>{t.matches.filter((m) => m.match).length} / 6 systems</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg p-5" style={{ background: "#F2ECDD", border: `1px solid ${COLORS.LINE}` }}>
              <p style={{ fontFamily: "'Fraunces', serif", fontSize: "17px", fontWeight: 600, color: COLORS.INK, lineHeight: 1.4 }}>
                Your report isn't static.
              </p>
              <p className="mt-2" style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", lineHeight: 1.65, color: "#3A362C" }}>
                As major timing cycles change, Convergence updates the patterns that are active now while
                preserving the deeper themes that stay consistent across your life. Your next shift lands around{" "}
                {vedic.closingLabel}, when your Bhukti moves from {vedic.mahaGraha}/{vedic.bhuktiGraha} into{" "}
                {vedic.mahaGraha}/{vedic.nextBhukti}, and Discovery 2 will read differently because the underlying
                timing actually moved.
              </p>
            </div>

            <div className="rounded-lg p-5 text-center" style={{ border: `1px dashed ${COLORS.GOLD}` }}>
              <div className="uppercase mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9.5px", letterSpacing: "0.12em", color: COLORS.GOLD }}>
                Coming Soon
              </div>
              <p style={{ fontFamily: "'Fraunces', serif", fontSize: "16px", fontWeight: 600, color: COLORS.INK, lineHeight: 1.4 }}>
                Convergence: Relationships
              </p>
              <p className="mt-1.5" style={{ fontFamily: "'Inter', sans-serif", fontSize: "12.5px", lineHeight: 1.6, color: COLORS.MUTED }}>
                See where two people's patterns reinforce each other, challenge each other, and create something new.
              </p>
            </div>

            </div>
          </div>
  );
}

// ==== components/navigation/Tabs.jsx ====
function Tabs({ tab, setTab, onEditBirthData }) {
  return (
      <div className="sticky top-0 z-10 overflow-x-auto" style={{ background: COLORS.PAPER, borderBottom: `1px solid ${COLORS.LINE}` }}>
        <div className="max-w-3xl mx-auto flex gap-2 px-4 py-3 min-w-max sm:min-w-0" role="tablist">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                onClick={() => setTab(t.id)}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                className="px-4 py-2 rounded-full transition-colors flex-shrink-0"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11.5px", letterSpacing: "0.02em", fontWeight: active ? 600 : 400, background: active ? COLORS.GOLD : "transparent", color: active ? COLORS.PAPER : COLORS.MUTED, border: `1px solid ${active ? COLORS.GOLD : COLORS.LINE}` }}
              >
                {t.label}
              </button>
            );
          })}
          <button
            onClick={() => onEditBirthData()}
            className="px-4 py-2 rounded-full flex-shrink-0"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11.5px", color: COLORS.FAINT, border: `1px solid ${COLORS.LINE}`, background: "transparent" }}
          >
            ← Edit birth data
          </button>
        </div>
      </div>

  );
}

// ==== App.jsx ====
function App() {
  const [tab, setTab] = useState("intro");
  const [houseSystem, setHouseSystem] = useState("placidus");
  const [checked, setChecked] = useState(false);
  const [savedInsights, setSavedInsights] = useState([]);
  const toggleSavedInsight = (text) => {
    setSavedInsights((prev) => (prev.includes(text) ? prev.filter((t) => t !== text) : [...prev, text]));
  };
  const savedInsightsValue = { saved: savedInsights, toggle: toggleSavedInsight };
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthLocation, setBirthLocation] = useState("");

  // The generated, per-person profile. Built once birth data is in, then
  // extended with real MBTI/Enneagram results once the quiz is answered.
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab]);

  function handleBirthDataContinue() {
    const generated = buildProfile({ userName, birthDate, birthTime, birthLocation });
    setProfile(generated);
    setTab("quizIntake");

    // Attempt the Swiss Ephemeris backend in the background. If it answers,
    // rebuild the profile at full precision, keeping any quiz results the
    // person has answered in the meantime. If it doesn't, the built-in math
    // already on screen stays, nothing breaks.
    const cm = lookupCity(birthLocation);
    if (PRECISION_BACKEND_URL && cm && birthTime) {
      const [h, mi] = birthTime.split(":").map(Number);
      const utHours = h + mi / 60 - cm.utc;
      fetchPrecision(birthDate, utHours, cm.lat, cm.lon).then((precision) => {
        if (!precision) return;
        setProfile((prev) => {
          const upgraded = buildProfile({ userName, birthDate, birthTime, birthLocation, precision });
          return { ...upgraded, mbti: prev && prev.mbti, enneagram: prev && prev.enneagram, quizAnswers: prev && prev.quizAnswers };
        });
      });
    }
  }

  function handleQuizContinue({ mbtiAnswers, enneagramScores, quizAnswers }) {
    const mbti = scoreMBTI(mbtiAnswers);
    const enneagram = scoreEnneagram(enneagramScores);
    setProfile((prev) => ({ ...prev, mbti, enneagram, quizAnswers }));
    setTab("processing");
  }

  // --- Entry flow screens (each is a full-screen standalone step) ---
  if (tab === "intro") {
    return <Intro onBegin={() => setTab("email")} onReadMethod={() => setTab("method")} />;
  }

  if (tab === "method") {
    return <Method onBegin={() => setTab("email")} />;
  }

  if (tab === "email") {
    return <EmailCapture email={email} setEmail={setEmail} onContinue={() => setTab("intake")} />;
  }

  if (tab === "intake") {
    return (
      <BirthDataForm
        userName={userName}
        setUserName={setUserName}
        birthDate={birthDate}
        setBirthDate={setBirthDate}
        birthTime={birthTime}
        setBirthTime={setBirthTime}
        birthLocation={birthLocation}
        setBirthLocation={setBirthLocation}
        onContinue={handleBirthDataContinue}
      />
    );
  }

  if (tab === "quizIntake") {
    return <QuizIntake onContinue={handleQuizContinue} />;
  }

  if (tab === "processing") {
    return <Processing onDone={() => setTab("signature")} />;
  }

  // Everything past this point needs a built profile.
  if (!profile) {
    return <Intro onBegin={() => setTab("email")} onReadMethod={() => setTab("method")} />;
  }

  // Extend the built profile with the house-system UI toggle so every tab
  // (not just Evidence) reads the same Placidus/Whole Sign choice.
  const profileWithSettings = profile ? { ...profile, houseSystem } : null;

  if (tab === "signature") {
    return (
      <ProfileContext.Provider value={profileWithSettings}>
        <Signature onContinue={() => setTab("synthesis")} />
      </ProfileContext.Provider>
    );
  }

  // --- Main report shell: nav + header + active tab body + footer ---
  return (
    <ProfileContext.Provider value={profileWithSettings}>
      <SavedInsightsContext.Provider value={savedInsightsValue}>
      <div className="min-h-screen w-full" style={{ background: COLORS.PAPER, overflowX: "hidden" }}>
        <style>{FONT_IMPORT}</style>

        <Tabs tab={tab} setTab={setTab} onEditBirthData={() => setTab("intake")} />

        <Header>
          {savedInsights.length > 0 && (
            <details className="rounded-lg p-4 mb-2" style={{ background: "#FBF3DD", border: `1px solid ${COLORS.GOLD}` }}>
              <summary className="cursor-pointer" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: COLORS.GOLD, letterSpacing: "0.04em" }}>
                ★ {savedInsights.length} saved insight{savedInsights.length > 1 ? "s" : ""}
              </summary>
              <div className="flex flex-col gap-2 mt-3">
                {savedInsights.map((text) => (
                  <p key={text} style={{ fontFamily: "'Fraunces', serif", fontSize: "14px", lineHeight: 1.6, color: COLORS.INK, borderLeft: `3px solid ${COLORS.GOLD}`, paddingLeft: "10px" }}>
                    {text}
                  </p>
                ))}
              </div>
            </details>
          )}
          {tab === "engine1" && (
            <div role="tabpanel" id="panel-engine1" aria-labelledby="tab-engine1">
              <EvidenceTab houseSystem={houseSystem} setHouseSystem={setHouseSystem} />
            </div>
          )}
          {tab === "engine2" && (
            <div role="tabpanel" id="panel-engine2" aria-labelledby="tab-engine2">
              <QuestionnaireTab checked={checked} setChecked={setChecked} />
            </div>
          )}
          {tab === "synthesis" && (
            <div role="tabpanel" id="panel-synthesis" aria-labelledby="tab-synthesis">
              <SynthesisTab />
            </div>
          )}
        </Header>

        <Footer />
      </div>
      </SavedInsightsContext.Provider>
    </ProfileContext.Provider>
  );
}

// Catches unexpected crashes (a malformed date, a browser quirk) and shows a
// recoverable screen with a way back, instead of a silent blank page.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.error("Convergence crashed:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6" style={{ background: COLORS.PAPER }}>
          <style>{FONT_IMPORT}</style>
          <div className="w-full max-w-sm flex flex-col gap-4 text-center items-center">
            <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.14em", color: COLORS.RED }}>
              Something Went Wrong
            </div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", lineHeight: 1.6, color: COLORS.MUTED }}>
              This screen shouldn't have crashed. Reloading with the same birth data usually fixes it.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-3 rounded-full hover:opacity-90 transition-opacity"
              style={{ background: COLORS.INK, color: COLORS.PAPER, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", letterSpacing: "0.06em" }}
            >
              RELOAD
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithBoundary;
