import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  GraduationCap, Palette, TrendingUp, Plus, RotateCcw, LogIn,
  ChevronRight, ChevronLeft, X, Settings, Check, Pencil, Trash2,
  BookOpen, Sparkles, ArrowUpRight, Undo2, Lightbulb, Target, CalendarDays, Trophy, PartyPopper, Download, Copy, Flame, Award, Flag
} from "lucide-react";

/* ---------------------------------- data ---------------------------------- */

const LEVEL_BONUS = { Regular: 0, Honors: 0.5, AP: 1 };

const GRADE_SCALE = [
  { min: 97, letter: "A+", pts: 4.0 },
  { min: 93, letter: "A", pts: 4.0 },
  { min: 90, letter: "A-", pts: 3.7 },
  { min: 87, letter: "B+", pts: 3.3 },
  { min: 83, letter: "B", pts: 3.0 },
  { min: 80, letter: "B-", pts: 2.7 },
  { min: 77, letter: "C+", pts: 2.3 },
  { min: 73, letter: "C", pts: 2.0 },
  { min: 70, letter: "C-", pts: 1.7 },
  { min: 67, letter: "D+", pts: 1.3 },
  { min: 63, letter: "D", pts: 1.0 },
  { min: 60, letter: "D-", pts: 0.7 },
  { min: -1, letter: "F", pts: 0.0 },
];

function gradeFromPct(pct) {
  if (pct == null || Number.isNaN(pct)) return { letter: "—", pts: 0 };
  for (const row of GRADE_SCALE) if (pct >= row.min) return row;
  return GRADE_SCALE[GRADE_SCALE.length - 1];
}

// Grade points for each letter. A class's own letter (from Aeries) is looked up here.
const MARK_POINTS = Object.fromEntries(GRADE_SCALE.map((r) => [r.letter, r.pts]));

// A what-if moves the percentage, and Aeries has no letter for a percentage that isn't real. So estimate it from the
// (percent, letter) pairs Aeries did give for this class (its categories and its total): a pair at that exact percent,
// else a letter Aeries gave on both sides of it. Failing that, use the standard scale, but without + and - if this class
// clearly doesn't use them (Aeries gave a plain "A" where the standard scale would say "A+").
function estimateGrade(cls, pct) {
  const known = (cls.marks || []).filter((m) => m && Number.isFinite(m.pct) && MARK_POINTS[m.mark] != null);
  const hit = known.find((m) => Math.abs(m.pct - pct) < 0.005);
  const below = known.filter((m) => m.pct <= pct);
  const above = known.filter((m) => m.pct >= pct);
  const bracketed = below.find((a) => above.some((b) => b.mark === a.mark));
  let letter = hit ? hit.mark : bracketed ? bracketed.mark : null;
  if (!letter) {
    letter = gradeFromPct(pct).letter;
    const plain = known.length > 0 && known.every((m) => !/[+-]/.test(m.mark)) &&
      known.some((m) => { const d = gradeFromPct(m.pct).letter; return /[+-]/.test(d) && d.replace(/[+-]/, "") === m.mark; });
    if (plain) letter = letter.replace(/[+-]/, "");
  }
  return { letter, pts: MARK_POINTS[letter] };
}

// The letter and grade points for a class. If Aeries gave a letter and the grade is still exactly what Aeries shows,
// that letter is used as is. Otherwise (what-ifs, or older saved data without a letter) it is estimated.
function gradeFor(cls, pct) {
  if (pct == null || Number.isNaN(pct)) return gradeFromPct(pct);
  const pts = cls && cls.mark ? MARK_POINTS[cls.mark] : undefined;
  if (pts == null) return gradeFromPct(pct);
  if (cls.basePct != null && Math.abs(pct - cls.basePct) < 1e-6) return { letter: cls.mark, pts };
  return estimateGrade(cls, pct);
}

const ACCENTS = [
  { name: "Gold star", value: "#C9A227" },
  { name: "Red pen", value: "#C0392B" },
  { name: "Chalk blue", value: "#3B6E91" },
  { name: "Ivy", value: "#3B6D28" },
  { name: "Plum", value: "#6B3F63" },
];

let uid = 1000;
const nextId = () => uid++;

function makeClass(name, teacher, level, cats, assignments) {
  return {
    id: nextId(),
    name, teacher, level,
    categories: cats.map((c) => ({ id: nextId(), ...c })),
    assignments,
  };
}

function seedData() {
  const chemCats = [
    { name: "Labs", weight: 30 },
    { name: "Tests", weight: 45 },
    { name: "Homework", weight: 15 },
    { name: "Participation", weight: 10 },
  ];
  const histCats = [
    { name: "Essays", weight: 35 },
    { name: "Tests", weight: 40 },
    { name: "Reading checks", weight: 25 },
  ];
  const mathCats = [
    { name: "Homework", weight: 20 },
    { name: "Quizzes", weight: 30 },
    { name: "Tests", weight: 50 },
  ];
  const engCats = [
    { name: "Essays", weight: 40 },
    { name: "Discussion", weight: 20 },
    { name: "Quizzes", weight: 40 },
  ];
  const spanCats = [
    { name: "Speaking", weight: 25 },
    { name: "Homework", weight: 25 },
    { name: "Tests", weight: 50 },
  ];
  const peCats = [{ name: "Participation", weight: 70 }, { name: "Fitness tests", weight: 30 }];

  const chem = makeClass("AP Chemistry", "Dr. Alvarez", "AP", chemCats, []);
  const hist = makeClass("AP US History", "Ms. Okafor", "AP", histCats, []);
  const math = makeClass("Honors Pre-Calculus", "Mr. Diaz", "Honors", mathCats, []);
  const eng = makeClass("English 10 Honors", "Ms. Bennett", "Honors", engCats, []);
  const span = makeClass("Spanish 3", "Sra. Marquez", "Regular", spanCats, []);
  const pe = makeClass("PE", "Coach Reyes", "Regular", peCats, []);

  const seen = new Map();
  const demoDay = (k) => isoDay(todayDay() - 40 + k);
  const A = (cls, catIdx, name, earned, possible) => {
    const k = (seen.get(cls) || 0) + 1;
    seen.set(cls, k);
    cls.assignments.push({
      id: nextId(),
      catId: cls.categories[catIdx].id,
      name, earned, possible,
      due: demoDay(k * 5 + catIdx),
      isWhatIf: false, original: null,
    });
  };

  A(chem, 0, "Titration lab", 18, 20);
  A(chem, 0, "Calorimetry lab", 27, 30);
  A(chem, 1, "Unit 2 test", 84, 100);
  A(chem, 1, "Unit 3 test", 91, 100);
  A(chem, 2, "Stoichiometry set", 19, 20);
  A(chem, 2, "Gas laws set", 17, 20);
  A(chem, 3, "Lab participation", 28, 30);

  A(hist, 0, "Manifest destiny essay", 42, 50);
  A(hist, 1, "Unit 4 test", 88, 100);
  A(hist, 1, "Unit 5 test", 79, 100);
  A(hist, 2, "Ch. 14 reading check", 9, 10);
  A(hist, 2, "Ch. 15 reading check", 8, 10);

  A(math, 0, "Problem set 7", 18, 20);
  A(math, 0, "Problem set 8", 20, 20);
  A(math, 1, "Trig identities quiz", 22, 25);
  A(math, 1, "Limits quiz", 19, 25);
  A(math, 2, "Midterm", 142, 160);

  A(eng, 0, "Gatsby essay", 87, 100);
  A(eng, 1, "Socratic seminar", 18, 20);
  A(eng, 2, "Vocab quiz 4", 14, 15);
  A(eng, 2, "Vocab quiz 5", 13, 15);

  A(span, 0, "Oral presentation", 44, 50);
  A(span, 1, "Workbook ch. 6", 19, 20);
  A(span, 2, "Unit 3 test", 82, 100);

  A(pe, 0, "Daily participation", 92, 100);
  A(pe, 1, "Mile run", 27, 30);

  const t0 = todayDay();
  for (const c of [chem, hist, math, eng, span, pe]) { c.termStart = isoDay(t0 - 62); c.termEnd = isoDay(t0 + 64); }
  chem.pending = [
    { category: "Labs", name: "Spectroscopy lab", possible: 30, complete: false, due: isoDay(t0 + 3) },
    { category: "Tests", name: "Unit 4 test", possible: 100, complete: false, due: isoDay(t0 + 9) },
  ];
  hist.pending = [{ category: "Essays", name: "DBQ essay", possible: 50, complete: false, due: isoDay(t0 + 5) }];
  math.pending = [{ category: "Homework", name: "Problem set 9", possible: 20, complete: true, due: isoDay(t0 - 4) }];
  eng.pending = [{ category: "Quizzes", name: "Vocab quiz 6", possible: 15, complete: false, due: isoDay(t0 + 1) }];
  return [chem, hist, math, eng, span, pe];
}

/* ------------------------------- calculations ------------------------------ */

function classPercent(cls) {
  let weightUsed = 0;
  let weightedSum = 0;
  const perCat = {};
  for (const cat of cls.categories) {
    const items = cls.assignments.filter((a) => a.catId === cat.id && a.possible > 0 && !a.excluded);
    if (items.length === 0) { perCat[cat.id] = null; continue; }
    const earned = items.reduce((s, a) => s + a.earned, 0);
    const possible = items.reduce((s, a) => s + a.possible, 0);
    const pct = possible > 0 ? (earned / possible) * 100 : null;
    perCat[cat.id] = pct;
    if (pct != null) { weightedSum += pct * cat.weight; weightUsed += cat.weight; }
  }
  const pct = weightUsed > 0 ? weightedSum / weightUsed : null;
  return { pct, perCat };
}

function classSparkPoints(cls) {
  // the class grade after each day something was due: the same numbers the Timeline tab plots
  return classSeries(cls).points.map((p) => p.pct);
}

// An assignment that came from Aeries is "real". One you added yourself as a what-if is "yours".
const isYours = (a) => a.isWhatIf && a.original == null;

// The trash button on a real assignment leaves it out of your grade (a what-if); press it again to put it back.
// Real assignments are never deleted. Only a what-if you added yourself can be removed.
function toggleExcludedOf(cls, id) {
  return {
    ...cls,
    assignments: cls.assignments.map((a) => {
      if (a.id !== id || isYours(a)) return a;
      if (a.excluded) { const { excluded, ...rest } = a; return rest; }
      return { ...a, excluded: true };
    }),
  };
}
function removeWhatIf(cls, id) {
  return { ...cls, assignments: cls.assignments.filter((a) => !(a.id === id && isYours(a))) };
}
// Back to exactly what Aeries says: drops your what-ifs, restores edited scores, puts back left-out assignments.
function resetWhatIfsOf(cls) {
  return {
    ...cls,
    assignments: cls.assignments
      .filter((a) => !isYours(a))
      .map((a) => {
        const { excluded, ...rest } = a;
        return a.original != null ? { ...rest, earned: a.original, original: null, isWhatIf: false } : rest;
      }),
  };
}
const hasWhatIfs = (cls) => cls.assignments.some((a) => a.isWhatIf || a.excluded);

// A comparison key, so a refresh that changes nothing can leave the screen alone.
function classesKey(classes) {
  return JSON.stringify(classes.map((c) => [
    c.id, c.name, c.level, c.mark || null, c.basePct == null ? null : c.basePct, c.termStart || null, c.termEnd || null,
    (c.pending || []).map((p) => [p.category, p.name, p.possible, !!p.complete, p.due || null]),
    c.categories.map((k) => [k.id, k.name, k.weight]),
    c.assignments.map((a) => [a.id, a.catId, a.name, a.earned, a.possible, a.due || null, !!a.isWhatIf, a.original == null ? null : a.original, !!a.excluded]),
  ]));
}

function computeGpa(classes, weighted) {
  const withGrades = classes.map((c) => {
    const { pct } = classPercent(c);
    const g = gradeFor(c, pct);
    const bonus = weighted ? LEVEL_BONUS[c.level] : 0;
    return { ...c, pct, points: pct == null ? null : g.pts + bonus, letter: g.letter };
  });
  const graded = withGrades.filter((c) => c.points != null);
  const gpa = graded.length ? graded.reduce((s, c) => s + c.points, 0) / graded.length : null;
  return { gpa, withGrades };
}

/* ------------------------------ timeline math ------------------------------ */

const DAY_MS = 86400000;
function dayNum(iso) {
  const m = typeof iso === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS) : null;
}
const dayLabel = (n) => new Date(n * DAY_MS).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

// How one class's grade moved over time: one point for each day something was due, holding the real weighted class
// percentage after everything due up to then (the same math as classPercent). Assignments you left out are skipped.
// What-ifs you added come after the last real date, so you can see where they would take the grade.
// If most assignments have no date (older saved data), `dated` is false and the points are in entry order instead.
function classSeries(cls) {
  const live = cls.assignments.map((a, idx) => ({ a, idx })).filter(({ a }) => !a.excluded && a.possible > 0);
  const real = live.filter(({ a }) => !isYours(a));
  const datedCount = real.filter(({ a }) => dayNum(a.due) != null).length;
  const dated = real.length > 0 && datedCount / real.length >= 0.5;

  const rows = [];
  let lastDay = null;
  for (const { a, idx } of real) {
    let day = dated ? dayNum(a.due) : idx;
    if (day == null) day = lastDay; // no date: borrow the one before it
    if (day != null) lastDay = day;
    rows.push({ a, idx, day });
  }
  const firstDay = rows.find((r) => r.day != null);
  for (const r of rows) if (r.day == null) r.day = firstDay ? firstDay.day : 0;
  const endDay = rows.length ? Math.max(...rows.map((r) => r.day)) : 0;
  let k = 0;
  for (const { a, idx } of live) {
    if (!isYours(a)) continue;
    k += 1;
    rows.push({ a, idx, day: endDay + (dated ? 3 * k : k) });
  }
  rows.sort((x, y) => x.day - y.day || x.idx - y.idx);

  const weightOf = new Map(cls.categories.map((c) => [c.id, c.weight]));
  const nameOf = new Map(cls.categories.map((c) => [c.id, c.name]));
  const sums = new Map();
  const points = [];
  let prev = null;
  let i = 0;
  while (i < rows.length) {
    const day = rows[i].day;
    const items = [];
    while (i < rows.length && rows[i].day === day) {
      const { a } = rows[i];
      const s = sums.get(a.catId) || { e: 0, p: 0 };
      s.e += a.earned; s.p += a.possible;
      sums.set(a.catId, s);
      items.push({ name: a.name, cat: nameOf.get(a.catId) || "", earned: a.earned, possible: a.possible, whatIf: !!a.isWhatIf });
      i += 1;
    }
    let used = 0, sum = 0;
    for (const [cid, s] of sums) {
      const w = weightOf.get(cid);
      if (w == null || s.p <= 0) continue;
      sum += (s.e / s.p) * 100 * w;
      used += w;
    }
    const pct = used > 0 ? sum / used : null;
    if (pct != null) {
      points.push({ day, pct, delta: prev != null ? pct - prev : null, items, whatIf: items.some((x) => x.whatIf) });
      prev = pct;
    }
  }
  return { points, dated };
}

// GPA over time: on every day a grade moved, each class's latest percentage turned into a letter (Aeries' own where it is
// exactly today's grade, an estimate for earlier days), averaged. `list` is [{ cls, points }].
function gpaSeries(list, weighted) {
  const days = [...new Set(list.flatMap((x) => x.points.map((p) => p.day)))].sort((a, b) => a - b);
  const out = [];
  for (const day of days) {
    let total = 0, n = 0;
    for (const { cls, points } of list) {
      let last = null;
      for (const p of points) { if (p.day <= day) last = p; else break; }
      if (!last) continue;
      total += gradeFor(cls, last.pct).pts + (weighted ? LEVEL_BONUS[cls.level] : 0);
      n += 1;
    }
    if (n) out.push({ day, gpa: total / n });
  }
  return out;
}

/* ------------------------------ insights math ------------------------------ */

const pad2 = (n) => String(n).padStart(2, "0");
const isoDay = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);
function todayDay(now = new Date()) {
  return dayNum(now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate()));
}
const avgOf = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const normName = (s) => String(s).trim().toLowerCase();
const LETTER_RANK = Object.fromEntries(GRADE_SCALE.map((r, i) => [r.letter, i])); // lower = better

// The class as Aeries has it: no what-ifs, nothing left out.
const realOf = (cls) => resetWhatIfsOf(cls);

// A class with one more (pretend) assignment.
function withExtra(cls, catId, earned, possible) {
  return { ...cls, assignments: cls.assignments.concat([{ id: -1, catId, name: "?", earned, possible, isWhatIf: true, original: null }]) };
}

// Which assignments cost you the most: how much each class would go up if that one had been full credit.
function biggestHits(classes, limit = 10) {
  const out = [];
  for (const cls of classes.map(realOf)) {
    const now = classPercent(cls).pct;
    if (now == null) continue;
    for (const a of cls.assignments) {
      if (a.possible <= 0 || a.earned >= a.possible) continue;
      const full = { ...cls, assignments: cls.assignments.map((x) => (x.id === a.id ? { ...x, earned: x.possible } : x)) };
      const gain = classPercent(full).pct - now;
      if (gain > 0.005) out.push({ cls, a, gain, lost: a.possible - a.earned });
    }
  }
  return out.sort((x, y) => y.gain - x.gain).slice(0, limit);
}

// Where a class's lost points went, by category. `lost` is in percentage points of the class grade.
function categoryBreakdown(cls) {
  const real = realOf(cls);
  const { perCat } = classPercent(real);
  const used = real.categories.filter((k) => perCat[k.id] != null);
  const total = used.reduce((s, k) => s + k.weight, 0);
  return used.map((k) => {
    const xs = real.assignments.filter((a) => a.catId === k.id && a.possible > 0);
    const pct = perCat[k.id];
    const share = total > 0 ? k.weight / total : 0;
    return {
      cat: k, pct, weight: k.weight, share, n: xs.length,
      earned: xs.reduce((s, a) => s + a.earned, 0), possible: xs.reduce((s, a) => s + a.possible, 0),
      lost: Math.max(0, (100 - pct) * share), kept: Math.min(pct, 100) * share,
    };
  }).sort((a, b) => b.lost - a.lost);
}

// How even your scores are in a class.
function scoreSpread(cls) {
  const items = realOf(cls).assignments.filter((a) => a.possible > 0).map((a) => ({ a, pct: (a.earned / a.possible) * 100 }));
  if (!items.length) return null;
  const v = items.map((x) => x.pct);
  const mean = avgOf(v);
  const sd = Math.sqrt(avgOf(v.map((p) => (p - mean) ** 2)));
  const sorted = [...v].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const label = sd < 4 ? "Very steady" : sd < 8 ? "Steady" : sd < 15 ? "Up and down" : "All over the place";
  return { items, mean, median, sd, min: sorted[0], max: sorted[sorted.length - 1], label };
}

// Everything with a due date, by day: scored work and work still to come.
function workloadDays(classes) {
  const byDay = new Map();
  const add = (day, item) => { if (day == null) return; if (!byDay.has(day)) byDay.set(day, []); byDay.get(day).push(item); };
  for (const cls of classes) {
    for (const a of cls.assignments) if (!isYours(a) && !a.excluded) add(dayNum(a.due), { cls, name: a.name, possible: a.possible, pending: false });
    for (const p of cls.pending || []) add(dayNum(p.due), { cls, name: p.name, possible: p.possible, pending: true });
  }
  return byDay;
}

// Weeks (Sunday to Saturday) covering the days with work, plus today, at most `maxWeeks` of them.
function calendarGrid(byDay, today, maxWeeks = 22) {
  const days = [...byDay.keys()];
  if (!days.length) return null;
  const dow = (d) => new Date(d * DAY_MS).getUTCDay();
  const lo = Math.min(...days, today), hi = Math.max(...days, today);
  const first = lo - dow(lo), last = hi + (6 - dow(hi));
  let weeks = [];
  for (let d = first; d <= last; d += 7) weeks.push(Array.from({ length: 7 }, (_, i) => d + i));
  if (weeks.length > maxWeeks) weeks = weeks.slice(weeks.length - maxWeeks);
  return { weeks, start: weeks[0][0], end: weeks[weeks.length - 1][6] };
}

// Unscored work: "missing" (marked complete but no score), "upcoming" (due today or later), "waiting" (past due, not graded yet).
function pendingKind(p, today) {
  if (p.complete) return "missing";
  const d = dayNum(p.due);
  return d != null && d >= today ? "upcoming" : "waiting";
}
function upcomingList(classes, today) {
  const missing = [], upcoming = [], waiting = [];
  for (const cls of classes) {
    for (const p of cls.pending || []) {
      const kind = pendingKind(p, today);
      const day = dayNum(p.due);
      const row = { cls, p, day, days: day == null ? null : day - today, kind };
      (kind === "missing" ? missing : kind === "upcoming" ? upcoming : waiting).push(row);
    }
  }
  upcoming.sort((a, b) => a.day - b.day);
  missing.sort((a, b) => (b.day == null ? -1e9 : b.day) - (a.day == null ? -1e9 : a.day));
  waiting.sort((a, b) => (b.day == null ? -1e9 : b.day) - (a.day == null ? -1e9 : a.day));
  return { missing, upcoming, waiting };
}
const countdown = (days) => (days == null ? "" : days < 0 ? `${-days} day${days === -1 ? "" : "s"} ago` : days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);

// How far through the term a class is.
function termInfo(cls, today) {
  const s = dayNum(cls.termStart), e = dayNum(cls.termEnd);
  if (s == null || e == null || e <= s) return null;
  const total = e - s;
  const elapsed = Math.min(Math.max(today - s, 0), total);
  return { start: s, end: e, total, elapsed, left: Math.max(e - today, 0), frac: elapsed / total, over: today > e };
}

// A guess at the final grade if the rest of the term averages `avgPct`, assuming the rest of the term brings in work
// at the same pace and in the same mix as so far. (An estimate: Aeries doesn't say what is still to come.)
function projectFinal(cls, avgPct, today) {
  const real = realOf(cls);
  const now = classPercent(real).pct;
  if (now == null) return null;
  const t = termInfo(real, today);
  if (!t || t.left <= 0 || t.elapsed < 7) return { pct: now, now, t, pace: false };
  const ratio = t.left / t.elapsed;
  let used = 0, sum = 0;
  for (const k of real.categories) {
    const xs = real.assignments.filter((a) => a.catId === k.id && a.possible > 0);
    if (!xs.length) continue;
    const e = xs.reduce((s, a) => s + a.earned, 0), p = xs.reduce((s, a) => s + a.possible, 0);
    const more = p * ratio;
    sum += (((e + (avgPct / 100) * more) / (p + more)) * 100) * k.weight;
    used += k.weight;
  }
  return { pct: used > 0 ? sum / used : now, now, t, pace: true };
}

// What the rest of the term has to average to finish at `target`.
function requiredAvgRest(cls, target, today) {
  const f0 = projectFinal(cls, 0, today), f100 = projectFinal(cls, 100, today);
  if (!f0 || !f100 || !f0.pace) return null;
  if (f0.pct >= target) return { status: "already", avg: 0 };
  if (f100.pct < target) return { status: "impossible", best: f100.pct };
  return { status: "reachable", avg: (100 * (target - f0.pct)) / (f100.pct - f0.pct) };
}

// What you need on ONE more assignment (`possible` points, in category `catId`) to reach `target`.
function neededOnNext(cls, target, catId, possible) {
  const real = realOf(cls);
  const f = (e) => classPercent(withExtra(real, catId, e, possible)).pct;
  const f0 = f(0), f1 = f(possible);
  if (f0 == null || f1 == null) return null;
  if (f0 >= target) return { status: "already", floor: f0 };
  if (f1 < target) return { status: "impossible", best: f1 };
  const earned = (possible * (target - f0)) / (f1 - f0);
  return { status: "reachable", earned, pct: (earned / possible) * 100 };
}

// The lowest percentage above where you are that earns a better grade. `gpaOnly`: one that is worth more grade points.
function nextGradeUp(cls, gpaOnly = false) {
  const pct = classPercent(realOf(cls)).pct;
  if (pct == null) return null;
  const cur = gradeFor(realOf(cls), pct);
  for (let t = Math.floor(pct * 20) / 20 + 0.05; t <= 100.0001; t += 0.05) {
    const at = Math.round(t * 100) / 100;
    const g = estimateGrade(realOf(cls), at);
    const better = gpaOnly ? g.pts > cur.pts + 1e-9 : LETTER_RANK[g.letter] < LETTER_RANK[cur.letter];
    if (better) return { pct: at, letter: g.letter, pts: g.pts, from: cur };
  }
  return null;
}

// For each class: the next grade up, what it would take on a 100-point test in its heaviest category, and what that
// does for your GPA. Easiest first.
function gpaPlanner(classes, weighted) {
  const live = classes.map(realOf).filter((c) => classPercent(c).pct != null);
  const n = live.length;
  const rows = live.map((cls) => {
    const pct = classPercent(cls).pct;
    const cur = gradeFor(cls, pct);
    const nxt = nextGradeUp(cls, true);
    const cat = [...cls.categories].sort((a, b) => b.weight - a.weight)[0];
    const need = nxt && cat ? neededOnNext(cls, nxt.pct, cat.id, 100) : null;
    return { cls, pct, cur, nxt, cat, need, gpaGain: nxt && n ? (nxt.pts - cur.pts) / n : 0 };
  });
  const rank = (r) => (!r.nxt ? 3 : !r.need ? 2 : r.need.status === "reachable" ? 0 : r.need.status === "already" ? 0 : 1);
  return rows.sort((a, b) => rank(a) - rank(b) || ((a.need && a.need.pct) || 0) - ((b.need && b.need.pct) || 0));
}

// GPA if each class ended at the letter in `overrides` (by class id); other classes keep their current letter.
function simulateGpa(classes, overrides, weighted) {
  let total = 0, n = 0;
  for (const c0 of classes) {
    const c = realOf(c0);
    const pct = classPercent(c).pct;
    if (pct == null) continue;
    const L = overrides[c0.id];
    const pts = L && MARK_POINTS[L] != null ? MARK_POINTS[L] : gradeFor(c, pct).pts;
    total += pts + (weighted ? LEVEL_BONUS[c.level] : 0);
    n += 1;
  }
  return n ? total / n : null;
}

// This week compared with a week ago, using real grades only.
function weeklyRecap(classes, weighted, today) {
  const list = classes.map(realOf).map((c) => ({ cls: c, ...classSeries(c) })).filter((s) => s.points.length);
  const per = list.map((s) => {
    const now = s.points[s.points.length - 1].pct;
    const then = [...s.points].reverse().find((p) => p.day <= today - 7);
    const week = s.points.filter((p) => p.day > today - 7 && p.day <= today).flatMap((p) => p.items);
    return { cls: s.cls, now, then: then ? then.pct : null, delta: then ? now - then.pct : null, graded: week.length, perfect: week.filter((i) => i.earned >= i.possible).length };
  });
  const g = gpaSeries(list, weighted);
  const gNow = g.length ? g[g.length - 1].gpa : null;
  const gThen = [...g].reverse().find((p) => p.day <= today - 7);
  return {
    per, gpaNow: gNow, gpaThen: gThen ? gThen.gpa : null, gpaDelta: gThen && gNow != null ? gNow - gThen.gpa : null,
    graded: per.reduce((s, x) => s + x.graded, 0), perfect: per.reduce((s, x) => s + x.perfect, 0),
  };
}

// Every scored assignment, oldest first.
function allScores(classes) {
  const out = [];
  for (const c of classes.map(realOf)) {
    for (const a of c.assignments) if (a.possible > 0) out.push({ day: dayNum(a.due), pct: (a.earned / a.possible) * 100, cls: c, a });
  }
  return out.sort((x, y) => (x.day == null ? 0 : x.day) - (y.day == null ? 0 : y.day));
}
// How many of your most recent assignments in a row scored at least `threshold`.
function hotStreak(classes, threshold = 90) {
  const s = allScores(classes);
  let n = 0;
  for (let i = s.length - 1; i >= 0; i--) { if (s[i].pct >= threshold) n += 1; else break; }
  return n;
}

// Badges you can earn, each with how close you are (0 to 1).
function badgesFor(classes, ctx) {
  const real = classes.map(realOf);
  const scores = allScores(classes);
  const perfects = scores.filter((s) => s.pct >= 100).length;
  const streak = hotStreak(classes);
  const missing = upcomingList(classes, ctx.today).missing.length;
  const live = real.filter((c) => classPercent(c).pct != null);
  const letters = live.map((c) => gradeFor(c, classPercent(c).pct).letter);
  const aClasses = letters.filter((l) => l.startsWith("A")).length;
  const gpa = computeGpa(real, false).gpa;
  const recap = weeklyRecap(classes, ctx.weighted, ctx.today);
  const climb = Math.max(0, ...recap.per.map((p) => (p.delta == null ? 0 : p.delta)));
  const spreads = live.map(scoreSpread).filter((s) => s && s.items.length >= 3);
  const steady = spreads.length > 0 && spreads.every((s) => s.sd < 8);
  const hasGoal = !!(ctx.goals && (ctx.goals.gpa != null || Object.keys(ctx.goals.classes || {}).length > 0));
  const make = (id, name, desc, progress, extra = {}) => ({ id, name, desc, progress: Math.max(0, Math.min(1, progress)), unlocked: progress >= 1, ...extra });
  return [
    make("perfect10", "Perfect Ten", "Get 10 perfect scores", perfects / 10, { detail: `${Math.min(perfects, 10)}/10` }),
    make("roll", "On a Roll", "10 assignments in a row at 90% or better", streak / 10, { detail: `${Math.min(streak, 10)}/10` }),
    make("clean", "Clean Sheet", "No missing assignments", live.length > 0 && missing === 0 ? 1 : 0, { detail: missing === 0 ? "None missing" : `${missing} missing` }),
    make("straightA", "Straight A's", "An A in every class", live.length ? aClasses / live.length : 0, { detail: `${aClasses}/${live.length} classes` }),
    make("comeback", "Comeback", "Raise a class by 3 points in a week", climb / 3, { detail: climb > 0 ? `best this week +${climb.toFixed(1)}` : "keep going" }),
    make("steady", "Steady Eddie", "Every class steady (scores within about 8%)", steady ? 1 : 0, { detail: spreads.length ? `${spreads.filter((s) => s.sd < 8).length}/${spreads.length} steady` : "need 3+ scores" }),
    make("gpa4", "Four Point Oh", "A 4.0 unweighted GPA", gpa == null ? 0 : gpa / 4, { detail: gpa == null ? "" : gpa.toFixed(2) }),
    make("planner", "Planner", "Set a goal", hasGoal ? 1 : 0, { detail: hasGoal ? "Goal set" : "none yet" }),
  ];
}

// Goal progress: one row for the GPA goal and one for each class goal.
function goalStatuses(goals, classes, realGpa) {
  const out = [];
  if (goals.gpa != null && realGpa != null) out.push({ key: "gpa:" + goals.gpa, kind: "gpa", label: "GPA", now: realGpa, goal: goals.gpa, reached: realGpa >= goals.gpa - 1e-9 });
  for (const c of classes) {
    const g = goals.classes[normName(c.name)];
    if (g == null) continue;
    const pct = classPercent(realOf(c)).pct;
    if (pct == null) continue;
    out.push({ key: "cls:" + normName(c.name) + ":" + g, kind: "class", label: c.name, now: pct, goal: g, reached: pct >= g - 1e-9, cls: c });
  }
  return out;
}

// What changed between what is on screen and a fresh read: new or changed grades.
function diffGrades(prevClasses, payload) {
  const out = [];
  for (const n of payload.classes) {
    const old = prevClasses.find((o) => normName(o.name) === normName(n.name));
    if (!old) continue; // a brand new class isn't "a new grade"
    const catName = new Map(old.categories.map((k) => [k.id, normName(k.name)]));
    const had = new Map();
    for (const a of old.assignments) {
      if (isYours(a)) continue;
      const key = catName.get(a.catId) + "|" + normName(a.name);
      if (!had.has(key)) had.set(key, []);
      had.get(key).push(a);
    }
    for (const a of n.assignments) {
      const o = (had.get(normName(a.category) + "|" + normName(a.name)) || []).shift();
      const was = o ? (o.original != null ? o.original : o.earned) : null;
      if (!o) out.push({ kind: "new", className: n.name, name: a.name, earned: a.earned, possible: a.possible });
      else if (was !== a.earned || o.possible !== a.possible) out.push({ kind: "changed", className: n.name, name: a.name, earned: a.earned, possible: a.possible, from: was });
    }
  }
  return out;
}

// Classes whose letter went up between two lists of classes (matched by id).
function letterUps(prevClasses, nextClasses) {
  const out = [];
  for (const nx of nextClasses) {
    const pv = prevClasses.find((p) => p.id === nx.id);
    if (!pv) continue;
    const a = classPercent(realOf(pv)).pct, b = classPercent(realOf(nx)).pct;
    if (a == null || b == null) continue;
    const from = gradeFor(realOf(pv), a), to = gradeFor(realOf(nx), b);
    if (LETTER_RANK[to.letter] < LETTER_RANK[from.letter]) out.push({ className: nx.name, from: from.letter, to: to.letter });
  }
  return out;
}

// Toasts and a confetti size for a refresh that changed something.
function announceChanges(prevClasses, payload) {
  const changes = diffGrades(prevClasses, payload);
  const ups = letterUps(prevClasses, mergeRefresh(prevClasses, payload));
  const toasts = [];
  for (const c of changes.slice(0, 3)) {
    const pct = c.possible > 0 ? (c.earned / c.possible) * 100 : 0;
    toasts.push({ text: `${c.className}: ${c.name} ${c.earned}/${c.possible}${c.kind === "changed" ? " (changed)" : ""}`, tone: pct >= 90 ? "good" : pct < 70 ? "bad" : "plain" });
  }
  if (changes.length > 3) toasts.push({ text: `+${changes.length - 3} more grades`, tone: "plain" });
  for (const u of ups) toasts.push({ text: `${u.className} is now ${u.to}!`, tone: "good" });
  const perfect = changes.filter((c) => c.possible > 0 && c.earned >= c.possible);
  return { changes, ups, toasts, level: ups.length ? "medium" : perfect.length ? "small" : null };
}

// What deserves a celebration, and what to remember, given what has been celebrated so far. The very first look only
// remembers (so what you've already earned isn't a surprise). After that: a new GPA high, a newly reached goal, or a
// newly earned badge. A goal beats a badge when both happen at once. Weighted and unweighted GPA have separate highs.
function planCelebrations(meta, { realGpa, weighted, statuses, badges }) {
  const m = { ...meta, reached: [...meta.reached] };
  const celebrations = [];
  const key = weighted ? "bestGpaW" : "bestGpa";
  if (realGpa != null) {
    if (m[key] == null) m[key] = realGpa;
    else if (realGpa > m[key] + 0.004) {
      celebrations.push({ level: "mega", text: `New GPA high: ${realGpa.toFixed(2)}` });
      m[key] = realGpa;
    }
  }
  const keys = statuses.filter((x) => x.reached).map((x) => x.key).concat(badges.filter((b) => b.unlocked).map((b) => "badge:" + b.id));
  if (!m.reached.includes("init")) {
    m.reached = ["init", ...keys].slice(0, 80);
  } else {
    const fresh = keys.filter((k) => !m.reached.includes(k));
    if (fresh.length) {
      const goalHit = statuses.find((x) => x.reached && fresh.includes(x.key));
      const badgeHit = badges.find((b) => b.unlocked && fresh.includes("badge:" + b.id));
      if (goalHit) celebrations.push({ level: "mega", text: `Goal reached: ${goalHit.kind === "gpa" ? "GPA " + goalHit.goal : goalHit.label + " " + goalHit.goal + "%"}` });
      else if (badgeHit) celebrations.push({ level: "medium", text: `Badge unlocked: ${badgeHit.name}` });
      m.reached = [...m.reached, ...fresh].slice(0, 80);
    }
  }
  return { celebrations, meta: m, changed: JSON.stringify(m) !== JSON.stringify(meta) };
}

// Saved settings, cleaned up so a damaged copy can't break the page.
function sanitizeGoals(g) {
  const out = { gpa: null, classes: {} };
  if (g && typeof g === "object") {
    if (typeof g.gpa === "number" && Number.isFinite(g.gpa) && g.gpa > 0 && g.gpa <= 5.5) out.gpa = g.gpa;
    if (g.classes && typeof g.classes === "object") {
      for (const [k, v] of Object.entries(g.classes).slice(0, 40)) {
        if (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 110) out.classes[String(k).slice(0, 80)] = v;
      }
    }
  }
  return out;
}
function sanitizePrefs(p) {
  const base = { confetti: true, toasts: true, alerts: false };
  if (!p || typeof p !== "object") return base;
  for (const k of Object.keys(base)) if (typeof p[k] === "boolean") base[k] = p[k];
  return base;
}
function sanitizeMeta(m) {
  const out = { bestGpa: null, bestGpaW: null, reached: [] };
  if (m && typeof m === "object") {
    for (const k of ["bestGpa", "bestGpaW"]) if (typeof m[k] === "number" && Number.isFinite(m[k])) out[k] = m[k];
    if (Array.isArray(m.reached)) out.reached = m.reached.filter((x) => typeof x === "string").slice(0, 80).map((x) => x.slice(0, 120));
  }
  return out;
}

/* --------------------------------- confetti --------------------------------- */
// A full-screen confetti show on a single canvas. Three sizes:
//   small  - a cannon from the bottom of the screen (a perfect score)
//   medium - cannons from both bottom corners, a burst in the middle, and a shower from the top (a letter went up)
//   mega   - all of that plus more cannons, bursts, streamers and a gold glitter rain (GPA high, goal reached)

let CONFETTI_ON = true; // switched from the settings
const setConfettiOn = (on) => { CONFETTI_ON = !!on; };

function seededRand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONFETTI_COLORS = ["#ff4d6d", "#ff9f1c", "#ffd23f", "#06d6a0", "#2ec4ff", "#7b5cff", "#ff6bd6", "#ffffff"];
const CONFETTI_GOLD = ["#ffd700", "#ffec8b", "#ffb700", "#fff3b0", "#ffe27a"];
const CONFETTI_LIMIT = 720; // enough for the whole finale, and few enough to stay smooth on a laptop
const DEG = Math.PI / 180;

function confettiParticle(rand, o) {
  const shape = o.shape || ["rect", "rect", "circle", "star", "ribbon"][Math.floor(rand() * 5)];
  const size = (o.size || 1) * (8 + rand() * 7);
  const speed = o.speed[0] + rand() * (o.speed[1] - o.speed[0]);
  const ang = o.angle[0] + rand() * (o.angle[1] - o.angle[0]); // radians: 0 is right, -90 degrees is up
  return {
    x: o.x + (rand() - 0.5) * (o.spreadX || 0), y: o.y + (rand() - 0.5) * (o.spreadY || 0),
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    w: size, h: shape === "rect" ? size * (0.45 + rand() * 0.35) : size, shape,
    color: o.colors[Math.floor(rand() * o.colors.length)],
    rot: rand() * Math.PI * 2, spin: (rand() - 0.5) * 12,
    tilt: rand() * Math.PI * 2, tiltSpeed: 4 + rand() * 9, // the flipping you see as the pieces tumble
    drag: o.drag != null ? o.drag : 0.9 + rand() * 0.6,
    gravity: o.gravity != null ? o.gravity : 700 + rand() * 300,
    wobble: rand() * Math.PI * 2, wobbleSpeed: 3 + rand() * 4, wobbleAmp: o.wobble != null ? o.wobble : 20 + rand() * 30,
    ttl: o.ttl[0] + rand() * (o.ttl[1] - o.ttl[0]),
    age: 0, delay: (o.delay || 0) + (o.delayJitter ? rand() * o.delayJitter : 0), glow: !!o.glow, alive: true,
  };
}

// Everything the show is made of. Pieces with a `delay` stay hidden until it's their turn. The waves are staggered and the
// pieces live only as long as they're visible, so the number on screen at once stays low (that is what keeps it smooth).
function buildConfettiShow(level, W, H, rand = Math.random) {
  const out = [];
  const add = (n, o) => { for (let i = 0; i < n && out.length < CONFETTI_LIMIT; i++) out.push(confettiParticle(rand, o)); };
  const S = Math.max(H, 520); // speeds scale with the screen so it reaches the top on any size
  const cannon = (x, a0, a1, n, delay = 0) => add(n, {
    x, y: H + 12, spreadX: 50, angle: [a0 * DEG, a1 * DEG], speed: [S * 0.95, S * 1.65], colors: CONFETTI_COLORS, ttl: [2.3, 3.5], delay, delayJitter: 0.12,
  });
  const burst = (x, y, n, delay, colors = CONFETTI_COLORS) => add(n, {
    x, y, spreadX: 10, spreadY: 10, angle: [0, Math.PI * 2], speed: [S * 0.3, S * 0.95], drag: 1.7, gravity: 520, colors, ttl: [1.8, 2.8], delay,
  });
  const shower = (n, delay, spread) => add(n, {
    x: W / 2, y: -24, spreadX: W, angle: [70 * DEG, 110 * DEG], speed: [60, 240], gravity: 300, drag: 0.4, wobble: 44, colors: CONFETTI_COLORS, ttl: [3.0, 4.4], delay, delayJitter: spread,
  });

  if (level === "small") {
    cannon(W / 2, -112, -68, 56);
    return out;
  }
  cannon(W * 0.04, -80, -48, 58); // bottom-left, aimed up and to the right
  cannon(W * 0.96, -132, -100, 58); // bottom-right, aimed up and to the left
  burst(W / 2, H * 0.38, 84, 0.3);
  shower(66, 0.5, 1.6);
  if (level !== "mega") return out;
  cannon(W * 0.5, -100, -80, 36, 0.8);
  cannon(W * 0.25, -105, -70, 32, 1.1);
  cannon(W * 0.75, -110, -75, 32, 1.4);
  burst(W * 0.25, H * 0.3, 44, 1.0, CONFETTI_GOLD.concat(CONFETTI_COLORS));
  burst(W * 0.75, H * 0.3, 44, 1.35, CONFETTI_GOLD.concat(CONFETTI_COLORS));
  add(18, { x: W / 2, y: -30, spreadX: W, angle: [75 * DEG, 105 * DEG], speed: [90, 260], gravity: 240, drag: 0.3, wobble: 70, colors: CONFETTI_COLORS, shape: "ribbon", size: 1.5, ttl: [3.4, 4.8], delay: 1.0, delayJitter: 1.8 });
  add(84, { x: W / 2, y: -20, spreadX: W, angle: [80 * DEG, 100 * DEG], speed: [30, 150], gravity: 200, drag: 0.5, wobble: 30, colors: CONFETTI_GOLD, shape: "glitter", size: 0.7, glow: true, ttl: [3.0, 4.6], delay: 1.5, delayJitter: 2.4 });
  return out;
}

// Move everything forward by `dt` seconds. Returns how many pieces are still alive (or waiting for their turn).
function stepConfetti(ps, dt, W, H) {
  let alive = 0;
  for (const p of ps) {
    if (!p.alive) continue;
    p.age += dt;
    if (p.age < p.delay) { alive += 1; continue; }
    const life = p.age - p.delay;
    if (life > p.ttl || p.y > H + 80) { p.alive = false; continue; }
    p.vx *= Math.exp(-p.drag * dt);
    p.vy = p.vy * Math.exp(-p.drag * 0.35 * dt) + p.gravity * dt; // less drag going down, so it still falls
    p.x += (p.vx + Math.sin(p.wobble + life * p.wobbleSpeed) * p.wobbleAmp) * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
    p.tilt += p.tiltSpeed * dt;
    alive += 1;
  }
  return alive;
}

// Draws every piece that's on screen. This is the hot loop, so it is kept cheap: each piece is placed with ONE transform
// (no save/restore), the glow on glitter is a second, larger, see-through copy (no shadow blur, which is very slow), and
// pieces that are off screen are skipped. `k` is the canvas pixel scale.
function drawConfetti(ctx, ps, W, H, k = 1) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W * k, H * k);
  for (const p of ps) {
    if (!p.alive || p.age < p.delay) continue;
    if (p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50) continue;
    const life = p.age - p.delay;
    const fade = life > p.ttl * 0.7 ? Math.max(0, 1 - (life - p.ttl * 0.7) / (p.ttl * 0.3)) : 1;
    const flicker = p.shape === "glitter" ? 0.55 + 0.45 * Math.sin(life * 18 + p.wobble) : 1;
    const alpha = fade * flicker;
    if (alpha <= 0.01) continue;
    const cr = Math.cos(p.rot), sr = Math.sin(p.rot), sy = Math.cos(p.tilt); // rotate, then squash (the 3D tumble)
    ctx.setTransform(cr * k, sr * k, -sr * sy * k, cr * sy * k, p.x * k, p.y * k);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
    if (p.shape === "circle") {
      ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill();
    } else if (p.shape === "star") {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = (i % 2 ? 0.45 : 1) * p.w * 0.7;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
    } else if (p.shape === "ribbon") {
      ctx.lineWidth = Math.max(2, p.w / 3);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-p.w * 1.4, 0); ctx.bezierCurveTo(-p.w * 0.5, -p.w * 0.9, p.w * 0.5, p.w * 0.9, p.w * 1.4, 0); ctx.stroke();
    } else if (p.shape === "glitter") {
      if (p.glow) { // a soft halo: the same diamond, bigger and faint
        ctx.globalAlpha = alpha * 0.28;
        ctx.beginPath(); ctx.moveTo(0, -p.w * 1.5); ctx.lineTo(p.w * 0.75, 0); ctx.lineTo(0, p.w * 1.5); ctx.lineTo(-p.w * 0.75, 0); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = alpha;
      }
      ctx.beginPath(); ctx.moveTo(0, -p.w * 0.7); ctx.lineTo(p.w * 0.35, 0); ctx.lineTo(0, p.w * 0.7); ctx.lineTo(-p.w * 0.35, 0); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
  }
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.globalAlpha = 1;
}

// A slow computer starts dropping frames when there is too much to draw. This takes some pieces out: first a third of the
// ones still waiting their turn, then glitter, then every other remaining piece, but never below `floor` on screen.
// Returns how many pieces it removed.
function thinConfetti(ps, frac, floor) {
  let visible = 0;
  for (const p of ps) if (p.alive && p.age >= p.delay) visible += 1;
  let removed = 0;
  let waiting = 0;
  for (const p of ps) if (p.alive && p.age < p.delay && waiting++ % 3 === 0) { p.alive = false; removed += 1; }
  let kill = Math.min(Math.ceil(visible * frac), Math.max(0, visible - floor));
  for (const p of ps) {
    if (kill <= 0) break;
    if (p.alive && p.age >= p.delay && p.shape === "glitter") { p.alive = false; kill -= 1; removed += 1; }
  }
  for (let i = 0; kill > 0 && i < ps.length; i++) {
    const p = ps[i];
    if (p.alive && p.age >= p.delay && i % 2 === 0) { p.alive = false; kill -= 1; removed += 1; }
  }
  return removed;
}

let confettiShow = null;
// Starts a show. Returns { add, stop, done, stats } or null (confetti off, reduced motion, or no screen to draw on).
// `env` is for tests: { doc, win, rand, raf, ignorePrefs }.
function launchConfetti(level = "medium", env = {}) {
  const doc = env.doc || (typeof document !== "undefined" ? document : null);
  const win = env.win || (typeof window !== "undefined" ? window : null);
  if (!doc || !win) return null;
  if (!CONFETTI_ON && !env.ignorePrefs) return null;
  if (!env.ignorePrefs && win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  const W = win.innerWidth || 1000, H = win.innerHeight || 700;
  const fresh = buildConfettiShow(level, W, H, env.rand || Math.random);
  if (confettiShow) { confettiShow.add(fresh); return confettiShow; } // a second celebration joins the first

  const canvas = doc.createElement("canvas");
  Object.assign(canvas.style, { position: "fixed", left: "0", top: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "2147483000" });
  canvas.setAttribute && canvas.setAttribute("aria-hidden", "true");
  // One canvas pixel per screen pixel, even on a retina display: four times fewer pixels to fill, and confetti is chunky
  // and moving, so it still looks sharp. This matters a lot for smoothness.
  const k = 1;
  canvas.width = Math.round(W * k);
  canvas.height = Math.round(H * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  doc.body.appendChild(canvas);

  const raf = env.raf || ((f) => win.requestAnimationFrame(f));
  let ps = fresh;
  let last = null;
  let stopped = false;
  let frames = 0;
  let slow = 16.7; // a running average of how long frames take, in ms
  let lastThin = -1e9;
  let thinned = 0;
  let resolveDone = () => {};
  const done = new Promise((r) => { resolveDone = r; });
  const finish = () => {
    if (stopped) return;
    stopped = true;
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    confettiShow = null;
    resolveDone();
  };
  const frame = (now) => {
    if (stopped) return;
    const ms = last == null ? 16.7 : Math.max(0, now - last);
    last = now;
    slow = slow * 0.8 + Math.min(ms, 100) * 0.2;
    const dt = Math.min(0.05, ms / 1000); // a long frame jumps ahead a little instead of going slow-motion
    frames += 1;
    const alive = stepConfetti(ps, dt, W, H);
    drawConfetti(ctx, ps, W, H, k);
    if (slow > 24 && now - lastThin > 220) { thinned += thinConfetti(ps, 0.2, 90); lastThin = now; }
    if (alive === 0) finish();
    else {
      if (frames % 20 === 0) ps = ps.filter((p) => p.alive);
      raf(frame);
    }
  };
  raf(frame);
  confettiShow = {
    add: (more) => { ps.push(...more); },
    stop: finish,
    done,
    stats: () => ({ frames, thinned, visible: ps.filter((p) => p.alive && p.age >= p.delay).length, slow, maxAge: ps.reduce((m, p) => (p.alive && p.age >= p.delay ? Math.max(m, p.age) : m), 0) }),
  };
  return confettiShow;
}

/* ---------------------------------- toasts ---------------------------------- */

function ToastStack({ toasts, mode, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: "fixed", left: 14, bottom: 14, zIndex: 66, display: "flex", flexDirection: "column", gap: 8,
      maxWidth: "min(360px, 92vw)", fontFamily: "'Inter', sans-serif",
    }}>
      {toasts.map((t) => (
        <button key={t.id} onClick={() => onDismiss(t.id)} title="Dismiss" style={{
          textAlign: "left", cursor: "pointer", border: "none", borderRadius: 10, padding: "9px 12px 9px 14px", fontSize: 12.5, lineHeight: 1.4,
          background: mode === "dark" ? "#22453A" : "#FFFFFF", color: mode === "dark" ? "#F5F1E8" : "#2B2B26",
          boxShadow: "0 8px 22px rgba(0,0,0,.22)",
          borderLeft: `4px solid ${t.tone === "good" ? "#2f7d4f" : t.tone === "bad" ? "#c0392b" : "#8b897f"}`,
        }}>
          {t.text}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- share card -------------------------------- */

// Trims text with an ellipsis until it fits.
function fitText(ctx, text, maxW) {
  let t = String(text);
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

// Draws the share picture. `opts`: hideNames (rows say "Class 1"...), hideGrades (no numbers per class), hideClasses (just the GPA).
function drawShareCard(ctx, W, H, data, opts = {}) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#143026");
  g.addColorStop(1, "#2E5647");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 2;
  for (let y = 120; y < H; y += 56) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#F5F1E8";
  ctx.font = "700 46px Lora, Georgia, serif";
  ctx.fillText("Ledger", 72, 112);
  ctx.fillStyle = "rgba(245,241,232,0.7)";
  ctx.font = "500 26px Inter, system-ui, sans-serif";
  ctx.fillText(data.when || "", 72, 152);

  ctx.fillStyle = "#F5F1E8";
  ctx.font = "700 220px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText(data.gpa == null ? "—" : data.gpa.toFixed(2), 64, 400);
  ctx.fillStyle = "rgba(245,241,232,0.78)";
  ctx.font = "600 34px Inter, system-ui, sans-serif";
  ctx.fillText(data.weighted ? "weighted GPA" : "GPA", 76, 458);

  const rows = opts.hideClasses ? [] : data.rows;
  const rowH = rows.length > 8 ? 58 : 70;
  rows.slice(0, 10).forEach((r, i) => {
    const y = 560 + i * rowH;
    ctx.fillStyle = "#F5F1E8";
    ctx.font = "600 32px Inter, system-ui, sans-serif";
    ctx.fillText(fitText(ctx, opts.hideNames ? `Class ${i + 1}` : r.name, opts.hideGrades ? W - 144 : W - 420), 72, y);
    if (!opts.hideGrades) {
      ctx.textAlign = "right";
      ctx.font = "700 32px 'JetBrains Mono', ui-monospace, monospace";
      ctx.fillText(`${r.pct == null ? "—" : r.pct.toFixed(1) + "%"}  ${r.letter}`, W - 72, y);
      ctx.textAlign = "left";
    }
  });
  ctx.fillStyle = "rgba(245,241,232,0.55)";
  ctx.font = "500 24px Inter, system-ui, sans-serif";
  ctx.fillText("made with Ledger", 72, H - 56);
}

function ShareCard({ data, mode, accent }) {
  const ink = mode === "dark" ? "#F5F1E8" : "#2B2B26";
  const sub = mode === "dark" ? "#A9A79C" : "#6B6B63";
  const border = mode === "dark" ? "#2E5647" : "#EAE3D3";
  const [opts, setOpts] = useState({ hideNames: false, hideGrades: false, hideClasses: false });
  const [note, setNote] = useState("");
  const ref = useRef(null);
  const SIZE = 1080;

  useEffect(() => {
    const c = ref.current;
    const ctx = c && c.getContext && c.getContext("2d");
    if (ctx) drawShareCard(ctx, SIZE, SIZE, data, opts);
  }, [data, opts]);

  const toBlob = () => new Promise((resolve) => ref.current.toBlob(resolve, "image/png"));
  const download = async () => {
    const blob = await toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "my-gpa.png"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": toBlob() })]);
      setNote("Copied. Paste it anywhere.");
    } catch {
      setNote("Couldn't copy here. Use Download instead.");
    }
  };
  const tick = (key, label) => (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: ink, cursor: "pointer" }}>
      <input type="checkbox" checked={opts[key]} onChange={(e) => setOpts((o) => ({ ...o, [key]: e.target.checked }))} />
      {label}
    </label>
  );
  const btn = { padding: "8px 14px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: ink, fontSize: 12.5, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "inline-flex", gap: 6, alignItems: "center" };
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 10 }}>
        {tick("hideNames", "Hide class names")}
        {tick("hideGrades", "Hide each class's grade")}
        {tick("hideClasses", "Just the GPA")}
      </div>
      <canvas ref={ref} width={SIZE} height={SIZE} style={{ width: "100%", maxWidth: 360, borderRadius: 14, border: `1px solid ${border}`, display: "block" }} aria-label="Share card preview" />
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={download} style={{ ...btn, background: accent, color: "#fff", border: "none", fontWeight: 600 }}><Download size={14} /> Download</button>
        <button onClick={copy} style={btn}><Copy size={14} /> Copy image</button>
        {note && <span style={{ fontSize: 11.5, color: sub }}>{note}</span>}
      </div>
      <div style={{ fontSize: 11, color: sub, marginTop: 8 }}>Only what's ticked above is drawn. Nothing is uploaded: the picture is made right here in your browser.</div>
    </div>
  );
}

/* ---------------------------------- misc ui --------------------------------- */

function Stamp({ letter, size = 56, accent, mode }) {
  const ink = letter === "F" ? "#C0392B" : accent;
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        border: `2.5px solid ${ink}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transform: "rotate(-6deg)",
        color: ink,
        fontFamily: "'Lora', serif",
        fontWeight: 700,
        fontSize: size * 0.36,
        flexShrink: 0,
        background: mode === "dark" ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.4)",
      }}
    >
      {letter}
    </div>
  );
}

function Sparkline({ points, accent, width = 120, height = 32 }) {
  if (!points.length) {
    return <div style={{ height, display: "flex", alignItems: "center", fontSize: 11, opacity: 0.5 }}>no data yet</div>;
  }
  const min = Math.min(60, ...points);
  const max = Math.max(100, ...points);
  const range = max - min || 1;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((p, i) => [i * stepX, height - ((p - min) / range) * height]);
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <path d={path} fill="none" stroke={accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={accent} />
    </svg>
  );
}

/* --------------------------------- screens ---------------------------------- */

/* --------------------------- saved on this device --------------------------- */
// Imported grades and settings are kept in this browser only (localStorage), so
// you import once and Ledger remembers you. Demo data is never saved.
const DATA_KEY = "ledger.data.v1";

function loadSavedData() {
  try {
    const d = JSON.parse(localStorage.getItem(DATA_KEY));
    if (!d || d.v !== 1 || !Array.isArray(d.classes) || d.classes.length < 1 || d.classes.length > 30) return null;
    if (!d.source || typeof d.source.host !== "string" || typeof d.source.readAt !== "string") return null;
    const num = (v) => typeof v === "number" && Number.isFinite(v);
    const ok = d.classes.every((c) =>
      c && num(c.id) && typeof c.name === "string" && Object.prototype.hasOwnProperty.call(LEVEL_BONUS, c.level) &&
      Array.isArray(c.categories) && c.categories.every((k) => k && num(k.id) && typeof k.name === "string" && num(k.weight)) &&
      Array.isArray(c.assignments) && c.assignments.every((a) =>
        a && num(a.id) && num(a.catId) && typeof a.name === "string" && num(a.earned) && num(a.possible))
    );
    if (!ok) return null;
    // keep newly made ids from colliding with the saved ones
    let m = uid;
    for (const c of d.classes) {
      m = Math.max(m, c.id + 1);
      for (const k of c.categories) m = Math.max(m, k.id + 1);
      for (const a of c.assignments) m = Math.max(m, a.id + 1);
    }
    uid = m;
    return d;
  } catch {
    return null;
  }
}

function formatStamp(source) {
  try {
    if (source && source.readAt) {
      const d = new Date(source.readAt);
      if (!Number.isNaN(d.getTime())) {
        return " · updated " + d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      }
    }
  } catch { /* ignore */ }
  return "";
}

/* ------------------------- Aeries school directory -------------------------- */
// Only districts whose portal address has been checked belong here.
// Everyone else can paste their own portal link on the login screen.
const AERIES_DISTRICTS = [
  {
    id: "mvla",
    name: "Mountain View–Los Altos Union High School District",
    schools: ["Mountain View High School", "Los Altos High School", "Alta Vista High School"],
    portal: "https://mvla.aeries.net/student/LoginParent.aspx",
  },
  // The three below were checked: each address shows that district's name on its Aeries sign-in page.
  {
    id: "cuhsd",
    name: "Campbell Union High School District",
    schools: ["Branham High School", "Campbell High School", "Del Mar High School", "Leigh High School", "Prospect High School", "Westmont High School"],
    portal: "https://campbelluhsd.aeries.net/student/LoginParent.aspx",
  },
  {
    id: "lgsuhsd",
    name: "Los Gatos-Saratoga Joint Union High School District",
    schools: ["Los Gatos High School", "Saratoga High School"],
    portal: "https://lgsuhsd.asp.aeries.net/student/loginparent.aspx",
  },
  {
    id: "ousd",
    name: "Oakland Unified School District",
    schools: ["Oakland High School", "Oakland Technical High School", "Skyline High School", "Castlemont High School", "Fremont High School", "McClymonds High School"],
    portal: "https://oaklandusd.aeries.net/student/LoginParent.aspx",
  },
];

// Districts that use Aeries but whose sign-in address hasn't been checked here. Picking one explains where to find it.
const AERIES_HELP = [
  { id: "fusd", name: "Fremont Unified School District", schools: ["Mission San Jose High School", "Irvington High School", "American High School", "Washington High School", "Kennedy High School"], where: "fremontunified.org/portals" },
  { id: "scusd", name: "Santa Clara Unified School District", schools: ["Santa Clara High School", "Wilcox High School", "Adrian Wilcox High School"], where: "santaclarausd.org (Parent Portal page)" },
  { id: "smuhsd", name: "San Mateo Union High School District", schools: ["Aragon High School", "Burlingame High School", "Hillsdale High School", "San Mateo High School", "Capuchino High School"], where: "smuhsd.org (family portal page)" },
  { id: "musd", name: "Milpitas Unified School District", schools: ["Milpitas High School", "Calaveras Hills High School"], where: "your district website's parent portal page" },
];

// The folder the portal lives in on its host, e.g. "/student/" or "/Student/".
function baseOfPortal(portal) {
  try {
    const m = new URL(portal).pathname.match(/^(\/(?:[A-Za-z0-9_.-]+\/)+)/);
    return m && !m[1].includes("..") ? m[1] : "/student/";
  } catch { return "/student/"; }
}

// Search by words: every word has to appear in the district name or one of its schools.
function searchDirectory(query, list) {
  const words = (query || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  return list.filter((d) => {
    const hay = (d.name + " " + d.schools.join(" ") + " " + d.id).toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

// Turns whatever the person pasted into a safe https sign-in address.
function portalFromLink(raw) {
  const text = (raw || "").trim();
  if (!text) return { error: "Paste your school's Aeries link first." };
  let u;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : "https://" + text);
  } catch {
    return { error: "That doesn't look like a web address." };
  }
  if (u.protocol !== "https:") return { error: "Use the secure https:// address of your portal." };
  if (!u.hostname.includes(".") || u.username || u.password) return { error: "That doesn't look like a portal address." };
  // Keep the portal's folder (/student/, /Student/, /parent/ ...); with no folder, assume /student/.
  const keepPath = u.pathname !== "/" && baseOfPortal(u.origin + u.pathname) !== "/student/" || /\/student\//i.test(u.pathname);
  return {
    portal: u.origin + (keepPath ? u.pathname + (u.pathname.endsWith("/") ? "LoginParent.aspx" : "") : "/student/LoginParent.aspx"),
    host: u.hostname,
    official: u.hostname.endsWith(".aeries.net"),
  };
}

function loadSchool() {
  try {
    const s = JSON.parse(localStorage.getItem("ledger.school"));
    return s && typeof s.portal === "string" && s.portal.startsWith("https://") ? s : null;
  } catch {
    return null;
  }
}
function saveSchool(s) {
  try { localStorage.setItem("ledger.school", JSON.stringify(s)); } catch { /* storage blocked: fine */ }
}

function LoginScreen({ onLogin, mode, accent, ext, sync, onGetGrades }) {
  const paper = mode === "dark" ? "#22453A" : "#FBF8F1";
  const ink = mode === "dark" ? "#F5F1E8" : "#2B2B26";
  const sub = mode === "dark" ? "#A9A79C" : "#6B6B63";
  const line = mode === "dark" ? "#3A5C4F" : "#DDD5C4";

  const [chosen, setChosen] = useState(loadSchool);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const busy = !!sync && (sync.phase === "starting" || sync.phase === "login" || sync.phase === "reading");

  const q = query.trim().toLowerCase();
  const matches = searchDirectory(q, AERIES_DISTRICTS);
  const helpMatches = searchDirectory(q, AERIES_HELP);

  const pick = (school) => {
    setChosen(school); saveSchool(school);
    setQuery(""); setLink(""); setCustom(false); setError("");
  };
  const chooseDistrict = (d) => { setNote(""); pick({ name: d.name, portal: d.portal, host: new URL(d.portal).hostname, base: baseOfPortal(d.portal) }); };
  const useLink = () => {
    const r = portalFromLink(link);
    if (r.error) { setError(r.error); return; }
    setNote(r.official ? "" : "That isn't an aeries.net address. Make sure it's the official portal link from your school's website.");
    pick({ name: r.host, portal: r.portal, host: r.host, base: baseOfPortal(r.portal) });
  };
  const change = () => { setChosen(null); saveSchool(null); setNote(""); };

  const field = {
    width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${line}`,
    background: mode === "dark" ? "#1B3A2F" : "#fff", color: ink, fontSize: 13.5,
    fontFamily: "'Inter', sans-serif",
  };
  const ghost = {
    background: "transparent", border: "none", color: sub, fontSize: 12, cursor: "pointer",
    fontFamily: "'Inter', sans-serif", padding: 0, textDecoration: "underline",
  };

  return (
    <div style={{ minHeight: 560, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{
        width: "100%", maxWidth: 400, background: paper, borderRadius: 18,
        border: `1px solid ${mode === "dark" ? "#3A5C4F" : "#E4DEC0"}`,
        padding: "2rem 2rem 1.75rem", boxShadow: mode === "dark" ? "none" : "0 12px 30px rgba(43,43,38,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: accent,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <GraduationCap size={22} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 19, color: ink }}>Ledger</div>
            <div style={{ fontSize: 11.5, color: sub, letterSpacing: 0.3 }}>what-if grades, real GPA</div>
          </div>
        </div>

        {!chosen ? (
          <>
            <p style={{ fontSize: 13, color: ink, fontWeight: 600, margin: "16px 0 8px" }}>Which school do you go to?</p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Start typing your school or district"
              aria-label="School or district"
              style={field}
            />
            {matches.map((d) => (
              <button key={d.id} onClick={() => chooseDistrict(d)} style={{
                display: "block", width: "100%", textAlign: "left", marginTop: 8, padding: "10px 12px",
                borderRadius: 10, border: `1px solid ${line}`, background: mode === "dark" ? "#1B3A2F" : "#fff",
                color: ink, cursor: "pointer", fontFamily: "'Inter', sans-serif",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                <div style={{ fontSize: 11, color: sub, marginTop: 2 }}>{d.schools.join(" · ")}</div>
              </button>
            ))}
            {helpMatches.map((d) => (
              <div key={d.id} style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, border: `1px dashed ${line}`, color: ink }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                <div style={{ fontSize: 11.5, color: sub, marginTop: 3, lineHeight: 1.5 }}>
                  This district uses Aeries, but Ledger hasn't checked its sign-in address yet. Find the Aeries link at {d.where}, then choose "My school isn't listed" below and paste it.
                </div>
              </div>
            ))}
            {q.length >= 2 && matches.length === 0 && helpMatches.length === 0 && (
              <p style={{ fontSize: 11.5, color: sub, margin: "8px 0 0", lineHeight: 1.5 }}>
                No match in the list yet. Choose "My school isn't listed" below and paste your school's Aeries link.
              </p>
            )}
            <div style={{ marginTop: 12 }}>
              <button onClick={() => { setCustom((c) => !c); setError(""); }} style={ghost}>
                My school isn't listed
              </button>
            </div>
            {custom && (
              <div style={{ marginTop: 10 }}>
                <input
                  value={link}
                  onChange={(e) => { setLink(e.target.value); setError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") useLink(); }}
                  placeholder="e.g. yourdistrict.aeries.net"
                  aria-label="Aeries portal link"
                  style={field}
                />
                {error && <p style={{ fontSize: 11.5, color: "#B3432F", margin: "6px 0 0" }}>{error}</p>}
                <button onClick={useLink} style={{
                  marginTop: 8, width: "100%", padding: "9px 0", borderRadius: 10, border: "none",
                  background: accent, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                }}>
                  Use this link
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{
              marginTop: 16, padding: "12px 14px", borderRadius: 12, border: `1px solid ${line}`,
              background: mode === "dark" ? "#1B3A2F" : "#fff",
            }}>
              <div style={{ fontSize: 10.5, color: sub, letterSpacing: 0.4, textTransform: "uppercase" }}>Your school's portal</div>
              <div style={{ fontSize: 13.5, color: ink, fontWeight: 600, marginTop: 3 }}>{chosen.name}</div>
              <div style={{ fontSize: 11.5, color: sub, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{chosen.host}</div>
              <div style={{ marginTop: 6 }}><button onClick={change} style={ghost}>Change school</button></div>
            </div>
            {note && <p style={{ fontSize: 11.5, color: "#B3432F", margin: "8px 0 0", lineHeight: 1.5 }}>{note}</p>}
            {ext ? (
              <>
                <button
                  onClick={() => onGetGrades(chosen.host)}
                  disabled={busy}
                  style={{
                    marginTop: 12, width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: accent,
                    color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: busy ? "default" : "pointer",
                    opacity: busy ? 0.7 : 1, fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {busy ? "Working…" : "Get my grades from Aeries"}
                </button>
                <p style={{ fontSize: 11.5, color: sub, margin: "10px 0 0", lineHeight: 1.5 }}>
                  Ledger opens Aeries in a new tab. Sign in there with your school Google account, then Ledger reads your grades and closes the tab.
                  You only do this once. After that Ledger refreshes by itself, and asks you to sign in again only if Aeries has logged you out.
                  Ledger never sees your password.
                </p>
                <p style={{ fontSize: 11.5, margin: "8px 0 0" }}>
                  <a href={chosen.portal} target="_blank" rel="noopener noreferrer" style={{ color: sub }}>Just open the Aeries sign-in page</a>
                </p>
              </>
            ) : (
              <>
                <a
                  href={chosen.portal}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginTop: 12, width: "100%", padding: "11px 0", borderRadius: 10, background: accent, color: "#fff",
                    fontWeight: 600, fontSize: 13.5, textDecoration: "none", display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 8, fontFamily: "'Inter', sans-serif",
                  }}
                >
                  Open Aeries sign-in <ArrowUpRight size={15} />
                </a>
                <p style={{ fontSize: 11.5, color: sub, margin: "10px 0 0", lineHeight: 1.5 }}>
                  Sign in on Aeries with your school Google account. That happens on your school's site, so Ledger never sees your password.
                </p>
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${line}`, background: mode === "dark" ? "#1B3A2F" : "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={import.meta.env.BASE_URL + "ledger-icon.png"} alt="" width={34} height={34} style={{ borderRadius: 8 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: ink }}>First, add the Ledger Grade Sync extension</div>
                      <div style={{ fontSize: 11, color: sub }}>One time, about a minute. Needed to bring your grades in.</div>
                    </div>
                  </div>
                  <ol style={{ fontSize: 11.5, color: sub, margin: "10px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
                    <li>
                      <a href={import.meta.env.BASE_URL + "ledger-grade-sync.zip"} download style={{ color: accent, fontWeight: 600 }}>Download the extension</a>, then unzip it.
                    </li>
                    <li>In Chrome, open <b>chrome://extensions</b> and turn on <b>Developer mode</b> (top right).</li>
                    <li>Click <b>Load unpacked</b> and pick the unzipped folder.</li>
                    <li>Come back here and reload this page.</li>
                  </ol>
                  <p style={{ fontSize: 11, color: sub, margin: "8px 0 0", lineHeight: 1.5 }}>
                    Chrome will call it a developer extension because it isn't in the Chrome Web Store yet. It only runs on aeries.net and this page, only reads your grades, and never sees your password.
                  </p>
                </div>
              </>
            )}
          </>
        )}

        <button
          onClick={onLogin}
          style={{
            marginTop: 16, width: "100%", padding: "9px 0", borderRadius: 10,
            background: "transparent", border: `1px solid ${sub}55`, color: sub, fontSize: 12.5,
            cursor: "pointer", fontFamily: "'Inter', sans-serif",
          }}
        >
          Just show me a demo gradebook
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- timeline --------------------------------- */

const TL_COLORS = ["#2f6f5e", "#c0392b", "#2c6fbb", "#d68910", "#7d3c98", "#17a589", "#b03a6f", "#5d6d7e"];

function niceStep(span, target) {
  const raw = Math.max(span, 1e-9) / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

function TimelineView({ classes, mode, accent, weighted, onOpenClass }) {
  const ink = mode === "dark" ? "#F5F1E8" : "#2B2B26";
  const sub = mode === "dark" ? "#A9A79C" : "#6B6B63";
  const border = mode === "dark" ? "#2E5647" : "#EAE3D3";
  const surface = mode === "dark" ? "#22453A" : "#FFFFFF";
  const [scope, setScope] = useState("grades"); // "grades" | "gpa"
  const [range, setRange] = useState("all"); // "all" | "30" | "14"
  const [hidden, setHidden] = useState([]); // class ids switched off in the legend
  const [hover, setHover] = useState(null); // { lineId, i }

  const all = useMemo(
    () => classes.map((c, i) => ({ cls: c, color: TL_COLORS[i % TL_COLORS.length], ...classSeries(c) })).filter((s) => s.dated && s.points.length > 0),
    [classes]
  );
  const gpaAll = useMemo(() => gpaSeries(all, weighted), [all, weighted]);

  const card = { background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 14 };
  const chip = (on) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 16, cursor: "pointer",
    border: `1px solid ${on ? accent : border}`, background: on ? `${accent}1f` : "transparent", color: on ? ink : sub,
    fontSize: 12, fontFamily: "'Inter', sans-serif", fontWeight: on ? 600 : 500,
  });

  if (all.length === 0) {
    return (
      <div style={{ padding: "16px 18px 30px", maxWidth: 760 }}>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 19, fontWeight: 700, color: ink, marginBottom: 12 }}>Timeline</div>
        <div style={{ ...card, color: sub, fontSize: 13, lineHeight: 1.6 }}>
          There are no dates to draw yet. Grades imported before dates were supported get them on the next refresh: reload the Ledger Importer
          extension, then click <b>Refresh now</b> on the Classes tab.
        </div>
      </div>
    );
  }

  // "today" is the last real date, so what-ifs land after it
  let lastReal = -Infinity;
  for (const s of all) for (const p of s.points) if (!p.whatIf && p.day > lastReal) lastReal = p.day;
  if (lastReal === -Infinity) lastReal = Math.max(...all.flatMap((s) => s.points.map((p) => p.day)));
  const minDay = range === "all" ? -Infinity : lastReal - Number(range);

  const lines = scope === "grades"
    ? all.filter((s) => !hidden.includes(s.cls.id)).map((s) => ({
        id: s.cls.id, name: s.cls.name, color: s.color,
        pts: s.points.filter((p) => p.day >= minDay).map((p) => ({ day: p.day, v: p.pct, p })),
      }))
    : [{ id: "gpa", name: weighted ? "Weighted GPA" : "GPA", color: accent, pts: gpaAll.filter((p) => p.day >= minDay).map((p) => ({ day: p.day, v: p.gpa, p })) }];
  const flat = lines.flatMap((l) => l.pts);

  const W = 720, H = 320, PAD = { l: 46, r: 18, t: 16, b: 30 };
  let body = null;
  if (flat.length > 0) {
    let xMin = Math.min(...flat.map((q) => q.day));
    let xMax = Math.max(...flat.map((q) => q.day));
    if (xMin === xMax) { xMin -= 3; xMax += 3; }
    const lo = Math.min(...flat.map((q) => q.v)), hi = Math.max(...flat.map((q) => q.v));
    const isPct = scope === "grades";
    const yMin = isPct ? Math.max(0, Math.floor((lo - 3) / 5) * 5) : Math.max(0, Math.floor((lo - 0.2) * 2) / 2);
    const yMax = isPct ? Math.max(100, Math.ceil(hi / 5) * 5) : Math.max(4, Math.ceil(hi * 2) / 2);
    const sx = (d) => PAD.l + ((d - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
    const sy = (v) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
    const step = niceStep(yMax - yMin, 5);
    const yTicks = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-9; v += step) yTicks.push(Math.round(v * 100) / 100);
    const xTicks = Array.from({ length: 5 }, (_, i) => Math.round(xMin + ((xMax - xMin) * i) / 4));
    const fmtV = (v) => (isPct ? v.toFixed(1) + "%" : v.toFixed(2));

    const onMove = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
      let best = null;
      for (const l of lines) {
        for (let i = 0; i < l.pts.length; i++) {
          const d = Math.hypot(sx(l.pts[i].day) - x, (sy(l.pts[i].v) - y) * 0.6);
          if (!best || d < best.d) best = { d, lineId: l.id, i };
        }
      }
      setHover(best && best.d < 36 ? { lineId: best.lineId, i: best.i } : null);
    };

    const hl = hover && lines.find((l) => l.id === hover.lineId);
    const hp = hl && hl.pts[hover.i];
    const hx = hp ? (sx(hp.day) / W) * 100 : 0, hy = hp ? (sy(hp.v) / H) * 100 : 0;

    body = (
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Grades over time"
          onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onMove} style={{ display: "block", touchAction: "pan-y" }}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} stroke={border} strokeWidth="1" />
              <text x={PAD.l - 8} y={sy(v) + 4} textAnchor="end" fontSize="11" fill={sub} fontFamily="'JetBrains Mono', monospace">{isPct ? v : v.toFixed(1)}</text>
            </g>
          ))}
          {xTicks.map((d, i) => (
            <text key={i} x={sx(d)} y={H - 8} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} fontSize="11" fill={sub} fontFamily="'Inter', sans-serif">{dayLabel(d)}</text>
          ))}
          {lines.map((l) => {
            const real = l.pts.filter((q) => q.day <= lastReal);
            const future = l.pts.filter((q) => q.day > lastReal);
            const path = (arr) => arr.map((q, i) => (i ? "L" : "M") + sx(q.day).toFixed(1) + " " + sy(q.v).toFixed(1)).join(" ");
            const bridge = future.length && real.length ? [real[real.length - 1], ...future] : future;
            return (
              <g key={l.id}>
                {real.length > 1 && <path d={path(real)} fill="none" stroke={l.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />}
                {bridge.length > 1 && <path d={path(bridge)} fill="none" stroke={l.color} strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />}
                {l.pts.map((q, i) => (
                  <circle key={i} cx={sx(q.day)} cy={sy(q.v)} r={hover && hover.lineId === l.id && hover.i === i ? 5.5 : 3.4}
                    fill={q.p.whatIf ? surface : l.color} stroke={l.color} strokeWidth="1.8" />
                ))}
              </g>
            );
          })}
        </svg>
        {hp && (
          <div style={{
            position: "absolute", left: `${Math.min(86, Math.max(14, hx))}%`, top: `${hy}%`,
            transform: hy < 30 ? "translate(-50%, 14px)" : "translate(-50%, calc(-100% - 12px))", pointerEvents: "none",
            background: mode === "dark" ? "#1B3A2F" : "#fff", border: `1px solid ${hl.color}`, borderRadius: 10, padding: "8px 10px",
            fontSize: 11.5, color: ink, fontFamily: "'Inter', sans-serif", boxShadow: "0 8px 20px rgba(0,0,0,.18)", minWidth: 150, maxWidth: 240, zIndex: 5,
          }}>
            <div style={{ fontWeight: 700, color: hl.color }}>{hl.name}</div>
            <div style={{ color: sub, marginBottom: 4 }}>{dayLabel(hp.day)}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14 }}>
              {fmtV(hp.v)}
              {hp.p.delta != null && Math.abs(hp.p.delta) > 0.005 && (
                <span style={{ marginLeft: 6, fontSize: 11, color: hp.p.delta > 0 ? "#2f7d4f" : "#c0392b" }}>
                  {hp.p.delta > 0 ? "▲ +" : "▼ "}{hp.p.delta.toFixed(isPct ? 1 : 2)}
                </span>
              )}
            </div>
            {isPct && hp.p.items.slice(0, 3).map((it, k) => (
              <div key={k} style={{ marginTop: 3, color: sub }}>
                {it.name} · {it.earned}/{it.possible}{it.whatIf ? " (what-if)" : ""}
              </div>
            ))}
            {isPct && hp.p.items.length > 3 && <div style={{ color: sub }}>+{hp.p.items.length - 3} more</div>}
          </div>
        )}
      </div>
    );
  }

  const feed = all
    .flatMap((s) => s.points
      .filter((p) => p.delta != null && p.items.some((i) => !i.whatIf))
      .map((p) => ({ day: p.day, cls: s.cls, color: s.color, pct: p.pct, delta: p.delta, items: p.items.filter((i) => !i.whatIf) })))
    .sort((a, b) => b.day - a.day)
    .slice(0, 12);

  return (
    <div style={{ padding: "16px 18px 30px", maxWidth: 760, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ fontFamily: "'Lora', serif", fontSize: 19, fontWeight: 700, color: ink, marginBottom: 4 }}>Timeline</div>
      <div style={{ fontSize: 12, color: sub, marginBottom: 14 }}>How your grades moved, assignment by assignment. Hover or tap a dot for details.</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <button onClick={() => setScope("grades")} style={chip(scope === "grades")}>Class grades</button>
        <button onClick={() => setScope("gpa")} style={chip(scope === "gpa")}>GPA</button>
        <span style={{ width: 10 }} />
        {[["all", "Whole term"], ["30", "30 days"], ["14", "2 weeks"]].map(([v, label]) => (
          <button key={v} onClick={() => setRange(v)} style={chip(range === v)}>{label}</button>
        ))}
      </div>

      <div style={card}>
        {body || <div style={{ color: sub, fontSize: 13, padding: "30px 0", textAlign: "center" }}>Nothing to show here. Try a longer range{scope === "grades" ? " or switch a class back on" : ""}.</div>}
        <div style={{ fontSize: 10.5, color: sub, marginTop: 6 }}>
          Dashed lines and hollow dots are what-ifs, drawn after your last real assignment. Assignments you left out aren't counted.
        </div>
      </div>

      {scope === "grades" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {all.map((s) => {
            const on = !hidden.includes(s.cls.id);
            return (
              <button key={s.cls.id} onClick={() => setHidden((h) => (on ? [...h, s.cls.id] : h.filter((x) => x !== s.cls.id)))}
                style={{ ...chip(on), textDecoration: on ? "none" : "line-through" }} title={on ? "Hide this class" : "Show this class"}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, opacity: on ? 1 : 0.35 }} />
                {s.cls.name}
              </button>
            );
          })}
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 600, color: ink, marginBottom: 8 }}>Recent grade changes</div>
        {feed.length === 0 && <div style={{ fontSize: 12, color: sub }}>Nothing has changed yet.</div>}
        {feed.map((f, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "52px 1fr auto", gap: 10, alignItems: "baseline", padding: "7px 0",
            borderTop: i ? `1px solid ${border}` : "none", fontSize: 12.5,
          }}>
            <span style={{ color: sub, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5 }}>{dayLabel(f.day)}</span>
            <span style={{ minWidth: 0 }}>
              <button onClick={() => onOpenClass(f.cls.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: ink, fontWeight: 600, fontSize: 12.5, fontFamily: "'Inter', sans-serif" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: f.color, marginRight: 6 }} />
                {f.cls.name}
              </button>
              <span style={{ color: sub }}>{" · "}{f.items.slice(0, 2).map((x) => `${x.name} ${x.earned}/${x.possible}`).join(", ")}{f.items.length > 2 ? ` +${f.items.length - 2} more` : ""}</span>
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, whiteSpace: "nowrap", color: Math.abs(f.delta) <= 0.005 ? sub : f.delta > 0 ? "#2f7d4f" : "#c0392b" }}>
              {f.pct.toFixed(1)}% {Math.abs(f.delta) <= 0.005 ? "" : f.delta > 0 ? `▲ +${f.delta.toFixed(1)}` : `▼ ${f.delta.toFixed(1)}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ shared screen bits ------------------------------ */

function themeOf(mode) {
  const dark = mode === "dark";
  return {
    ink: dark ? "#F5F1E8" : "#2B2B26", sub: dark ? "#A9A79C" : "#6B6B63", border: dark ? "#2E5647" : "#EAE3D3",
    surface: dark ? "#22453A" : "#FFFFFF", soft: dark ? "#1B3A2F" : "#FBF8F1", dark,
  };
}
const CAT_COLORS = ["#c0392b", "#d68910", "#7d3c98", "#2c6fbb", "#b03a6f", "#17a589", "#5d6d7e"];
const classColorOf = (classes, id) => TL_COLORS[Math.max(0, classes.findIndex((c) => c.id === id)) % TL_COLORS.length];
const fmtPct = (v, d = 1) => (v == null ? "—" : v.toFixed(d) + "%");
const fmtNum = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1));

function Panel({ t, title, hint, right, children }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: hint ? 2 : 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: "'Lora', serif" }}>{title}</div>
        {right}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: t.sub, marginBottom: 10, lineHeight: 1.5 }}>{hint}</div>}
      {children}
    </div>
  );
}
function PageTitle({ t, title, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: "'Lora', serif", fontSize: 19, fontWeight: 700, color: t.ink, marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 12, color: t.sub }}>{sub}</div>
    </div>
  );
}
function Empty({ t, children }) {
  return <div style={{ fontSize: 12.5, color: t.sub, padding: "6px 0" }}>{children}</div>;
}
const rowBtn = (t) => ({
  display: "grid", gridTemplateColumns: "1fr 110px 58px", gap: 10, alignItems: "center", width: "100%", textAlign: "left",
  padding: "8px 0", border: "none", borderTop: `1px solid ${t.border}`, background: "transparent", cursor: "pointer", color: t.ink, fontFamily: "'Inter', sans-serif",
});

/* ---------------------------------- insights ---------------------------------- */

function InsightsView({ classes, mode, accent, onOpenClass, today }) {
  const t = themeOf(mode);
  const live = classes.filter((c) => classPercent(realOf(c)).pct != null);
  const hits = useMemo(() => biggestHits(classes, 8), [classes]);
  const byDay = useMemo(() => workloadDays(classes), [classes]);
  const grid = useMemo(() => calendarGrid(byDay, today), [byDay, today]);
  const [selDay, setSelDay] = useState(null);
  const maxGain = hits.length ? hits[0].gain : 1;
  const monthOf = (d) => new Date(d * DAY_MS).toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
  const level = (n) => (n === 0 ? 0 : n >= 4 ? 4 : n);
  const shade = ["", "40", "70", "a0", "e0"];

  return (
    <div style={{ padding: "16px 18px 30px", maxWidth: 780, fontFamily: "'Inter', sans-serif" }}>
      <PageTitle t={t} title="Insights" sub="Where your grades are made and lost. All of this uses your real Aeries grades." />

      <Panel t={t} title="Biggest hits" hint="How much each class would go up if you had gotten full credit on that one assignment. These are the best places to ask about a retake or a correction.">
        {hits.length === 0 ? <Empty t={t}>Nothing is costing you points right now.</Empty> : hits.map((h) => (
          <button key={h.cls.id + "-" + h.a.id} onClick={() => onOpenClass(h.cls.id)} style={rowBtn(t)} title="Open this class">
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: classColorOf(classes, h.cls.id), marginRight: 7 }} />
                {h.a.name}
              </span>
              <span style={{ display: "block", fontSize: 11, color: t.sub }}>{h.cls.name} · lost {fmtNum(h.lost)} of {h.a.possible} points</span>
            </span>
            <span style={{ height: 9, borderRadius: 5, background: t.border, overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${Math.max(6, (h.gain / maxGain) * 100)}%`, background: "#c0392b", borderRadius: 5 }} />
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 700, textAlign: "right", color: "#c0392b" }}>+{h.gain.toFixed(1)}%</span>
          </button>
        ))}
      </Panel>

      <Panel t={t} title="Where your points went" hint="Each bar is a class out of 100. The colored part is what you've kept; the rest shows which categories took the points.">
        {live.length === 0 && <Empty t={t}>No grades yet.</Empty>}
        {live.map((c) => {
          const b = categoryBreakdown(c);
          const pct = classPercent(realOf(c)).pct;
          const colorOf = (id) => CAT_COLORS[Math.max(0, c.categories.findIndex((k) => k.id === id)) % CAT_COLORS.length];
          const lost = b.filter((x) => x.lost > 0.05);
          return (
            <div key={c.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 600, color: t.ink, marginBottom: 5 }}>
                <span>{c.name}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtPct(pct)}</span>
              </div>
              <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: t.border }}>
                <div style={{ width: `${Math.min(pct, 100)}%`, background: accent }} title={`Kept ${pct.toFixed(1)}`} />
                {lost.map((x) => <div key={x.cat.id} style={{ width: `${x.lost}%`, background: colorOf(x.cat.id) }} title={`${x.cat.name}: lost ${x.lost.toFixed(1)}`} />)}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", marginTop: 5, fontSize: 11, color: t.sub }}>
                {lost.length === 0 && <span>Nothing lost. Perfect.</span>}
                {lost.map((x) => (
                  <span key={x.cat.id}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: colorOf(x.cat.id), marginRight: 4 }} />
                    {x.cat.name} −{x.lost.toFixed(1)} <span style={{ opacity: 0.7 }}>({fmtPct(x.pct, 0)} of {x.weight}%)</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </Panel>

      <Panel t={t} title="Score spread" hint="Every dot is one assignment. The line is your average. Tight dots mean steady; scattered dots mean ups and downs.">
        {live.map((c) => {
          const sp = scoreSpread(c);
          if (!sp || sp.items.length < 2) return null;
          const lo = Math.min(50, Math.floor(sp.min / 5) * 5);
          const x = (p) => 12 + ((Math.max(p, lo) - lo) / (100 - lo)) * 276;
          return (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.ink, fontWeight: 600 }}>
                <span>{c.name}</span>
                <span style={{ color: t.sub, fontWeight: 500 }}>{sp.label} · avg {sp.mean.toFixed(1)}% · {sp.min.toFixed(0)}–{sp.max.toFixed(0)}%</span>
              </div>
              <svg viewBox="0 0 300 40" width="100%" role="img" aria-label={`Scores for ${c.name}`}>
                <line x1="12" x2="288" y1="30" y2="30" stroke={t.border} strokeWidth="1" />
                <text x="12" y="39" fontSize="8" fill={t.sub}>{lo}%</text>
                <text x="288" y="39" fontSize="8" fill={t.sub} textAnchor="end">100%</text>
                {sp.items.map((it, i) => <circle key={i} cx={x(it.pct)} cy={8 + (i % 3) * 7} r="3.2" fill={classColorOf(classes, c.id)} opacity="0.75" />)}
                <line x1={x(sp.mean)} x2={x(sp.mean)} y1="2" y2="30" stroke={t.ink} strokeWidth="1.4" strokeDasharray="3 2" />
              </svg>
            </div>
          );
        })}
      </Panel>

      <Panel t={t} title="Workload calendar" hint="Darker days had more due. A dashed orange edge means something on that day is still to come or still ungraded. Tap a day to see what it was.">
        {!grid ? <Empty t={t}>Dates arrive with the next refresh.</Empty> : (
          <div>
            <div style={{ overflowX: "auto", paddingBottom: 4 }}>
              <div style={{ display: "inline-flex", gap: 6 }}>
                <div style={{ display: "grid", gridTemplateRows: "14px repeat(7, 15px)", gap: 3, fontSize: 9, color: t.sub, textAlign: "right" }}>
                  <span />
                  {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => <span key={i} style={{ lineHeight: "15px" }}>{d}</span>)}
                </div>
                <div>
                  <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "15px", gap: 3, height: 14, fontSize: 9, color: t.sub, marginBottom: 3 }}>
                    {grid.weeks.map((w, i) => <span key={i} style={{ whiteSpace: "nowrap" }}>{i === 0 || monthOf(w[0]) !== monthOf(grid.weeks[i - 1][0]) ? monthOf(w[0]) : ""}</span>)}
                  </div>
                  <div style={{ display: "grid", gridAutoFlow: "column", gridTemplateRows: "repeat(7, 15px)", gridAutoColumns: "15px", gap: 3 }}>
                    {grid.weeks.flat().map((day) => {
                      const items = byDay.get(day) || [];
                      const lv = level(items.length);
                      const pend = items.some((i) => i.pending);
                      return (
                        <button key={day} onClick={() => setSelDay(selDay === day ? null : day)} title={`${dayLabel(day)}: ${items.length} item${items.length === 1 ? "" : "s"}`}
                          style={{
                            width: 15, height: 15, padding: 0, borderRadius: 3, cursor: items.length ? "pointer" : "default",
                            background: lv === 0 ? t.border : accent + shade[lv],
                            border: day === today ? `2px solid ${t.ink}` : pend ? "1.5px dashed #d68910" : selDay === day ? `2px solid ${accent}` : "none",
                          }} />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: t.sub, marginTop: 6 }}>
              Less {[0, 1, 2, 3, 4].map((l) => <span key={l} style={{ width: 11, height: 11, borderRadius: 3, background: l === 0 ? t.border : accent + shade[l], display: "inline-block" }} />)} More
              <span style={{ marginLeft: 10 }}>Today has a dark outline.</span>
            </div>
            {selDay != null && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.ink, marginBottom: 4 }}>{new Date(selDay * DAY_MS).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</div>
                {(byDay.get(selDay) || []).length === 0 && <Empty t={t}>Nothing was due.</Empty>}
                {(byDay.get(selDay) || []).map((it, i) => (
                  <div key={i} style={{ fontSize: 12, color: t.ink, padding: "2px 0" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: classColorOf(classes, it.cls.id), marginRight: 6 }} />
                    {it.cls.name}: {it.name} <span style={{ color: t.sub }}>· {it.possible} pts{it.pending ? " · still to do or ungraded" : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ---------------------------------- inputs ---------------------------------- */

// A number box you can actually type decimals into ("3." stays "3." while you type the rest).
function NumberField({ value, onCommit, step, min, max, width = 72, placeholder, t, ariaLabel }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => {
    if (!(text === "" && value == null) && Number(text) !== value) setText(value == null ? "" : String(value));
  }, [value]);
  return (
    <input
      type="number" inputMode="decimal" step={step} min={min} max={max} value={text} placeholder={placeholder} aria-label={ariaLabel}
      onChange={(e) => {
        setText(e.target.value);
        const v = e.target.value === "" ? null : Number(e.target.value);
        if (v === null || Number.isFinite(v)) onCommit(v);
      }}
      style={{
        width, padding: "7px 8px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.soft, color: t.ink,
        fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
      }}
    />
  );
}
const selectStyle = (t) => ({ padding: "7px 8px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.soft, color: t.ink, fontSize: 13, fontFamily: "'Inter', sans-serif", maxWidth: 200 });
const labelStyle = (t) => ({ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: t.sub, textTransform: "uppercase", letterSpacing: 0.4 });
const chipStyle = (t, accent, on) => ({
  padding: "4px 10px", borderRadius: 14, cursor: "pointer", fontSize: 11.5, fontFamily: "'Inter', sans-serif",
  border: `1px solid ${on ? accent : t.border}`, background: on ? accent + "22" : "transparent", color: t.ink, fontWeight: on ? 700 : 500,
});

/* ------------------------------------- plan ------------------------------------- */

const PRESET_TARGETS = [["A+", 97], ["A", 93], ["A-", 90], ["B+", 87], ["B", 83], ["B-", 80]];

function PlanView({ classes, mode, accent, weighted, onOpenClass, today }) {
  const t = themeOf(mode);
  const live = useMemo(() => classes.filter((c) => classPercent(realOf(c)).pct != null), [classes]);
  const lists = useMemo(() => upcomingList(classes, today), [classes, today]);
  const planner = useMemo(() => gpaPlanner(classes, weighted), [classes, weighted]);
  const [wClass, setWClass] = useState(null);
  const [target, setTarget] = useState(null);
  const [catPick, setCatPick] = useState(null);
  const [pts, setPts] = useState(100);
  const [letters, setLetters] = useState({});
  const [avg, setAvg] = useState(90);

  const cls = live.find((c) => c.id === wClass) || live[0] || null;
  const nxt = cls ? nextGradeUp(cls) : null;
  const tgt = target != null ? target : nxt ? Math.min(100, Math.ceil(nxt.pct * 10) / 10) : 100;
  const heaviest = cls ? [...cls.categories].sort((a, b) => b.weight - a.weight)[0] : null;
  const cat = cls && catPick != null && cls.categories.some((k) => k.id === catPick) ? cls.categories.find((k) => k.id === catPick) : heaviest;
  const P = Math.max(1, pts || 100);
  const one = cls && cat ? neededOnNext(cls, tgt, cat.id, P) : null;
  const rest = cls ? requiredAvgRest(cls, tgt, today) : null;

  const simNow = simulateGpa(classes, {}, weighted);
  const simDream = simulateGpa(classes, letters, weighted);
  const dreamDelta = simNow != null && simDream != null ? simDream - simNow : 0;

  const card = (c) => ({ background: t.soft, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", ...c });
  const UpRow = ({ r, tone }) => (
    <button onClick={() => onOpenClass(r.cls.id)} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, width: "100%", textAlign: "left", padding: "7px 0", border: "none", borderTop: `1px solid ${t.border}`, background: "transparent", cursor: "pointer", color: t.ink, fontFamily: "'Inter', sans-serif" }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: classColorOf(classes, r.cls.id), marginRight: 7 }} />
          {r.p.name}
        </span>
        <span style={{ display: "block", fontSize: 11, color: t.sub }}>{r.cls.name} · {r.p.category} · {r.p.possible} pts</span>
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: tone, whiteSpace: "nowrap", alignSelf: "center" }}>
        {r.day == null ? "no date" : `${dayLabel(r.day)} · ${countdown(r.days)}`}
      </span>
    </button>
  );

  return (
    <div style={{ padding: "16px 18px 30px", maxWidth: 780, fontFamily: "'Inter', sans-serif" }}>
      <PageTitle t={t} title="Plan" sub="What's coming, what you need, and where this is heading. Real grades only." />

      <Panel t={t} title="Coming up" hint="Work with no score yet, from Aeries.">
        {lists.missing.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#c0392b", marginBottom: 2 }}>Missing ({lists.missing.length})</div>
            <div style={{ fontSize: 11, color: t.sub, marginBottom: 2 }}>Marked complete with no score. Aeries may be counting these against you.</div>
            {lists.missing.map((r, i) => <UpRow key={i} r={r} tone="#c0392b" />)}
          </div>
        )}
        <div style={{ fontSize: 11.5, fontWeight: 700, color: t.ink, marginBottom: 2 }}>Due soon ({lists.upcoming.length})</div>
        {lists.upcoming.length === 0 ? <Empty t={t}>Nothing due that Aeries knows about.</Empty> : lists.upcoming.slice(0, 12).map((r, i) => <UpRow key={i} r={r} tone={r.days <= 2 ? "#c0392b" : r.days <= 7 ? "#d68910" : t.sub} />)}
        {lists.waiting.length > 0 && (
          <details style={{ marginTop: 10 }}>
            <summary style={{ fontSize: 11.5, color: t.sub, cursor: "pointer" }}>{lists.waiting.length} past due and waiting to be graded</summary>
            {lists.waiting.slice(0, 20).map((r, i) => <UpRow key={i} r={r} tone={t.sub} />)}
          </details>
        )}
      </Panel>

      <Panel t={t} title="What do I need?" hint="Pick a class and a goal. Standard letter cutoffs are shown as shortcuts, but your class may use different ones, so you can type any percent.">
        {!cls ? <Empty t={t}>No graded classes yet.</Empty> : (
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 10 }}>
              <label style={labelStyle(t)}>Class
                <select value={cls.id} onChange={(e) => { setWClass(Number(e.target.value)); setTarget(null); setCatPick(null); }} style={selectStyle(t)}>
                  {live.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label style={labelStyle(t)}>Goal
                <NumberField value={tgt} onCommit={(v) => setTarget(v)} step="0.5" min="1" max="110" width={78} t={t} ariaLabel="Goal percent" />
              </label>
              <label style={labelStyle(t)}>Next one is in
                <select value={cat ? cat.id : ""} onChange={(e) => setCatPick(Number(e.target.value))} style={selectStyle(t)}>
                  {cls.categories.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.weight}%)</option>)}
                </select>
              </label>
              <label style={labelStyle(t)}>Worth (points)
                <NumberField value={pts} onCommit={(v) => setPts(v == null ? 100 : v)} step="1" min="1" max="1000" width={78} t={t} ariaLabel="Points" />
              </label>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {PRESET_TARGETS.map(([l, v]) => <button key={l} onClick={() => setTarget(v)} style={chipStyle(t, accent, Math.abs(tgt - v) < 1e-9)}>{l} · {v}</button>)}
              {nxt && <button onClick={() => setTarget(Math.ceil(nxt.pct * 10) / 10)} style={chipStyle(t, accent, false)}>Next grade up ({nxt.letter}) · {nxt.pct.toFixed(1)}</button>}
            </div>
            <div style={card({ fontSize: 13, color: t.ink, lineHeight: 1.65 })}>
              <div style={{ fontSize: 11.5, color: t.sub, marginBottom: 4 }}>{cls.name} is at <b style={{ color: t.ink }}>{fmtPct(classPercent(cls).pct)}</b> now.</div>
              {one && one.status === "reachable" && <div>You'd need <b>{fmtNum(Math.round(one.earned * 10) / 10)}/{P}</b> ({one.pct.toFixed(1)}%) on one {P}-point {cat.name} assignment to reach {tgt}%.</div>}
              {one && one.status === "already" && <div>You're already above {tgt}%. Even a zero on a {P}-point {cat.name} assignment would leave you at {one.floor.toFixed(1)}%.</div>}
              {one && one.status === "impossible" && <div>One {P}-point {cat.name} assignment can't get you to {tgt}%: full credit only gets you to {one.best.toFixed(1)}%.</div>}
              {rest && rest.status === "reachable" && <div>Or average <b>{rest.avg.toFixed(1)}%</b> on everything else this term (assuming the same amount of work as so far).</div>}
              {rest && rest.status === "already" && <div>At this pace you finish above {tgt}% no matter what.</div>}
              {rest && rest.status === "impossible" && <div>Even 100% on the rest of the term only gets you to about {rest.best.toFixed(1)}%.</div>}
              {!rest && <div style={{ color: t.sub, fontSize: 11.5 }}>Term dates aren't available for this class, so there's no end-of-term estimate.</div>}
            </div>
          </div>
        )}
      </Panel>

      <Panel t={t} title="GPA planner" hint="The cheapest ways to move your GPA, easiest first. 'On a 100-point test' means one extra test in that class's heaviest category.">
        {planner.length === 0 && <Empty t={t}>No graded classes yet.</Empty>}
        {planner.map((r) => (
          <div key={r.cls.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1.2fr 56px", gap: 8, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${t.border}`, fontSize: 12.5, color: t.ink }}>
            <button onClick={() => onOpenClass(r.cls.id)} style={{ textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", color: t.ink, fontWeight: 600, fontSize: 12.5, fontFamily: "'Inter', sans-serif" }}>{r.cls.name}</button>
            <span style={{ color: t.sub }}>{fmtPct(r.pct)} · {r.cur.letter}</span>
            <span style={{ color: t.sub, fontSize: 12 }}>
              {!r.nxt ? "at the top" : <>{r.nxt.letter} at {r.nxt.pct.toFixed(1)}%: {r.need && r.need.status === "reachable" ? <b style={{ color: t.ink }}>{Math.round(r.need.earned)}/100 on a test</b> : r.need && r.need.status === "already" ? "already there" : "out of reach with one test"}</>}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, textAlign: "right", color: r.gpaGain > 0 ? "#2f7d4f" : t.sub }}>{r.gpaGain > 0 ? `+${r.gpaGain.toFixed(2)}` : "—"}</span>
          </div>
        ))}
        {live.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, marginBottom: 6, fontFamily: "'Lora', serif" }}>Dream GPA</div>
            <div style={{ fontSize: 11.5, color: t.sub, marginBottom: 8 }}>Pick the letters you'd like to finish with and see what it does to your GPA.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {live.map((c) => (
                <label key={c.id} style={labelStyle(t)}>{c.name}
                  <select value={letters[c.id] || ""} onChange={(e) => setLetters((l) => ({ ...l, [c.id]: e.target.value }))} style={selectStyle(t)}>
                    <option value="">as it is ({gradeFor(realOf(c), classPercent(realOf(c)).pct).letter})</option>
                    {GRADE_SCALE.map((g) => <option key={g.letter} value={g.letter}>{g.letter}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: t.ink }}>
              {simDream == null ? "—" : simDream.toFixed(2)}
              <span style={{ fontSize: 12, marginLeft: 8, color: Math.abs(dreamDelta) < 0.005 ? t.sub : dreamDelta > 0 ? "#2f7d4f" : "#c0392b" }}>
                {Math.abs(dreamDelta) < 0.005 ? "same as now" : `${dreamDelta > 0 ? "▲ +" : "▼ "}${dreamDelta.toFixed(2)} vs now (${simNow.toFixed(2)})`}
              </span>
            </div>
          </div>
        )}
      </Panel>

      <Panel t={t} title="End-of-term forecast" hint="If the rest of the term averages this, where does each class finish? An estimate: it assumes the rest of the term brings in about as much work as so far, in the same mix.">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: t.sub }}>Rest of the term averages</span>
          <input type="range" min="50" max="100" step="1" value={avg} onChange={(e) => setAvg(Number(e.target.value))} aria-label="Average for the rest of the term" style={{ flex: "1 1 160px", accentColor: accent }} />
          <b style={{ fontFamily: "'JetBrains Mono', monospace", color: t.ink, minWidth: 44 }}>{avg}%</b>
          {[70, 80, 90, 100].map((v) => <button key={v} onClick={() => setAvg(v)} style={chipStyle(t, accent, avg === v)}>{v}</button>)}
        </div>
        {live.length === 0 && <Empty t={t}>No graded classes yet.</Empty>}
        {live.map((c) => {
          const real = realOf(c);
          const pr = projectFinal(real, avg, today);
          const ti = termInfo(real, today);
          const g = pr ? gradeFor(real, pr.pct) : null;
          const d = pr ? pr.pct - pr.now : 0;
          return (
            <div key={c.id} style={{ padding: "8px 0", borderTop: `1px solid ${t.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: t.ink }}>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {fmtPct(pr && pr.now)} → <b>{fmtPct(pr && pr.pct)}</b> {g && <span style={{ color: t.sub }}>{g.letter}</span>}
                  {pr && pr.pace && Math.abs(d) >= 0.05 && <span style={{ marginLeft: 6, fontSize: 11, color: d > 0 ? "#2f7d4f" : "#c0392b" }}>{d > 0 ? "▲ +" : "▼ "}{d.toFixed(1)}</span>}
                </span>
              </div>
              {ti ? (
                <div style={{ marginTop: 5 }}>
                  <div style={{ height: 6, borderRadius: 3, background: t.border, overflow: "hidden" }}><div style={{ width: `${ti.frac * 100}%`, height: "100%", background: accent }} /></div>
                  <div style={{ fontSize: 10.5, color: t.sub, marginTop: 3 }}>{ti.over ? "Term is over" : `${ti.left} day${ti.left === 1 ? "" : "s"} left`} · {dayLabel(ti.start)} to {dayLabel(ti.end)}{pr && !pr.pace && !ti.over ? " · too early to project" : ""}</div>
                </div>
              ) : <div style={{ fontSize: 10.5, color: t.sub, marginTop: 3 }}>No term dates for this class, so this is just today's grade.</div>}
            </div>
          );
        })}
        {live.length > 0 && (() => {
          let tot = 0, n = 0;
          for (const c of live) { const real = realOf(c); const pr = projectFinal(real, avg, today); tot += gradeFor(real, pr.pct).pts + (weighted ? LEVEL_BONUS[real.level] : 0); n += 1; }
          return <div style={{ marginTop: 10, fontSize: 12.5, color: t.ink }}>Projected GPA: <b style={{ fontFamily: "'JetBrains Mono', monospace" }}>{(tot / n).toFixed(2)}</b> <span style={{ color: t.sub }}>(now {simNow.toFixed(2)})</span></div>;
        })()}
      </Panel>
    </div>
  );
}

/* ------------------------------------ goals ------------------------------------ */

function Ring({ frac, color, size = 64, stroke = 7, track, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * Math.min(1, Math.max(0, frac))} ${c}`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{children}</div>
    </div>
  );
}
function DeltaPill({ v, digits = 1, t }) {
  if (v == null || Math.abs(v) < 0.5 * Math.pow(10, -digits)) return <span style={{ color: t.sub, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>—</span>;
  return <span style={{ color: v > 0 ? "#2f7d4f" : "#c0392b", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }}>{v > 0 ? "▲ +" : "▼ "}{v.toFixed(digits)}</span>;
}
const BADGE_ICONS = { perfect10: Trophy, roll: Flame, clean: Check, straightA: Award, comeback: TrendingUp, steady: Target, gpa4: Sparkles, planner: Flag };

function GoalsView({ classes, mode, accent, weighted, goals, setGoals, prefs, today, realGpa, onOpenClass, onCelebrate }) {
  const t = themeOf(mode);
  const recap = useMemo(() => weeklyRecap(classes, weighted, today), [classes, weighted, today]);
  const badges = useMemo(() => badgesFor(classes, { today, weighted, goals }), [classes, weighted, today, goals]);
  const streak = useMemo(() => hotStreak(classes), [classes]);
  const statuses = useMemo(() => goalStatuses(goals, classes, realGpa), [goals, classes, realGpa]);
  const real = useMemo(() => classes.map(realOf), [classes]);
  const live = real.filter((c) => classPercent(c).pct != null);
  const shareData = useMemo(() => {
    const g = computeGpa(real, weighted);
    return {
      gpa: g.gpa, weighted,
      when: new Date(today * DAY_MS).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
      rows: g.withGrades.filter((c) => c.pct != null).map((c) => ({ name: c.name, pct: c.pct, letter: c.letter })),
    };
  }, [real, weighted, today]);

  const setGpaGoal = (v) => setGoals((g) => sanitizeGoals({ ...g, gpa: v }));
  const setClassGoal = (name, v) => setGoals((g) => {
    const cl = { ...g.classes };
    if (v == null) delete cl[normName(name)]; else cl[normName(name)] = v;
    return sanitizeGoals({ ...g, classes: cl });
  });
  const statusOf = (key) => statuses.find((s) => s.key === key);
  const gpaStatus = statuses.find((s) => s.kind === "gpa");
  const best = recap.per.length ? [...recap.per].filter((p) => p.delta != null).sort((a, b) => b.delta - a.delta) : [];
  const unlocked = badges.filter((b) => b.unlocked).length;

  return (
    <div style={{ padding: "16px 18px 30px", maxWidth: 780, fontFamily: "'Inter', sans-serif" }}>
      <PageTitle t={t} title="Goals & wins" sub="Set a target, watch the progress, and enjoy the good stuff." />

      <Panel t={t} title="This week" hint="Compared with a week ago. Real grades only, so what-ifs don't count.">
        {recap.per.length === 0 ? <Empty t={t}>Nothing to compare yet.</Empty> : (
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: t.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>GPA</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: t.ink }}>{recap.gpaNow == null ? "—" : recap.gpaNow.toFixed(2)}</span>
              <DeltaPill v={recap.gpaDelta} digits={2} t={t} />
              <span style={{ fontSize: 12, color: t.sub }}>{recap.graded} grade{recap.graded === 1 ? "" : "s"} posted · {recap.perfect} perfect</span>
            </div>
            {recap.per.map((p) => (
              <div key={p.cls.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "baseline", padding: "6px 0", borderTop: `1px solid ${t.border}`, fontSize: 12.5, color: t.ink }}>
                <button onClick={() => onOpenClass(p.cls.id)} style={{ textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", color: t.ink, fontWeight: 600, fontSize: 12.5, fontFamily: "'Inter', sans-serif" }}>{p.cls.name}</button>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: t.sub }}>{p.now.toFixed(1)}%</span>
                <DeltaPill v={p.delta} t={t} />
              </div>
            ))}
            {best.length > 0 && best[0].delta > 0.05 && <div style={{ marginTop: 8, fontSize: 12, color: "#2f7d4f" }}>Biggest climb: {best[0].cls.name} (+{best[0].delta.toFixed(1)})</div>}
          </div>
        )}
      </Panel>

      <Panel t={t} title="Goals" hint="Set a GPA goal and a percent goal for any class. You'll get a celebration when you reach one.">
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
          <Ring frac={gpaStatus ? gpaStatus.now / gpaStatus.goal : 0} color={gpaStatus && gpaStatus.reached ? "#2f7d4f" : accent} track={t.border}>
            <span style={{ color: t.ink }}>{realGpa == null ? "—" : realGpa.toFixed(2)}</span>
          </Ring>
          <div>
            <label style={labelStyle(t)}>GPA goal
              <NumberField value={goals.gpa} onCommit={setGpaGoal} step="0.05" min="0" max="5.5" width={84} placeholder="e.g. 3.8" t={t} ariaLabel="GPA goal" />
            </label>
            <div style={{ fontSize: 11.5, color: t.sub, marginTop: 5 }}>
              {!gpaStatus ? "Type a number to set one." : gpaStatus.reached ? "Reached. Nice." : `${(gpaStatus.goal - gpaStatus.now).toFixed(2)} to go`}
            </div>
          </div>
        </div>
        {live.map((c) => {
          const g = goals.classes[normName(c.name)];
          const st = g != null ? statusOf("cls:" + normName(c.name) + ":" + g) : null;
          const need = g != null ? requiredAvgRest(c, g, today) : null;
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderTop: `1px solid ${t.border}`, flexWrap: "wrap" }}>
              <Ring size={46} stroke={5} frac={st ? st.now / st.goal : 0} color={st && st.reached ? "#2f7d4f" : classColorOf(classes, c.id)} track={t.border}>
                <span style={{ color: t.ink, fontSize: 10 }}>{st ? Math.min(100, Math.round((st.now / st.goal) * 100)) : "–"}</span>
              </Ring>
              <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{c.name} <span style={{ fontWeight: 500, color: t.sub }}>· {fmtPct(classPercent(c).pct)}</span></div>
                <div style={{ fontSize: 11, color: t.sub }}>
                  {!st ? "No goal set" : st.reached ? "Goal reached" : need && need.status === "reachable" ? `Average ${need.avg.toFixed(0)}% on the rest of the term` : need && need.status === "impossible" ? "Out of reach this term" : `${(st.goal - st.now).toFixed(1)} points to go`}
                </div>
              </div>
              <NumberField value={g == null ? null : g} onCommit={(v) => setClassGoal(c.name, v)} step="0.5" min="1" max="110" width={74} placeholder="goal %" t={t} ariaLabel={`Goal for ${c.name}`} />
            </div>
          );
        })}
      </Panel>

      <Panel t={t} title="Streaks & badges" right={<span style={{ fontSize: 11.5, color: t.sub }}>{unlocked}/{badges.length} unlocked</span>}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Flame size={28} color={streak >= 3 ? "#e8590c" : t.sub} />
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: t.ink, lineHeight: 1 }}>{streak}</div>
            <div style={{ fontSize: 11.5, color: t.sub }}>assignment{streak === 1 ? "" : "s"} in a row at 90% or better</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {badges.map((b) => {
            const Icon = BADGE_ICONS[b.id] || Award;
            return (
              <div key={b.id} title={b.desc} style={{ border: `1px solid ${b.unlocked ? accent : t.border}`, background: b.unlocked ? accent + "18" : t.soft, borderRadius: 12, padding: "10px 12px", opacity: b.unlocked ? 1 : 0.8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon size={18} color={b.unlocked ? accent : t.sub} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>{b.name}</span>
                </div>
                <div style={{ fontSize: 11, color: t.sub, margin: "4px 0 6px", lineHeight: 1.4 }}>{b.desc}</div>
                <div style={{ height: 5, borderRadius: 3, background: t.border, overflow: "hidden" }}><div style={{ width: `${b.progress * 100}%`, height: "100%", background: b.unlocked ? accent : t.sub }} /></div>
                <div style={{ fontSize: 10.5, color: t.sub, marginTop: 3 }}>{b.unlocked ? "Unlocked" : b.detail}</div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel t={t} title="Share your GPA" hint="Make a picture to send or post. You choose what's on it.">
        <ShareCard data={shareData} mode={mode} accent={accent} />
      </Panel>

      <Panel t={t} title="Celebrate" hint={prefs.confetti ? "Just because." : "Confetti is switched off in Theme."}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[["small", "A little"], ["medium", "A lot"], ["mega", "Everything"]].map(([lv, label]) => (
            <button key={lv} disabled={!prefs.confetti} onClick={() => onCelebrate(lv)} style={{ ...chipStyle(t, accent, false), padding: "8px 14px", opacity: prefs.confetti ? 1 : 0.5, display: "inline-flex", gap: 6, alignItems: "center" }}>
              <PartyPopper size={14} /> {label}
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function NavBar({ view, setView, mode, accent, gpa }) {
  const items = [
    { id: "dashboard", label: "Classes", icon: BookOpen },
    { id: "timeline", label: "Timeline", icon: TrendingUp },
    { id: "insights", label: "Insights", icon: Lightbulb },
    { id: "plan", label: "Plan", icon: CalendarDays },
    { id: "goals", label: "Goals", icon: Trophy },
    { id: "settings", label: "Theme", icon: Palette },
  ];
  const ink = mode === "dark" ? "#F5F1E8" : "#2B2B26";
  const sub = mode === "dark" ? "#A9A79C" : "#6B6B63";
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", rowGap: 8,
      padding: "14px 18px", borderBottom: `1px solid ${mode === "dark" ? "#2E5647" : "#E9E2D2"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <GraduationCap size={17} color="#fff" />
        </div>
        <span style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 16.5, color: ink }}>Ledger</span>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {items.map((it) => {
          const active = view === it.id || (it.id === "dashboard" && view === "class");
          return (
            <button key={it.id} onClick={() => setView(it.id)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
              border: "none", cursor: "pointer", fontSize: 12.5, fontFamily: "'Inter', sans-serif", fontWeight: 500,
              background: active ? (mode === "dark" ? "#2E5647" : "#F1ECE0") : "transparent",
              color: active ? ink : sub,
            }}>
              <it.icon size={14} /> {it.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 10.5, color: sub, fontFamily: "'Inter', sans-serif" }}>GPA</span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15, color: accent,
          padding: "3px 9px", borderRadius: 20, border: `1.5px solid ${accent}`,
        }}>
          {gpa == null ? "—" : gpa.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function ClassCard({ cls, mode, accent, onOpen, onEditMeta }) {
  const { pct } = classPercent(cls);
  const g = gradeFor(cls, pct);
  const spark = classSparkPoints(cls);
  const ink = mode === "dark" ? "#F5F1E8" : "#2B2B26";
  const sub = mode === "dark" ? "#A9A79C" : "#6B6B63";
  const surface = mode === "dark" ? "#22453A" : "#FFFFFF";
  const border = mode === "dark" ? "#2E5647" : "#EAE3D3";
  const hasWhatIf = hasWhatIfs(cls);
  return (
    <div style={{
      textAlign: "left", background: surface, border: `1px solid ${border}`,
      borderRadius: 14, padding: "16px 16px 14px", display: "flex", flexDirection: "column", gap: 10,
      fontFamily: "'Inter', sans-serif", position: "relative",
    }}>
      <button
        onClick={(e) => { e.stopPropagation(); onEditMeta(); }}
        title="Edit class"
        style={{ position: "absolute", top: 10, right: 10, ...iconBtn(mode) }}
      >
        <Pencil size={13} />
      </button>
      <button onClick={onOpen} style={{ all: "unset", cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: ink, fontFamily: "'Lora', serif" }}>{cls.name}</div>
            <div style={{ fontSize: 11.5, color: sub, marginTop: 2 }}>{cls.teacher} · {cls.level}</div>
          </div>
          <Stamp letter={g.letter} size={44} accent={accent} mode={mode} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 21, fontWeight: 700, color: ink }}>
              {pct == null ? "—" : `${pct.toFixed(1)}%`}
            </div>
            {hasWhatIf && (
              <div style={{ fontSize: 10, color: "#C0392B", marginTop: 2, fontFamily: "'Inter', sans-serif" }}>
                includes what-if edits
              </div>
            )}
          </div>
          <Sparkline points={spark} accent={accent} />
        </div>
      </button>
    </div>
  );
}

function AddClassTile({ mode, accent, onClick }) {
  const border = mode === "dark" ? "#3A5C4F" : "#DDD5C4";
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: `1.5px dashed ${border}`, borderRadius: 14,
      minHeight: 118, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 6, cursor: "pointer", color: accent, fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600,
    }}>
      <Plus size={18} /> Add a class
    </button>
  );
}

function Dashboard({ classes, mode, accent, weighted, onOpenClass, onEditClass, onAddClass }) {
  const sub = mode === "dark" ? "#A9A79C" : "#6B6B63";
  const ink = mode === "dark" ? "#F5F1E8" : "#2B2B26";
  return (
    <div style={{ padding: "20px 18px 30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 19, fontWeight: 700, color: ink }}>Your classes</div>
          <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>
            {weighted ? "Weighted" : "Unweighted"} GPA · {classes.length} classes
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {classes.map((c) => (
          <ClassCard key={c.id} cls={c} mode={mode} accent={accent}
            onOpen={() => onOpenClass(c.id)} onEditMeta={() => onEditClass(c.id)} />
        ))}
        <AddClassTile mode={mode} accent={accent} onClick={onAddClass} />
      </div>
      <div style={{ marginTop: 22, fontSize: 11, color: sub, display: "flex", alignItems: "center", gap: 6 }}>
        <Sparkles size={13} /> Tap a class to open its ledger, or the pencil to fix its name, categories, or weights.
      </div>
    </div>
  );
}

function AssignmentRow({ a, cat, mode, accent, onEdit, onDelete, onToggle }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(a.earned));
  const ink = mode === "dark" ? "#F5F1E8" : "#2B2B26";
  const sub = mode === "dark" ? "#A9A79C" : "#6B6B63";
  const border = mode === "dark" ? "#2E5647" : "#EFE9DA";
  const pct = a.possible > 0 ? (a.earned / a.possible) * 100 : null;
  const yours = isYours(a);
  const strike = a.excluded ? "line-through" : "none";

  const commit = () => {
    const val = parseFloat(draft);
    if (!Number.isNaN(val)) onEdit(a.id, val);
    setEditing(false);
  };

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto auto auto", alignItems: "center", gap: 12,
      padding: "9px 4px", borderBottom: `1px solid ${border}`, fontFamily: "'Inter', sans-serif",
      opacity: a.excluded ? 0.55 : 1,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: ink, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ textDecoration: strike }}>{a.name}</span>
          {a.excluded && (
            <span style={{
              fontSize: 9.5, color: sub, border: `1px solid ${sub}77`, borderRadius: 10, padding: "1px 6px",
              fontFamily: "'Caveat', cursive, 'Inter', sans-serif", fontWeight: 700,
            }}>left out</span>
          )}
          {a.isWhatIf && (
            <span style={{
              fontSize: 9.5, color: "#C0392B", border: "1px solid #C0392B77", borderRadius: 10,
              padding: "1px 6px", fontFamily: "'Caveat', cursive, 'Inter', sans-serif", fontWeight: 700,
            }}>what-if</span>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: sub }}>{cat.name}</div>
      </div>

      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, textAlign: "right", color: sub, whiteSpace: "nowrap", textDecoration: strike }}>
        {a.original != null && (
          <span style={{ textDecoration: "line-through", opacity: 0.6, marginRight: 6 }}>{a.original}</span>
        )}
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            style={{
              width: 46, fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5,
              border: "1px solid #C0392B", borderRadius: 5, padding: "1px 4px",
              color: "#C0392B", background: "transparent", outline: "none",
            }}
          />
        ) : (
          <span style={{ color: a.original != null ? "#C0392B" : ink, fontWeight: a.original != null ? 700 : 500 }}>
            {a.earned}
          </span>
        )}
        <span style={{ opacity: 0.6 }}> / {a.possible}</span>
      </div>

      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: sub, width: 44, textAlign: "right", textDecoration: strike }}>
        {pct == null ? "—" : `${pct.toFixed(0)}%`}
      </div>

      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => setEditing(true)} disabled={!!a.excluded} title="Edit as what-if"
          style={{ ...iconBtn(mode), opacity: a.excluded ? 0.35 : 1, cursor: a.excluded ? "default" : "pointer" }}>
          <Pencil size={13} />
        </button>
        <button
          onClick={() => (yours ? onDelete(a.id) : onToggle(a.id))}
          title={yours ? "Remove this what-if" : a.excluded ? "Put it back in my grade" : "Leave it out of my grade (what-if)"}
          style={iconBtn(mode)}
        >
          {a.excluded && !yours ? <Undo2 size={13} /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

const iconBtn = (mode) => ({
  border: "none", background: "transparent", cursor: "pointer",
  color: mode === "dark" ? "#A9A79C" : "#8b897f", padding: 4, borderRadius: 6,
  display: "flex", alignItems: "center",
});

function AddAssignment({ cats, mode, accent, onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [catId, setCatId] = useState(cats[0]?.id);
  const [earned, setEarned] = useState("");
  const [possible, setPossible] = useState("");
  const [whatIf, setWhatIf] = useState(true);
  const ink = mode === "dark" ? "#F5F1E8" : "#2B2B26";
  const sub = mode === "dark" ? "#A9A79C" : "#6B6B63";
  const border = mode === "dark" ? "#2E5647" : "#DDD5C4";

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5,
        color: accent, background: "transparent", border: `1px dashed ${accent}77`, borderRadius: 8,
        padding: "8px 12px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontWeight: 500,
      }}>
        <Plus size={14} /> Add an assignment
      </button>
    );
  }

  const submit = () => {
    const e = parseFloat(earned), p = parseFloat(possible);
    if (!name.trim() || Number.isNaN(e) || Number.isNaN(p) || p <= 0) return;
    onAdd({ name: name.trim(), catId, earned: e, possible: p, isWhatIf: whatIf });
    setName(""); setEarned(""); setPossible(""); setOpen(false);
  };

  const inputStyle = {
    padding: "7px 9px", borderRadius: 7, border: `1px solid ${border}`,
    background: mode === "dark" ? "#1B3A2F" : "#fff", color: ink, fontSize: 12.5,
    fontFamily: "'Inter', sans-serif", outline: "none",
  };

  return (
    <div style={{
      marginTop: 12, padding: 12, borderRadius: 10, border: `1px solid ${border}`,
      display: "flex", flexDirection: "column", gap: 8, background: mode === "dark" ? "#1B3A2F55" : "#FBF8F1",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11.5, color: sub, fontWeight: 500 }}>New assignment</span>
        <button onClick={() => setOpen(false)} style={iconBtn(mode)}><X size={14} /></button>
      </div>
      <input placeholder="Assignment name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      <div style={{ display: "flex", gap: 8 }}>
        <select value={catId} onChange={(e) => setCatId(Number(e.target.value))} style={{ ...inputStyle, flex: 1 }}>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="Score" value={earned} onChange={(e) => setEarned(e.target.value)} style={{ ...inputStyle, width: 64 }} />
        <span style={{ alignSelf: "center", color: sub, fontSize: 12 }}>/</span>
        <input placeholder="Out of" value={possible} onChange={(e) => setPossible(e.target.value)} style={{ ...inputStyle, width: 64 }} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: sub, cursor: "pointer" }}>
        <input type="checkbox" checked={whatIf} onChange={(e) => setWhatIf(e.target.checked)} style={{ accentColor: accent }} />
        Mark as what-if (hypothetical) — leave unchecked for a real, already-graded assignment
      </label>
      <button onClick={submit} style={{
        alignSelf: "flex-start", background: accent, color: "#fff", border: "none", borderRadius: 7,
        padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif",
      }}>
        Add to ledger
      </button>
    </div>
  );
}

function ClassView({ cls, mode, accent, onBack, onUpdateClass }) {
  const { pct, perCat } = classPercent(cls);
  const g = gradeFor(cls, pct);
  const ink = mode === "dark" ? "#F5F1E8" : "#2B2B26";
  const sub = mode === "dark" ? "#A9A79C" : "#6B6B63";
  const border = mode === "dark" ? "#2E5647" : "#EAE3D3";
  const surface = mode === "dark" ? "#22453A" : "#FFFFFF";
  const hasWhatIf = hasWhatIfs(cls);

  const editScore = (id, val) => {
    onUpdateClass({
      ...cls,
      assignments: cls.assignments.map((a) =>
        a.id === id
          ? { ...a, earned: val, isWhatIf: true, original: a.original == null ? a.earned : a.original }
          : a
      ),
    });
  };
  const removeAssignment = (id) => onUpdateClass(removeWhatIf(cls, id));
  const toggleExcluded = (id) => onUpdateClass(toggleExcludedOf(cls, id));
  const addAssignment = ({ name, catId, earned, possible, isWhatIf }) => {
    onUpdateClass({
      ...cls,
      assignments: [...cls.assignments, { id: nextId(), catId, name, earned, possible, isWhatIf: !!isWhatIf, original: null }],
    });
  };
  const resetWhatIfs = () => onUpdateClass(resetWhatIfsOf(cls));

  return (
    <div style={{ padding: "16px 18px 30px" }}>
      <button onClick={onBack} style={{
        display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none",
        color: sub, fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 14, fontFamily: "'Inter', sans-serif",
      }}>
        <ChevronLeft size={15} /> All classes
      </button>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14,
        background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16,
      }}>
        <div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 700, color: ink }}>{cls.name}</div>
          <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>{cls.teacher} · {cls.level}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: ink, marginTop: 8 }}>
            {pct == null ? "—" : `${pct.toFixed(2)}%`}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div onClick={() => launchConfetti("small")} title="Pop!" style={{ cursor: "pointer" }}>
            <Stamp letter={g.letter} size={58} accent={accent} mode={mode} />
          </div>
          {hasWhatIf && (
            <button onClick={resetWhatIfs} style={{
              display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "#C0392B",
              background: "transparent", border: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif",
            }}>
              <Undo2 size={12} /> Reset what-ifs
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        {cls.categories.map((cat) => {
          const cp = perCat[cat.id];
          return (
            <div key={cat.id} style={{
              flex: "1 1 120px", background: surface, border: `1px solid ${border}`, borderRadius: 10,
              padding: "9px 12px",
            }}>
              <div style={{ fontSize: 10.5, color: sub, fontFamily: "'Inter', sans-serif" }}>{cat.name} · {cat.weight}%</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: ink }}>
                {cp == null ? "—" : `${cp.toFixed(1)}%`}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: "8px 16px 16px" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, padding: "10px 4px 6px",
          fontSize: 10.5, color: sub, textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "'Inter', sans-serif",
        }}>
          <span>Assignment</span><span style={{ textAlign: "right" }}>Score</span><span style={{ textAlign: "right" }}>%</span><span></span>
        </div>
        {cls.assignments.map((a) => (
          <AssignmentRow
            key={a.id} a={a} cat={cls.categories.find((c) => c.id === a.catId)}
            mode={mode} accent={accent} onEdit={editScore} onDelete={removeAssignment} onToggle={toggleExcluded}
          />
        ))}
        <AddAssignment cats={cls.categories} mode={mode} accent={accent} onAdd={addAssignment} />
      </div>
    </div>
  );
}

function ClassEditor({ initial, mode, accent, onSave, onCancel, onDelete }) {
  const ink = mode === "dark" ? "#F5F1E8" : "#2B2B26";
  const sub = mode === "dark" ? "#A9A79C" : "#6B6B63";
  const border = mode === "dark" ? "#2E5647" : "#DDD5C4";
  const surface = mode === "dark" ? "#22453A" : "#FFFFFF";

  const [name, setName] = useState(initial?.name ?? "");
  const [teacher, setTeacher] = useState(initial?.teacher ?? "");
  const [level, setLevel] = useState(initial?.level ?? "Regular");
  const [cats, setCats] = useState(
    initial?.categories?.map((c) => ({ id: c.id, name: c.name, weight: String(c.weight) })) ??
    [{ id: nextId(), name: "Homework", weight: "20" }, { id: nextId(), name: "Tests", weight: "80" }]
  );
  const [error, setError] = useState("");

  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 7,
    border: `1px solid ${border}`, background: mode === "dark" ? "#1B3A2F" : "#fff",
    color: ink, fontSize: 12.5, fontFamily: "'Inter', sans-serif", outline: "none",
  };

  const updateCat = (id, field, val) => setCats((cs) => cs.map((c) => (c.id === id ? { ...c, [field]: val } : c)));
  const addCat = () => setCats((cs) => [...cs, { id: nextId(), name: "", weight: "" }]);
  const removeCat = (id) => setCats((cs) => cs.filter((c) => c.id !== id));

  const submit = () => {
    if (!name.trim()) { setError("Give the class a name."); return; }
    const cleaned = cats.map((c) => ({ ...c, weight: parseFloat(c.weight) || 0 })).filter((c) => c.name.trim());
    if (cleaned.length === 0) { setError("Add at least one grading category."); return; }
    onSave({ name: name.trim(), teacher: teacher.trim(), level, categories: cleaned });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(20,20,15,0.45)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 380, maxHeight: "85vh", overflowY: "auto", background: surface,
        borderRadius: 16, border: `1px solid ${border}`, padding: 18, fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 16, color: ink }}>
            {initial ? "Edit class" : "Add a class"}
          </span>
          <button onClick={onCancel} style={iconBtn(mode)}><X size={16} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: sub, marginBottom: 4 }}>Class name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AP Biology" style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: sub, marginBottom: 4 }}>Teacher</div>
            <input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="optional" style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: sub, marginBottom: 4 }}>Level</div>
            <select value={level} onChange={(e) => setLevel(e.target.value)} style={inputStyle}>
              <option value="Regular">Regular</option>
              <option value="Honors">Honors</option>
              <option value="AP">AP</option>
            </select>
          </div>

          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11, color: sub, marginBottom: 6 }}>Grading categories and weights</div>
            {cats.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input value={c.name} onChange={(e) => updateCat(c.id, "name", e.target.value)} placeholder="Category" style={{ ...inputStyle, flex: 1 }} />
                <input value={c.weight} onChange={(e) => updateCat(c.id, "weight", e.target.value)} placeholder="%" style={{ ...inputStyle, width: 52 }} />
                <button onClick={() => removeCat(c.id)} style={iconBtn(mode)}><X size={14} /></button>
              </div>
            ))}
            <button onClick={addCat} style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: accent,
              background: "transparent", border: "none", cursor: "pointer", padding: "4px 0",
            }}>
              <Plus size={13} /> Add category
            </button>
          </div>

          {error && <div style={{ fontSize: 11.5, color: "#C0392B" }}>{error}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={submit} style={{
              flex: 1, background: accent, color: "#fff", border: "none", borderRadius: 8,
              padding: "9px 0", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              {initial ? "Save changes" : "Create class"}
            </button>
            {initial && (
              <button onClick={onDelete} title="Delete class" style={{
                background: "transparent", border: `1px solid #C0392B77`, color: "#C0392B",
                borderRadius: 8, padding: "9px 12px", cursor: "pointer",
              }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ mode, setMode, accent, setAccent, weighted, setWeighted, classes, source, onSignOut, onBack, prefs, setPrefs, ext, onTestConfetti }) {
  const ink = mode === "dark" ? "#F5F1E8" : "#2B2B26";
  const sub = mode === "dark" ? "#A9A79C" : "#6B6B63";
  const surface = mode === "dark" ? "#22453A" : "#FFFFFF";
  const border = mode === "dark" ? "#2E5647" : "#EAE3D3";
  const { gpa } = computeGpa(classes, weighted);
  const [custom, setCustom] = useState(accent);

  return (
    <div style={{ padding: "16px 18px 30px", maxWidth: 480 }}>
      <div style={{ fontFamily: "'Lora', serif", fontSize: 19, fontWeight: 700, color: ink, marginBottom: 4 }}>
        Make it yours
      </div>
      <div style={{ fontSize: 12, color: sub, marginBottom: 20 }}>Ledger's colors and GPA scale, your call.</div>

      <SettingsSection title="Accent color" mode={mode} surface={surface} border={border}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          {ACCENTS.map((sw) => (
            <button key={sw.value} onClick={() => setAccent(sw.value)} title={sw.name} style={{
              width: 34, height: 34, borderRadius: "50%", background: sw.value, cursor: "pointer",
              border: accent === sw.value ? `2.5px solid ${ink}` : "2.5px solid transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {accent === sw.value && <Check size={14} color="#fff" />}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="color" value={custom} onChange={(e) => { setCustom(e.target.value); setAccent(e.target.value); }}
            style={{ width: 34, height: 34, border: "none", borderRadius: 8, padding: 0, cursor: "pointer", background: "none" }} />
          <span style={{ fontSize: 12, color: sub, fontFamily: "'JetBrains Mono', monospace" }}>custom hex</span>
        </div>
      </SettingsSection>

      <SettingsSection title="Background" mode={mode} surface={surface} border={border}>
        <div style={{ display: "flex", gap: 8 }}>
          {[{ id: "light", label: "Paper", swatch: "#FBF8F1" }, { id: "dark", label: "Chalkboard", swatch: "#1B3A2F" }].map((opt) => (
            <button key={opt.id} onClick={() => setMode(opt.id)} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif",
              border: mode === opt.id ? `2px solid ${accent}` : `1px solid ${border}`,
              background: opt.swatch, color: opt.id === "dark" ? "#F5F1E8" : "#2B2B26", fontSize: 12.5, fontWeight: 600,
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="GPA scale" mode={mode} surface={surface} border={border}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12.5, color: ink, fontWeight: 500 }}>Weighted GPA</div>
            <div style={{ fontSize: 11, color: sub, marginTop: 1 }}>+1.0 for AP, +0.5 for Honors</div>
          </div>
          <Toggle checked={weighted} onChange={setWeighted} accent={accent} mode={mode} />
        </div>
        <div style={{ marginTop: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: accent }}>
          {gpa == null ? "—" : gpa.toFixed(2)}
        </div>
        <div style={{ fontSize: 10.5, color: sub }}>current cumulative GPA on a 4.0 base scale</div>
      </SettingsSection>

      <SettingsSection title="Fun & alerts" mode={mode} surface={surface} border={border}>
        {[
          ["confetti", "Confetti", "Celebrate GPA highs, goals, badges, perfect scores and letter-ups."],
          ["toasts", "Grade pop-ups", "A small note when a new grade posts."],
          ["alerts", "Desktop alerts", "A notification when a grade posts, even if Ledger is closed. Checks every couple of minutes."],
        ].map(([k, label, hint]) => {
          const blocked = k === "alerts" && !ext;
          return (
            <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 0", opacity: blocked ? 0.55 : 1 }}>
              <div>
                <div style={{ fontSize: 12.5, color: ink, fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 11, color: sub, marginTop: 1, lineHeight: 1.4 }}>{blocked ? "Needs the Ledger Importer extension." : hint}</div>
              </div>
              <div style={{ pointerEvents: blocked ? "none" : "auto" }}>
                <Toggle checked={!!prefs[k] && !blocked} onChange={(v) => setPrefs((p) => ({ ...p, [k]: v }))} accent={accent} mode={mode} />
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {[["small", "Try a little"], ["medium", "Try a lot"], ["mega", "Try everything"]].map(([lv, label]) => (
            <button key={lv} disabled={!prefs.confetti} onClick={() => onTestConfetti(lv)} style={{
              padding: "7px 12px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: ink, fontSize: 12,
              cursor: prefs.confetti ? "pointer" : "default", opacity: prefs.confetti ? 1 : 0.5, fontFamily: "'Inter', sans-serif",
            }}>{label}</button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Your data" mode={mode} surface={surface} border={border}>
        <div style={{ fontSize: 12, color: sub, lineHeight: 1.5 }}>
          {source
            ? `Grades imported from ${source.host || "Aeries"}${formatStamp(source)}. They're saved in this browser only, so you don't have to import again. Anyone who uses this browser profile could see them.`
            : "You're looking at the demo gradebook. Nothing here is saved."}
        </div>
        <button onClick={onSignOut} style={{
          marginTop: 10, padding: "9px 14px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
          fontFamily: "'Inter', sans-serif", background: "transparent", color: ink, border: `1px solid ${border}`,
        }}>
          {source ? "Forget my data and sign out" : "Back to the start screen"}
        </button>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({ title, children, mode, surface, border }) {
  const ink = mode === "dark" ? "#F5F1E8" : "#2B2B26";
  return (
    <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: ink, marginBottom: 10, fontFamily: "'Inter', sans-serif" }}>{title}</div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, accent, mode }) {
  return (
    <button onClick={() => onChange(!checked)} style={{
      width: 40, height: 22, borderRadius: 20, border: "none", cursor: "pointer", position: "relative",
      background: checked ? accent : (mode === "dark" ? "#3A5C4F" : "#DDD5C4"), transition: "background 0.15s",
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3,
        left: checked ? 21 : 3, transition: "left 0.15s",
      }} />
    </button>
  );
}

/* ----------------------------------- app ------------------------------------ */

/* ------------------------------ Aeries import ------------------------------ */
// The Ledger browser extension sends grades here. Everything is validated and
// size-limited before it touches state, and nothing is applied without a confirm.

function validateImport(raw) {
  const bad = (m) => ({ error: "That import doesn't look right: " + m + "." });
  const str = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
  const fin = (v) => typeof v === "number" && Number.isFinite(v);
  if (!raw || typeof raw !== "object" || raw.version !== 1) return bad("unknown format");
  if (!Array.isArray(raw.classes) || raw.classes.length < 1 || raw.classes.length > 20) return bad("no classes found");
  const classes = [];
  for (const c of raw.classes) {
    if (!c || typeof c !== "object") return bad("a class entry is broken");
    const name = str(c.name, 80);
    if (!name) return bad("a class has no name");
    if (!Array.isArray(c.categories) || c.categories.length > 12) return bad("categories for " + name);
    const categories = [];
    for (const k of c.categories) {
      const kn = str(k && k.name, 60);
      if (!kn || !fin(k.weight) || k.weight < 0 || k.weight > 100) return bad("a category in " + name);
      categories.push({ name: kn, weight: k.weight });
    }
    if (!Array.isArray(c.assignments) || c.assignments.length > 500) return bad("assignments for " + name);
    const names = new Set(categories.map((k) => k.name));
    const assignments = [];
    for (const a of c.assignments) {
      const cat = str(a && a.category, 60);
      if (!names.has(cat) || !fin(a.earned) || !fin(a.possible) || a.possible <= 0) return bad("an assignment in " + name);
      assignments.push({
        category: cat, name: str(a.name, 120) || "Assignment", earned: a.earned, possible: a.possible,
        due: typeof a.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.due) ? a.due : null,
      });
    }
    classes.push({
      name, teacher: str(c.teacher, 80), term: str(c.term, 30), period: str(c.period, 4),
      level: Object.prototype.hasOwnProperty.call(LEVEL_BONUS, c.level) ? c.level : "Regular",
      categories, assignments,
      reportedPercent: fin(c.reportedPercent) ? c.reportedPercent : null,
      pending: Array.isArray(c.pending)
        ? c.pending.slice(0, 60).filter((p) => p && fin(p.possible) && p.possible > 0 && typeof p.name === "string").map((p) => ({
            category: str(p.category, 60), name: str(p.name, 120), possible: p.possible, complete: p.complete === true,
            due: typeof p.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.due) ? p.due : null,
          }))
        : [],
      termStart: typeof c.termStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.termStart) ? c.termStart : null,
      termEnd: typeof c.termEnd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.termEnd) ? c.termEnd : null,
      reportedMark: typeof c.reportedMark === "string" && /^[A-F][+-]?$/.test(c.reportedMark) ? c.reportedMark : null,
      marks: Array.isArray(c.marks)
        ? c.marks.slice(0, 20).filter((m) => m && fin(m.pct) && m.pct >= 0 && m.pct <= 1000 && typeof m.mark === "string" && /^[A-F][+-]?$/.test(m.mark)).map((m) => ({ pct: m.pct, mark: m.mark }))
        : [],
      warnings: Array.isArray(c.warnings) ? c.warnings.slice(0, 5).map((w) => str(w, 140)) : [],
    });
  }
  return { payload: { host: str(raw.host, 80), base: typeof raw.base === "string" && /^\/([A-Za-z0-9_.-]+\/)+$/.test(raw.base) && raw.base.length <= 80 && !raw.base.includes("..") ? raw.base : "/student/", readAt: str(raw.readAt, 40), classes } };
}

// Debug info from the extension is only ever copied to the clipboard, never used. Keep it small and plain.
function cleanDiag(d) {
  try { return Array.isArray(d) && JSON.stringify(d).length < 80000 ? d : null; } catch { return null; }
}

function classesFromImport(payload) {
  return payload.classes.map((c) => {
    const categories = c.categories.map((k) => ({ id: nextId(), name: k.name, weight: k.weight }));
    const byName = new Map(categories.map((k) => [k.name, k]));
    const cls = {
      id: nextId(), name: c.name, teacher: c.teacher, level: c.level, categories,
      assignments: c.assignments.map((a) => ({
        id: nextId(), catId: byName.get(a.category).id, name: a.name,
        earned: a.earned, possible: a.possible, due: a.due || null, isWhatIf: false, original: null,
      })),
      mark: c.reportedMark || null, // the letter Aeries shows for this class
      marks: c.marks || [], // the (percent, letter) pairs Aeries gave for it
      pending: c.pending || [], // work with no score yet
      termStart: c.termStart || null,
      termEnd: c.termEnd || null,
    };
    cls.basePct = classPercent(cls).pct; // what Ledger computes from the real scores, so we can tell when what-ifs moved it
    return cls;
  });
}

// A short fingerprint of what Aeries said. If it hasn't changed, a refresh leaves everything alone.
function sigOf(payload) {
  const str = JSON.stringify(payload.classes);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0) + ":" + str.length;
}

// A refresh replaces the real grades with fresh ones from Aeries, but keeps what you did yourself:
// what-if assignments you added, scores you edited (while Aeries' real score hasn't changed), and any
// level you changed. Classes, categories and assignments that already existed keep their ids, so
// whatever you have open stays open.
function mergeRefresh(prevClasses, payload) {
  const norm = (s) => String(s).trim().toLowerCase();
  const merged = classesFromImport(payload).map((n) => {
    const old = prevClasses.find((o) => norm(o.name) === norm(n.name));
    if (!old) return n;

    const oldCat = new Map(old.categories.map((k) => [norm(k.name), k]));
    const catId = new Map(); // fresh category id -> id to keep
    const categories = n.categories.map((k) => {
      const ok = oldCat.get(norm(k.name));
      if (!ok) return k;
      catId.set(k.id, ok.id);
      return { ...k, id: ok.id };
    });

    // existing real assignments (possibly edited), looked up by category + name
    const oldCatName = new Map(old.categories.map((k) => [k.id, norm(k.name)]));
    const freshCatName = new Map(n.categories.map((k) => [k.id, norm(k.name)]));
    const byKey = new Map();
    for (const a of old.assignments) {
      if (a.isWhatIf && a.original == null) continue; // a what-if you added: handled below
      const key = oldCatName.get(a.catId) + "|" + norm(a.name);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(a);
    }
    const assignments = n.assignments.map((a) => {
      const k = catId.has(a.catId) ? catId.get(a.catId) : a.catId;
      const o = (byKey.get(freshCatName.get(a.catId) + "|" + norm(a.name)) || []).shift();
      if (!o) return { ...a, catId: k };
      const base = { ...a, id: o.id, catId: k, ...(o.excluded ? { excluded: true } : {}) };
      // you edited this score: keep your edit until Aeries' real score changes
      if (o.original != null && o.original === a.earned) return { ...base, earned: o.earned, isWhatIf: true, original: a.earned };
      return base;
    });

    // what-ifs you added, re-attached by category name (dropped if that category is gone)
    const freshByName = new Map(categories.map((k) => [norm(k.name), k]));
    const mine = old.assignments
      .filter((a) => a.isWhatIf && a.original == null)
      .map((a) => {
        const k = freshByName.get(oldCatName.get(a.catId));
        return k ? { ...a, catId: k.id } : null;
      })
      .filter(Boolean);

    return { ...n, id: old.id, level: old.level, categories, assignments: assignments.concat(mine) };
  });
  return merged;
}

function SyncPill({ sync, onCancel, onRetry }) {
  const p = sync.phase;
  const working = p === "starting" || p === "login" || p === "reading";
  if (!working && p !== "done" && p !== "error") return null;
  const bad = p === "error";
  const text = p === "starting" ? "Opening Aeries…"
    : p === "login" ? "Sign in to Aeries in the tab that just opened. Ledger continues by itself."
    : p === "reading" ? (sync.detail || "Reading your grades…")
    : p === "done" ? "Updated from Aeries."
    : (sync.detail || "Couldn't update from Aeries.");
  const btn = {
    background: "rgba(255,255,255,.18)", border: "none", color: "#fff", borderRadius: 7, padding: "4px 9px",
    cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif",
  };
  return (
    <div role="status" style={{
      position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 65, maxWidth: "92vw",
      background: bad ? "#B3432F" : "#1B3A2F", color: "#fff", padding: "9px 12px", borderRadius: 10, fontSize: 12.5,
      fontFamily: "'Inter', sans-serif", display: "flex", gap: 10, alignItems: "center", boxShadow: "0 6px 18px rgba(0,0,0,.25)",
    }}>
      <span>{text}</span>
      {working && <button onClick={onCancel} style={btn}>Cancel</button>}
      {bad && onRetry && <button onClick={onRetry} style={btn}>Retry</button>}
      {bad && <button onClick={onCancel} style={btn}>Dismiss</button>}
    </div>
  );
}

function ImportPrompt({ pending, mode, accent, onApply, onCancel }) {
  const surface = mode === "dark" ? "#22453A" : "#FBF8F1";
  const border = mode === "dark" ? "#3A5C4F" : "#E4DEC0";
  const ink = mode === "dark" ? "#F5F1E8" : "#2B2B26";
  const sub = mode === "dark" ? "#A9A79C" : "#6B6B63";
  const { payload, classes } = pending;
  const [copied, setCopied] = useState("");
  const fmt = (v) => (v == null ? "—" : v.toFixed(1) + "%");
  const anyOff = classes.some((c, i) => {
    const src = payload.classes[i];
    const mine = classPercent(c).pct;
    return src.warnings.length > 0 || (src.reportedPercent != null && mine != null && Math.abs(mine - src.reportedPercent) > 0.5);
  });
  const copyDebug = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ ledgerImporterDebug: { version: "0.5", classes: pending.diag } }, null, 1));
      setCopied("Copied.");
    } catch {
      setCopied("Couldn't copy to the clipboard.");
    }
  };
  let when = "";
  try { when = payload.readAt ? new Date(payload.readAt).toLocaleString() : ""; } catch { /* ignore */ }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(20,20,15,0.45)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 440, maxHeight: "85vh", overflowY: "auto", background: surface,
        borderRadius: 16, border: `1px solid ${border}`, padding: 18, fontFamily: "'Inter', sans-serif", color: ink,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 16 }}>Import from Aeries?</span>
          <button onClick={onCancel} style={iconBtn(mode)} aria-label="Cancel"><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12, color: sub, lineHeight: 1.5, margin: "0 0 12px" }}>
          {classes.length} {classes.length === 1 ? "class" : "classes"} from {payload.host || "Aeries"}{when ? ` · read ${when}` : ""}.
          Importing replaces the classes you have in Ledger right now.
        </p>
        {classes.map((c, i) => {
          const src = payload.classes[i];
          const mine = classPercent(c).pct;
          const differs = src.reportedPercent != null && mine != null && Math.abs(mine - src.reportedPercent) > 0.5;
          return (
            <div key={c.id} style={{ padding: "9px 0", borderTop: `1px solid ${border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, fontWeight: 600 }}>
                <span>{src.period ? `${src.period}. ` : ""}{c.name}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 12, color: sub, whiteSpace: "nowrap" }}>
                  {c.assignments.length} graded
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: sub, marginTop: 2 }}>
                {c.teacher ? c.teacher + " · " : ""}{c.level} · Ledger {fmt(mine)}
                {src.reportedPercent != null ? ` · Aeries ${fmt(src.reportedPercent)}${src.reportedMark ? " (" + src.reportedMark + ")" : ""}` : src.reportedMark ? ` · Aeries ${src.reportedMark}` : ""}
              </div>
              {differs && (
                <div style={{ fontSize: 11, color: "#B3432F", marginTop: 3, lineHeight: 1.45 }}>
                  These differ. Aeries may apply extra rules, such as a minimum score on low grades.
                </div>
              )}
              {src.warnings.map((w, j) => (
                <div key={j} style={{ fontSize: 11, color: "#B3432F", marginTop: 3, lineHeight: 1.45 }}>{w}</div>
              ))}
            </div>
          );
        })}
        {pending.diag && anyOff && (
          <div style={{ marginTop: 12, fontSize: 11.5, color: sub, lineHeight: 1.5 }}>
            Something look off?{" "}
            <button onClick={copyDebug} style={{
              background: "none", border: "none", padding: 0, color: accent, textDecoration: "underline",
              cursor: "pointer", fontSize: 11.5, fontFamily: "'Inter', sans-serif",
            }}>Copy debug info</button>
            {copied ? " " + copied : ""}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${border}`, background: "transparent",
            color: ink, fontSize: 13, cursor: "pointer", fontFamily: "'Inter', sans-serif",
          }}>Cancel</button>
          <button onClick={onApply} style={{
            flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: accent, color: "#fff",
            fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'Inter', sans-serif",
          }}>Replace my classes</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [saved] = useState(loadSavedData); // set when this browser has imported grades from before
  const [loggedIn, setLoggedIn] = useState(!!saved);
  const [classes, setClasses] = useState(() => (saved ? saved.classes : seedData()));
  const [source, setSource] = useState(saved ? saved.source : null); // { host, readAt } once grades were imported
  const [prefs, setPrefs] = useState(() => sanitizePrefs(saved && saved.prefs)); // confetti, pop-ups, desktop alerts
  const [goals, setGoals] = useState(() => sanitizeGoals(saved && saved.goals));
  const [meta, setMeta] = useState(() => sanitizeMeta(saved && saved.meta)); // best GPA so far, what has been celebrated
  const [toasts, setToasts] = useState([]);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const classesRef = useRef(classes);
  classesRef.current = classes;
  const toastId = useRef(0);
  const pushToast = (text, tone) => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts.slice(-3), { id, text, tone: tone || "plain" }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 9000);
  };
  const celebrate = (level, text, tone) => {
    if (prefsRef.current.confetti && level) launchConfetti(level);
    if (prefsRef.current.toasts && text) pushToast(text, tone || "good");
  };
  useEffect(() => { setConfettiOn(prefs.confetti); }, [prefs.confetti]);
  const [view, setView] = useState("dashboard");
  const [openClassId, setOpenClassId] = useState(null);
  const [mode, setMode] = useState(saved && saved.mode === "dark" ? "dark" : "light");
  const [accent, setAccent] = useState(saved && typeof saved.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(saved.accent) ? saved.accent : ACCENTS[0].value);
  const [weighted, setWeighted] = useState(saved ? saved.weighted !== false : true);
  const [editorId, setEditorId] = useState(null); // null closed, "new", or a class id

  const [pendingImport, setPendingImport] = useState(null); // { payload, classes } waiting for a confirm
  const [importError, setImportError] = useState("");

  useEffect(() => {
    const receive = (raw, diag) => {
      const r = validateImport(raw);
      if (r.error) { setImportError(r.error); return; }
      setImportError("");
      setPendingImport({ payload: r.payload, classes: classesFromImport(r.payload), diag: cleanDiag(diag) });
    };
    // Direct handoff: only the tab that opened Ledger (the Aeries tab) may send.
    const onMessage = (ev) => {
      if (!window.opener || ev.source !== window.opener) return;
      if (!ev.data || ev.data.type !== "ledger:import") return;
      receive(ev.data.payload, ev.data.diag);
    };
    // Fallback: the extension can copy the grades; pressing paste anywhere in Ledger imports them.
    const onPaste = (ev) => {
      const t = ev.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const text = (ev.clipboardData && ev.clipboardData.getData("text")) || "";
      if (!text.startsWith('{"ledgerImport"')) return;
      ev.preventDefault();
      try { receive(JSON.parse(text).ledgerImport); } catch { setImportError("That clipboard text isn't a valid Ledger import."); }
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("paste", onPaste);
    try {
      // Tell the opening tab we're ready. This ping carries no data.
      if (window.opener && window.opener !== window) window.opener.postMessage({ type: "ledger:ready" }, "*");
    } catch { /* no opener: fine */ }
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("paste", onPaste);
    };
  }, []);

  const applyImport = () => {
    if (!pendingImport) return;
    setClasses(pendingImport.classes);
    setSource({ host: pendingImport.payload.host, base: pendingImport.payload.base, readAt: pendingImport.payload.readAt, sig: sigOf(pendingImport.payload) });
    setLoggedIn(true);
    setView("dashboard");
    setOpenClassId(null);
    setEditorId(null);
    setPendingImport(null);
  };

  // --- talking to the Ledger Importer extension (it announces itself when installed) ---
  const [ext, setExt] = useState(null); // { version } once the extension answers
  const [sync, setSync] = useState({ phase: "idle", detail: "" }); // the status bar: manual refreshes only
  const [signedOut, setSignedOut] = useState(false); // a quiet check found that Aeries has logged you out
  const intentRef = useRef("first"); // "first": show the confirm screen. "refresh": merge.
  const silentRef = useRef(false); // true while a quiet check is in flight
  const busyRef = useRef(0); // when that check started (0 = none)
  const failRef = useRef(0);
  const nextOkRef = useRef(0); // don't check again before this time (backing off after errors)
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const signedOutRef = useRef(false);
  signedOutRef.current = signedOut;
  const syncing = sync.phase === "starting" || sync.phase === "login" || sync.phase === "reading";

  // Which portal folder this host uses: from the last read, else from the school that was picked.
  const baseForHost = (host) => {
    if (source && source.host === host && source.base) return source.base;
    const sch = loadSchool();
    return sch && sch.host === host ? (sch.base || baseOfPortal(sch.portal)) : "/student/";
  };
  const forceRef = useRef(true); // the first quiet check after opening Ledger is always a full read
  const requestGrades = (host, intent, silent, force) => {
    intentRef.current = intent;
    silentRef.current = !!silent;
    if (silent) {
      busyRef.current = Date.now();
    } else {
      setSync({ phase: "starting", detail: "" });
      setSignedOut(false);
    }
    window.postMessage({ type: "ledger:req-refresh", host, base: baseForHost(host), mode: silent ? "silent" : "manual", force: !!force }, window.location.origin);
  };
  const cancelSync = () => {
    window.postMessage({ type: "ledger:req-cancel" }, window.location.origin);
    setSync({ phase: "idle", detail: "" });
  };

  useEffect(() => {
    const onMsg = (ev) => {
      if (ev.source !== window || ev.origin !== window.location.origin) return;
      const d = ev.data;
      if (!d || typeof d.type !== "string") return;
      if (d.type === "ledger:ext-ready") {
        setExt({ version: String(d.version || "") });
      } else if (d.type === "ledger:ext-status") {
        const ph = String(d.phase || "").slice(0, 20);
        if (silentRef.current) {
          // a quiet check says nothing unless something is wrong
          if (ph === "unchanged") {
            busyRef.current = 0; failRef.current = 0; setSignedOut(false);
            setSource((s) => (s && Date.now() - Date.parse(s.readAt) > 60000 ? { ...s, readAt: new Date().toISOString() } : s));
          } else if (ph === "signedout") {
            busyRef.current = 0; setSignedOut(true);
          } else if (ph === "silent-error") {
            busyRef.current = 0; failRef.current += 1;
            nextOkRef.current = Date.now() + Math.min(300000, 10000 * 2 ** failRef.current);
          }
        } else {
          setSync({ phase: ph, detail: String(d.detail || "").slice(0, 200) });
        }
      } else if (d.type === "ledger:ext-result") {
        const silent = silentRef.current;
        busyRef.current = 0;
        const r = validateImport(d.payload);
        if (r.error) {
          if (silent) { failRef.current += 1; nextOkRef.current = Date.now() + 60000; } else setSync({ phase: "error", detail: r.error });
          return;
        }
        failRef.current = 0;
        setSignedOut(false);
        const sig = sigOf(r.payload);
        if (intentRef.current === "refresh" && sourceRef.current) {
          const ann = announceChanges(classesRef.current, r.payload);
          if (prefsRef.current.toasts) for (const tt of ann.toasts) pushToast(tt.text, tt.tone);
          if (ann.level && prefsRef.current.confetti) launchConfetti(ann.level);
          // Always merge: it keeps your what-ifs and puts back anything real that is missing. If that changes
          // nothing, the very same list is returned and the screen is left alone.
          setClasses((prev) => {
            const merged = mergeRefresh(prev, r.payload);
            return classesKey(merged) === classesKey(prev) ? prev : merged;
          });
          setSource({ host: r.payload.host, base: r.payload.base, readAt: r.payload.readAt, sig });
          if (!silent) setSync({ phase: "done", detail: "" });
        } else {
          setSync({ phase: "idle", detail: "" });
          setImportError("");
          setPendingImport({ payload: r.payload, classes: classesFromImport(r.payload), diag: cleanDiag(d.diag) });
        }
      }
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ type: "ledger:req-ping" }, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Quiet refresh: while Ledger is open and in front, check Aeries every 10 seconds.
  const hostNow = source ? source.host : null;
  useEffect(() => {
    if (!ext || !hostNow) return undefined;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (signedOutRef.current) return; // needs a sign-in first (the notice under the top bar has the button)
      const ph = syncRef.current.phase;
      if (ph === "starting" || ph === "login" || ph === "reading") return; // a manual refresh is running
      if (busyRef.current && Date.now() - busyRef.current < 90000) return; // the last check hasn't come back yet
      if (Date.now() < nextOkRef.current) return;
      const force = forceRef.current;
      forceRef.current = false;
      requestGrades(hostNow, "refresh", true, force);
    };
    tick();
    const id = setInterval(tick, 10000);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [ext, hostNow]);

  useEffect(() => {
    if (sync.phase !== "done") return undefined;
    const t = setTimeout(() => setSync({ phase: "idle", detail: "" }), 3500);
    return () => clearTimeout(t);
  }, [sync.phase]);

  // Save after every change, but only once real grades have been imported (never the demo).
  useEffect(() => {
    if (!source) return;
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify({ v: 1, classes, mode, accent, weighted, source, prefs, goals, meta }));
    } catch { /* storage blocked or full: Ledger still works, it just won't remember */ }
  }, [classes, mode, accent, weighted, source, prefs, goals, meta]);

  const signOut = () => {
    try { localStorage.removeItem(DATA_KEY); } catch { /* ignore */ }
    setSource(null);
    setClasses(seedData());
    setLoggedIn(false);
    setView("dashboard");
    setOpenClassId(null);
    setEditorId(null);
  };

  const { gpa } = useMemo(() => computeGpa(classes, weighted), [classes, weighted]);
  // Real grades only (no what-ifs): this is what celebrations and goals look at.
  const realGpa = useMemo(() => computeGpa(classes.map(realOf), weighted).gpa, [classes, weighted]);

  useEffect(() => {
    if (!source) return;
    const plan = planCelebrations(metaRef.current, {
      realGpa, weighted,
      statuses: goalStatuses(goals, classes, realGpa),
      badges: badgesFor(classes, { today: todayDay(), weighted, goals }),
    });
    for (const c of plan.celebrations) celebrate(c.level, c.text);
    if (plan.changed) setMeta(plan.meta);
  }, [classes, goals, weighted, source, realGpa]);

  // desktop alerts (the extension does these, even when Ledger is closed)
  useEffect(() => {
    if (!ext || !hostNow) return;
    window.postMessage({ type: "ledger:req-alerts", host: hostNow, base: baseForHost(hostNow), on: !!prefs.alerts }, window.location.origin);
  }, [ext, hostNow, prefs.alerts]);

  const bg = mode === "dark" ? "#1B3A2F" : "#FBF8F1";
  const ink = mode === "dark" ? "#F5F1E8" : "#2B2B26";

  const updateClass = (updated) => {
    setClasses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const editingClass = editorId != null && editorId !== "new" ? classes.find((c) => c.id === editorId) : null;

  const saveClassMeta = ({ name, teacher, level, categories }) => {
    if (editorId === "new") {
      const newClass = {
        id: nextId(), name, teacher, level,
        categories: categories.map((c) => ({ id: c.id, name: c.name, weight: c.weight })),
        assignments: [],
      };
      setClasses((prev) => [...prev, newClass]);
    } else {
      setClasses((prev) => prev.map((c) => {
        if (c.id !== editorId) return c;
        const keepIds = new Set(categories.map((cat) => cat.id));
        return {
          ...c, name, teacher, level,
          categories: categories.map((cat) => ({ id: cat.id, name: cat.name, weight: cat.weight })),
          assignments: c.assignments.filter((a) => keepIds.has(a.catId)),
        };
      }));
    }
    setEditorId(null);
  };

  const deleteClass = () => {
    setClasses((prev) => prev.filter((c) => c.id !== editorId));
    if (openClassId === editorId) { setOpenClassId(null); setView("dashboard"); }
    setEditorId(null);
  };

  return (
    <div style={{
      background: bg, color: ink, minHeight: "100vh", borderRadius: 0, overflow: "hidden",
      fontFamily: "'Inter', sans-serif",
      backgroundImage: mode === "light"
        ? "repeating-linear-gradient(180deg, transparent, transparent 27px, #EFE8D766 28px)"
        : "none",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,600;0,700;1,600&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Caveat:wght@600;700&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus { outline: none; box-shadow: 0 0 0 2px ${accent}55; }
      `}</style>

      {!loggedIn ? (
        <>
          <div style={{ padding: "14px 18px 0", display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GraduationCap size={15} color="#fff" />
            </div>
            <span style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 15 }}>Ledger</span>
          </div>
          <LoginScreen onLogin={() => setLoggedIn(true)} mode={mode} accent={accent}
            ext={ext} sync={sync} onGetGrades={(host) => requestGrades(host, "first")} />
        </>
      ) : (
        <>
          <NavBar view={view} setView={(v) => { setView(v); setOpenClassId(null); }} mode={mode} accent={accent} gpa={gpa} />
          {source && (
            <div style={{ padding: "6px 18px 0", fontSize: 11, color: mode === "dark" ? "#A9A79C" : "#6B6B63", fontFamily: "'Inter', sans-serif" }}>
              Grades from {source.host || "Aeries"}{formatStamp(source)}
              {ext && (
                <button onClick={() => requestGrades(source.host, "refresh")} disabled={syncing} style={{
                  marginLeft: 8, background: "none", border: "none", padding: 0, color: accent, textDecoration: "underline",
                  cursor: syncing ? "default" : "pointer", fontSize: 11, fontFamily: "'Inter', sans-serif",
                }}>
                  {syncing ? "Refreshing…" : "Refresh now"}
                </button>
              )}
              {signedOut && (
                <span style={{ marginLeft: 8 }}>
                  Aeries signed you out.{" "}
                  <button onClick={() => requestGrades(source.host, "refresh")} style={{
                    background: "none", border: "none", padding: 0, color: accent, textDecoration: "underline",
                    cursor: "pointer", fontSize: 11, fontFamily: "'Inter', sans-serif",
                  }}>Sign in</button>
                </span>
              )}
            </div>
          )}
          {view === "dashboard" && (
            <Dashboard classes={classes} mode={mode} accent={accent} weighted={weighted}
              onOpenClass={(id) => { setOpenClassId(id); setView("class"); }}
              onEditClass={(id) => setEditorId(id)}
              onAddClass={() => setEditorId("new")}
            />
          )}
          {view === "timeline" && (
            <TimelineView classes={classes} mode={mode} accent={accent} weighted={weighted}
              onOpenClass={(id) => { setOpenClassId(id); setView("class"); }} />
          )}
          {view === "insights" && (
            <InsightsView classes={classes} mode={mode} accent={accent} today={todayDay()}
              onOpenClass={(id) => { setOpenClassId(id); setView("class"); }} />
          )}
          {view === "plan" && (
            <PlanView classes={classes} mode={mode} accent={accent} weighted={weighted} today={todayDay()}
              onOpenClass={(id) => { setOpenClassId(id); setView("class"); }} />
          )}
          {view === "goals" && (
            <GoalsView classes={classes} mode={mode} accent={accent} weighted={weighted} goals={goals} setGoals={setGoals}
              prefs={prefs} today={todayDay()} realGpa={realGpa}
              onOpenClass={(id) => { setOpenClassId(id); setView("class"); }} onCelebrate={(lv) => celebrate(lv)} />
          )}
          {view === "class" && openClassId != null && classes.some((c) => c.id === openClassId) && (
            <ClassView
              cls={classes.find((c) => c.id === openClassId)}
              mode={mode} accent={accent}
              onBack={() => setView("dashboard")}
              onUpdateClass={updateClass}
            />
          )}
          {view === "settings" && (
            <SettingsPanel
              mode={mode} setMode={setMode} accent={accent} setAccent={setAccent}
              weighted={weighted} setWeighted={setWeighted} classes={classes}
              source={source} onSignOut={signOut}
              prefs={prefs} setPrefs={setPrefs} ext={ext} onTestConfetti={(lv) => celebrate(lv)}
              onBack={() => setView("dashboard")}
            />
          )}
        </>
      )}

      <ToastStack toasts={toasts} mode={mode} onDismiss={(id) => setToasts((ts) => ts.filter((x) => x.id !== id))} />
      <SyncPill sync={sync} onCancel={cancelSync} onRetry={source ? () => requestGrades(source.host, "refresh") : null} />
      {pendingImport && (
        <ImportPrompt pending={pendingImport} mode={mode} accent={accent}
          onApply={applyImport} onCancel={() => setPendingImport(null)} />
      )}
      {importError && (
        <div role="alert" style={{
          position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 70, maxWidth: "90vw",
          background: "#B3432F", color: "#fff", padding: "9px 12px", borderRadius: 10, fontSize: 12.5,
          fontFamily: "'Inter', sans-serif", display: "flex", gap: 10, alignItems: "center",
        }}>
          <span>{importError}</span>
          <button onClick={() => setImportError("")} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0 }} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      {editorId != null && (
        <ClassEditor
          initial={editingClass}
          mode={mode} accent={accent}
          onSave={saveClassMeta}
          onCancel={() => setEditorId(null)}
          onDelete={deleteClass}
        />
      )}
    </div>
  );
}