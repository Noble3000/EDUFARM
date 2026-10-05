// Grades unit tests — pure calculation, no database.
// Covers: one semester, multiple semesters, repeated-course policy,
// zero-units validation, all-A, all-F, mixed grades, degree-class boundaries.
// Run: pnpm --filter @edufarm/api exec vitest run src/routes/grades.unit.test.ts
import { describe, expect, it } from "vitest";
import { GRADE_POINTS, degreeClass, gpaOf } from "./grades.js";

describe("grade points (Nigerian 5-point scale)", () => {
  it("maps A–F to 5–0", () => {
    expect(GRADE_POINTS).toMatchObject({ A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 });
  });
});

describe("one semester", () => {
  it("computes GPA as Σ(point × units) ÷ Σunits", () => {
    // BIO 201 A(3u) + CHM 201 B(3u) + PHY 201 C(2u) → (15+12+6)/8 = 4.125 → 4.13
    const r = gpaOf([
      { units: 3, grade: "A" },
      { units: 3, grade: "B" },
      { units: 2, grade: "C" },
    ]);
    expect(r).toEqual({ gpa: 4.13, units: 8 });
  });
});

describe("multiple semesters (CGPA across all courses)", () => {
  it("weights every semester by units", () => {
    const s1 = [
      { units: 3, grade: "A" },
      { units: 3, grade: "B" },
    ]; // 27 pts / 6u
    const s2 = [
      { units: 2, grade: "C" },
      { units: 4, grade: "B" },
    ]; // 22 pts / 6u
    expect(gpaOf(s1)).toEqual({ gpa: 4.5, units: 6 });
    expect(gpaOf(s2)).toEqual({ gpa: 3.67, units: 6 });
    expect(gpaOf([...s1, ...s2])).toEqual({ gpa: 4.08, units: 12 }); // 49/12
  });
});

describe("repeated course records policy (all-in: every attempt counts)", () => {
  it("counts the same code twice across semesters", () => {
    const first = [{ units: 3, grade: "F" }];
    const retake = [{ units: 3, grade: "B" }];
    const cgpa = gpaOf([...first, ...retake]);
    expect(cgpa).toEqual({ gpa: 2, units: 6 }); // (0+12)/6 — failure still weighs
  });
});

describe("zero units validation", () => {
  it("returns null GPA instead of dividing by zero", () => {
    expect(gpaOf([])).toEqual({ gpa: null, units: 0 });
    expect(degreeClass(null)).toBe("—");
  });
});

describe("all A", () => {
  it("yields 5.0 First Class", () => {
    const r = gpaOf([
      { units: 3, grade: "A" },
      { units: 4, grade: "A" },
      { units: 2, grade: "A" },
    ]);
    expect(r).toEqual({ gpa: 5, units: 9 });
    expect(degreeClass(r.gpa)).toBe("First Class");
  });
});

describe("all F", () => {
  it("yields 0.0 Pass/Fail zone", () => {
    const r = gpaOf([
      { units: 3, grade: "F" },
      { units: 2, grade: "F" },
    ]);
    expect(r).toEqual({ gpa: 0, units: 5 });
    expect(degreeClass(r.gpa)).toBe("Pass/Fail zone");
  });
});

describe("mixed grades", () => {
  it("weights points by units, rounds to 2dp", () => {
    // A(2u) + D(4u) + E(1u) + F(3u) → (10+8+1+0)/10 = 1.9
    const r = gpaOf([
      { units: 2, grade: "A" },
      { units: 4, grade: "D" },
      { units: 1, grade: "E" },
      { units: 3, grade: "F" },
    ]);
    expect(r).toEqual({ gpa: 1.9, units: 10 });
    expect(degreeClass(r.gpa)).toBe("Third Class");
  });
});

describe("boundary degree-class values", () => {
  it("classifies exact band edges upward (inclusive lower bound)", () => {
    expect(degreeClass(4.5)).toBe("First Class");
    expect(degreeClass(3.5)).toBe("Second Class Upper");
    expect(degreeClass(2.4)).toBe("Second Class Lower");
    expect(degreeClass(1.5)).toBe("Third Class");
  });
  it("classifies just-below values into the lower band", () => {
    expect(degreeClass(4.49)).toBe("Second Class Upper");
    expect(degreeClass(3.49)).toBe("Second Class Lower");
    expect(degreeClass(2.39)).toBe("Third Class");
    expect(degreeClass(1.49)).toBe("Pass/Fail zone");
  });
});
