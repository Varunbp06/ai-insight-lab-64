// Pure-TS ML implementations for the Student Performance dashboard.
// Three algorithms with comparable APIs: train(X, y) -> Model; predict(model, x) -> number.

export type Algorithm = "linear" | "forest" | "xgboost";

export const ALGORITHMS: { id: Algorithm; label: string; tagline: string }[] = [
  { id: "linear", label: "Linear Regression", tagline: "Fast, interpretable baseline" },
  { id: "forest", label: "Random Forest", tagline: "Bagged decision trees, robust to noise" },
  { id: "xgboost", label: "XGBoost (GBM)", tagline: "Gradient-boosted trees, best accuracy" },
];

export const FEATURE_NAMES = [
  "study_hours",
  "attendance",
  "sleep_hours",
  "previous_marks",
  "assignment_pct",
  "mock_test",
] as const;
export type FeatureName = (typeof FEATURE_NAMES)[number];
export type FeatureVector = Record<FeatureName, number>;

export const FEATURE_LABELS: Record<FeatureName, string> = {
  study_hours: "Study Hours",
  attendance: "Attendance",
  sleep_hours: "Sleep Hours",
  previous_marks: "Previous Marks",
  assignment_pct: "Assignment %",
  mock_test: "Mock Test",
};

export function vectorize(v: FeatureVector): number[] {
  return FEATURE_NAMES.map((k) => Number(v[k]) || 0);
}

// ---------- Linear Regression (closed form via normal equation w/ ridge) ----------
function transpose(m: number[][]) {
  return m[0].map((_, i) => m.map((r) => r[i]));
}
function matmul(a: number[][], b: number[][]) {
  const out = Array.from({ length: a.length }, () => new Array(b[0].length).fill(0));
  for (let i = 0; i < a.length; i++)
    for (let k = 0; k < b.length; k++)
      for (let j = 0; j < b[0].length; j++) out[i][j] += a[i][k] * b[k][j];
  return out;
}
function inverse(m: number[][]): number[][] {
  const n = m.length;
  const A = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (j === i ? 1 : 0))]);
  for (let i = 0; i < n; i++) {
    let pivot = A[i][i];
    if (Math.abs(pivot) < 1e-9) {
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > 1e-9) { [A[i], A[r]] = [A[r], A[i]]; pivot = A[i][i]; break; }
    }
    for (let j = 0; j < 2 * n; j++) A[i][j] /= pivot;
    for (let r = 0; r < n; r++) if (r !== i) {
      const f = A[r][i];
      for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[i][j];
    }
  }
  return A.map((r) => r.slice(n));
}

export interface LinearModel { kind: "linear"; weights: number[]; intercept: number; }

export function trainLinear(X: number[][], y: number[]): LinearModel {
  const n = X.length;
  const Xb = X.map((r) => [1, ...r]);
  const Xt = transpose(Xb);
  const lambda = 0.5;
  const XtX = matmul(Xt, Xb);
  for (let i = 1; i < XtX.length; i++) XtX[i][i] += lambda; // ridge, skip intercept
  const Xty = matmul(Xt, y.map((v) => [v]));
  const beta = matmul(inverse(XtX), Xty).map((r) => r[0]);
  void n;
  return { kind: "linear", intercept: beta[0], weights: beta.slice(1) };
}
export function predictLinear(m: LinearModel, x: number[]): number {
  return m.intercept + m.weights.reduce((s, w, i) => s + w * x[i], 0);
}

// ---------- Decision tree (regression, depth-limited) ----------
interface TreeNode {
  leaf?: number;
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}
function variance(ys: number[]): number {
  if (!ys.length) return 0;
  const m = ys.reduce((a, b) => a + b, 0) / ys.length;
  return ys.reduce((a, b) => a + (b - m) ** 2, 0) / ys.length;
}
function buildTree(X: number[][], y: number[], depth: number, maxDepth: number, minSamples: number, featSubset?: number[]): TreeNode {
  if (depth >= maxDepth || y.length <= minSamples) {
    return { leaf: y.reduce((a, b) => a + b, 0) / Math.max(1, y.length) };
  }
  const features = featSubset ?? X[0].map((_, i) => i);
  let best = { feat: -1, thr: 0, score: Infinity, li: [] as number[], ri: [] as number[] };
  for (const f of features) {
    const sorted = [...y.keys()].sort((a, b) => X[a][f] - X[b][f]);
    const step = Math.max(1, Math.floor(sorted.length / 8));
    for (let s = step; s < sorted.length; s += step) {
      const thr = (X[sorted[s - 1]][f] + X[sorted[s]][f]) / 2;
      const li = sorted.slice(0, s);
      const ri = sorted.slice(s);
      if (li.length < minSamples || ri.length < minSamples) continue;
      const score = (li.length * variance(li.map((i) => y[i])) + ri.length * variance(ri.map((i) => y[i]))) / y.length;
      if (score < best.score) best = { feat: f, thr, score, li, ri };
    }
  }
  if (best.feat === -1) return { leaf: y.reduce((a, b) => a + b, 0) / y.length };
  return {
    feature: best.feat,
    threshold: best.thr,
    left: buildTree(best.li.map((i) => X[i]), best.li.map((i) => y[i]), depth + 1, maxDepth, minSamples, featSubset),
    right: buildTree(best.ri.map((i) => X[i]), best.ri.map((i) => y[i]), depth + 1, maxDepth, minSamples, featSubset),
  };
}
function predictTree(t: TreeNode, x: number[]): number {
  if (t.leaf !== undefined) return t.leaf;
  return x[t.feature!] <= t.threshold! ? predictTree(t.left!, x) : predictTree(t.right!, x);
}

// ---------- Random Forest ----------
export interface ForestModel { kind: "forest"; trees: TreeNode[]; }
export function trainForest(X: number[][], y: number[], nTrees = 20, maxDepth = 7): ForestModel {
  const trees: TreeNode[] = [];
  const nFeat = X[0].length;
  const subSize = Math.max(2, Math.floor(Math.sqrt(nFeat)) + 1);
  for (let t = 0; t < nTrees; t++) {
    const idx = Array.from({ length: X.length }, () => Math.floor(Math.random() * X.length));
    const feats: number[] = [];
    while (feats.length < subSize) {
      const f = Math.floor(Math.random() * nFeat);
      if (!feats.includes(f)) feats.push(f);
    }
    trees.push(buildTree(idx.map((i) => X[i]), idx.map((i) => y[i]), 0, maxDepth, 3, feats));
  }
  return { kind: "forest", trees };
}
export function predictForest(m: ForestModel, x: number[]): number {
  return m.trees.reduce((s, t) => s + predictTree(t, x), 0) / m.trees.length;
}

// ---------- XGBoost-style Gradient Boosting (regression on residuals) ----------
export interface BoostModel { kind: "xgboost"; base: number; trees: TreeNode[]; lr: number; }
export function trainBoost(X: number[][], y: number[], nTrees = 30, maxDepth = 4, lr = 0.1): BoostModel {
  const base = y.reduce((a, b) => a + b, 0) / y.length;
  let preds = y.map(() => base);
  const trees: TreeNode[] = [];
  for (let t = 0; t < nTrees; t++) {
    const residuals = y.map((v, i) => v - preds[i]);
    const tree = buildTree(X, residuals, 0, maxDepth, 3);
    trees.push(tree);
    preds = preds.map((p, i) => p + lr * predictTree(tree, X[i]));
  }
  return { kind: "xgboost", base, trees, lr };
}
export function predictBoost(m: BoostModel, x: number[]): number {
  return m.base + m.trees.reduce((s, t) => s + m.lr * predictTree(t, x), 0);
}

// ---------- Unified API ----------
export type Model = LinearModel | ForestModel | BoostModel;

export function trainModel(algo: Algorithm, X: number[][], y: number[]): Model {
  if (algo === "linear") return trainLinear(X, y);
  if (algo === "forest") return trainForest(X, y);
  return trainBoost(X, y);
}
export function predict(model: Model, x: number[]): number {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  if (model.kind === "linear") return clamp(predictLinear(model, x));
  if (model.kind === "forest") return clamp(predictForest(model, x));
  return clamp(predictBoost(model, x));
}

// ---------- Metrics ----------
export function metrics(yTrue: number[], yPred: number[]) {
  const n = yTrue.length || 1;
  const mean = yTrue.reduce((a, b) => a + b, 0) / n;
  const ssTot = yTrue.reduce((a, b) => a + (b - mean) ** 2, 0) || 1;
  const ssRes = yTrue.reduce((a, b, i) => a + (b - yPred[i]) ** 2, 0);
  const mse = ssRes / n;
  const rmse = Math.sqrt(mse);
  const mae = yTrue.reduce((a, b, i) => a + Math.abs(b - yPred[i]), 0) / n;
  const r2 = 1 - ssRes / ssTot;
  const accuracy = Math.max(0, 1 - mae / 100);
  return { rmse, mae, r2, accuracy };
}

// Permutation feature importance — works for any model.
export function featureImportance(model: Model, X: number[][], y: number[]): Record<FeatureName, number> {
  const base = metrics(y, X.map((x) => predict(model, x))).rmse;
  const out = {} as Record<FeatureName, number>;
  for (let f = 0; f < FEATURE_NAMES.length; f++) {
    const shuffled = X.map((r) => [...r]);
    const col = shuffled.map((r) => r[f]);
    for (let i = col.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [col[i], col[j]] = [col[j], col[i]];
    }
    shuffled.forEach((r, i) => (r[f] = col[i]));
    const r = metrics(y, shuffled.map((x) => predict(model, x))).rmse;
    out[FEATURE_NAMES[f]] = Math.max(0, r - base);
  }
  const total = Object.values(out).reduce((a, b) => a + b, 0) || 1;
  (Object.keys(out) as FeatureName[]).forEach((k) => (out[k] = out[k] / total));
  return out;
}

export function gradeFor(marks: number): string {
  if (marks >= 90) return "A+";
  if (marks >= 80) return "A";
  if (marks >= 70) return "B+";
  if (marks >= 60) return "B";
  if (marks >= 50) return "C";
  if (marks >= 40) return "D";
  return "F";
}
