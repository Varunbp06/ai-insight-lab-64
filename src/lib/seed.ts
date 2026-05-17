// Generates realistic sample student data for first-time users.
import type { FeatureName } from "./ml";

export interface SeedStudent {
  student_code: string;
  name: string;
  study_hours: number;
  attendance: number;
  sleep_hours: number;
  previous_marks: number;
  assignment_pct: number;
  mock_test: number;
  actual_marks: number;
}

const FIRST = ["Aarav", "Diya", "Vihaan", "Ananya", "Arjun", "Saanvi", "Krishna", "Ishaan", "Myra", "Reyansh", "Aanya", "Aditya", "Kiara", "Vivaan", "Anika", "Aryan", "Pari", "Kabir", "Riya", "Yash", "Ayaan", "Zara", "Rohan", "Tanya", "Dev", "Meera", "Karan", "Sara", "Neel", "Aisha"];
const LAST = ["Sharma", "Verma", "Reddy", "Kumar", "Nair", "Iyer", "Patel", "Khan", "Singh", "Mehta", "Joshi", "Bose", "Gupta", "Roy", "Das"];

// Linear-ish ground truth with noise — so models can actually learn a signal.
function synthesizeMarks(s: Omit<SeedStudent, "actual_marks" | "student_code" | "name">): number {
  const base =
    8 +
    s.study_hours * 4.5 +
    s.attendance * 0.35 +
    s.sleep_hours * 1.8 +
    s.previous_marks * 0.25 +
    s.assignment_pct * 0.18 +
    s.mock_test * 0.22;
  const noise = (Math.random() - 0.5) * 8;
  return Math.max(20, Math.min(100, Math.round(base + noise)));
}

export function generateSeedStudents(n = 60): SeedStudent[] {
  const out: SeedStudent[] = [];
  for (let i = 0; i < n; i++) {
    const features = {
      study_hours: +(Math.random() * 7 + 1).toFixed(1),
      attendance: Math.round(Math.random() * 35 + 60),
      sleep_hours: +(Math.random() * 4 + 5).toFixed(1),
      previous_marks: Math.round(Math.random() * 55 + 40),
      assignment_pct: Math.round(Math.random() * 50 + 50),
      mock_test: Math.round(Math.random() * 60 + 35),
    };
    out.push({
      student_code: String(1001 + i),
      name: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`,
      ...features,
      actual_marks: synthesizeMarks(features),
    });
  }
  return out;
}

export const FEATURE_INPUT_RANGES: Record<FeatureName, { min: number; max: number; step: number; default: number; unit?: string }> = {
  study_hours: { min: 0, max: 12, step: 0.5, default: 4.5, unit: "hr/day" },
  attendance: { min: 0, max: 100, step: 1, default: 86, unit: "%" },
  sleep_hours: { min: 0, max: 12, step: 0.5, default: 7, unit: "hr/night" },
  previous_marks: { min: 0, max: 100, step: 1, default: 75, unit: "/100" },
  assignment_pct: { min: 0, max: 100, step: 1, default: 78, unit: "%" },
  mock_test: { min: 0, max: 100, step: 1, default: 72, unit: "/100" },
};
