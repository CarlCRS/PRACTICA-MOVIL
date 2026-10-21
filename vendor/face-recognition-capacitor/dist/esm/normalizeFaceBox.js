/**
 * Canonical FaceBox schema matches iOS bridge output:
 * - `attributes`: PascalCase engine map (`"value"` or `"value · NN%"`)
 * - convenience labels: glassesLabel, sunglassesLabel, occlusionLabel, …
 *
 * Android typed FaceBox JSON often omits `attributes` and some labels.
 * This middleware fills the iOS shape without inventing glasses/sunglasses
 * when the engine never returned them.
 */
function trimStr(v) {
    return typeof v === 'string' ? v.trim() : v != null ? String(v).trim() : '';
}
/** Prefer existing "value · NN%" labels; otherwise append score when 0–1. */
function fmtAttr(label, score) {
    const l = trimStr(label);
    if (!l && (score == null || !Number.isFinite(score)))
        return '';
    if (l.includes(' · '))
        return l;
    if (l &&
        score != null &&
        Number.isFinite(score) &&
        score >= 0 &&
        score <= 1) {
        return `${l} · ${Math.round(score * 100)}%`;
    }
    return l;
}
function occlusionFromScore(score) {
    if (score == null || !Number.isFinite(score) || score <= 0.001)
        return '';
    if (score > 0.5)
        return `Occluded · ${Math.round(score * 100)}%`;
    return `Clear · ${Math.round((1 - score) * 100)}%`;
}
function put(attrs, key, value) {
    const v = trimStr(value);
    if (v)
        attrs[key] = v;
}
/**
 * Identity when `attributes` is already present (iOS / already normalized).
 * Otherwise synthesize an iOS-shaped `attributes` map from typed fields.
 */
export function normalizeFaceBox(box) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    if (box == null || typeof box !== 'object') {
        return box;
    }
    // iOS always sets attributes (even {}); Android faceBoxToJson omits it.
    if (box.attributes != null && typeof box.attributes === 'object') {
        return box;
    }
    const attributes = {};
    put(attributes, 'Age', box.age ? String(box.age) : '');
    put(attributes, 'Gender', String((_a = box.genderLabel) !== null && _a !== void 0 ? _a : ''));
    put(attributes, 'Emotion', String((_b = box.emotionLabel) !== null && _b !== void 0 ? _b : ''));
    put(attributes, 'MedicalMask', String((_c = box.maskLabel) !== null && _c !== void 0 ? _c : ''));
    put(attributes, 'Liveness2D', fmtAttr(String((_d = box.livenessLabel) !== null && _d !== void 0 ? _d : ''), box.liveness));
    put(attributes, 'FaceQuality', trimStr(box.qualityLabel) ||
        (box.face_quality != null && box.face_quality > 0
            ? String(box.face_quality)
            : ''));
    put(attributes, 'EyesLeft', String((_e = box.eyesLeftLabel) !== null && _e !== void 0 ? _e : ''));
    put(attributes, 'EyesRight', String((_f = box.eyesRightLabel) !== null && _f !== void 0 ? _f : ''));
    put(attributes, 'Glasses', String((_g = box.glassesLabel) !== null && _g !== void 0 ? _g : ''));
    put(attributes, 'Sunglasses', String((_h = box.sunglassesLabel) !== null && _h !== void 0 ? _h : ''));
    const occlusionLabel = trimStr(box.occlusionLabel) || occlusionFromScore(box.face_occlusion);
    put(attributes, 'Occlusion', occlusionLabel);
    return Object.assign(Object.assign({}, box), { glassesLabel: (_j = box.glassesLabel) !== null && _j !== void 0 ? _j : '', sunglassesLabel: (_k = box.sunglassesLabel) !== null && _k !== void 0 ? _k : '', occlusionLabel: occlusionLabel || box.occlusionLabel || '', attributes });
}
export function normalizeFaceBoxes(boxes) {
    if (!Array.isArray(boxes))
        return [];
    return boxes.map((b) => normalizeFaceBox(b));
}
//# sourceMappingURL=normalizeFaceBox.js.map