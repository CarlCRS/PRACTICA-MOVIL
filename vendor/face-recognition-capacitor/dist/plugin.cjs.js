'use strict';

var core = require('@capacitor/core');

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
function normalizeFaceBox(box) {
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
function normalizeFaceBoxes(boxes) {
    if (!Array.isArray(boxes))
        return [];
    return boxes.map((b) => normalizeFaceBox(b));
}

/**
 * Single live-frame geometry policy for Android + iOS.
 * JS owns all front/back / landscape branching; native only rotates + scales.
 *
 * `width` / `height` must be after EXIF / UIImage orientation bake (from probeLiveImage).
 * VisionCamera `orientation` is accepted for API completeness / future use; the
 * post-bake aspect ratio is what drives the rotation today.
 */
const LIVE_FRAME_MAX_EDGE = 640;
/**
 * Decide rotateDegrees + maxEdge for VideoWorker / side-detect frames.
 *
 * 1. Landscape (w > h): front −90°, back +90° (CameraFrameUtils).
 * 2. Else if front on iOS: +180° (front sensor mount vs VisionCamera portrait bake).
 * 3. Else: 0° (Android front portrait stays upright).
 */
function planLiveFrame(input) {
    var _a;
    const maxEdge = input.maxEdge != null && input.maxEdge > 0
        ? Math.floor(input.maxEdge)
        : LIVE_FRAME_MAX_EDGE;
    const w = Number(input.width) || 0;
    const h = Number(input.height) || 0;
    const platform = ((_a = input.platform) !== null && _a !== void 0 ? _a : '').toLowerCase();
    let rotateDegrees = 0;
    if (w > h) {
        rotateDegrees = input.frontCamera ? -90 : 90;
    }
    else if (input.frontCamera && platform !== 'android') {
        rotateDegrees = 180;
    }
    return { rotateDegrees, maxEdge };
}

function num(v) {
    if (typeof v === 'number' && !Number.isNaN(v))
        return v;
    if (typeof v === 'string' && v.trim()) {
        const n = Number(v);
        return Number.isNaN(n) ? undefined : n;
    }
    return undefined;
}
function parseLandmarks(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((p) => {
        var _a, _b;
        return ({
            x: (_a = num(p === null || p === void 0 ? void 0 : p.x)) !== null && _a !== void 0 ? _a : 0,
            y: (_b = num(p === null || p === void 0 ? void 0 : p.y)) !== null && _b !== void 0 ? _b : 0,
        });
    })
        .filter((p) => p.x !== 0 || p.y !== 0);
}
function parseWorkerLiveness(raw) {
    var _a, _b;
    let liveness = num(raw.liveness);
    let livenessLabel = typeof raw.livenessLabel === 'string'
        ? raw.livenessLabel
        : typeof raw.liveness_label === 'string'
            ? raw.liveness_label
            : undefined;
    if (livenessLabel === '')
        livenessLabel = undefined;
    const attrs = raw.attributes;
    const live = ((_a = attrs === null || attrs === void 0 ? void 0 : attrs.Liveness2D) !== null && _a !== void 0 ? _a : attrs === null || attrs === void 0 ? void 0 : attrs.liveness);
    if (live) {
        if (!livenessLabel && typeof live.value === 'string' && live.value) {
            livenessLabel = live.value;
        }
        if (liveness == null)
            liveness = (_b = num(live.confidence)) !== null && _b !== void 0 ? _b : num(live.value);
    }
    return { liveness, livenessLabel };
}
function parseWorkerFace(raw) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const region = raw.faceRegion;
    if (!region)
        return null;
    const x = (_a = num(region.x)) !== null && _a !== void 0 ? _a : 0;
    const y = (_b = num(region.y)) !== null && _b !== void 0 ? _b : 0;
    const w = (_c = num(region.width)) !== null && _c !== void 0 ? _c : 0;
    const h = (_d = num(region.height)) !== null && _d !== void 0 ? _d : 0;
    const matchRaw = raw.match;
    let match;
    if (matchRaw) {
        match = {
            matched: Boolean(matchRaw.matched),
            personIndex: num(matchRaw.person_index),
            score: num(matchRaw.score),
        };
    }
    const pose = (_e = raw.facePose) !== null && _e !== void 0 ? _e : undefined;
    const live = parseWorkerLiveness(raw);
    return {
        trackId: (_f = num(raw.track_id)) !== null && _f !== void 0 ? _f : 0,
        x,
        y,
        width: w,
        height: h,
        landmarks: parseLandmarks(raw.facePoints),
        yaw: (_g = num(pose === null || pose === void 0 ? void 0 : pose.yaw)) !== null && _g !== void 0 ? _g : 0,
        pitch: (_h = num(pose === null || pose === void 0 ? void 0 : pose.pitch)) !== null && _h !== void 0 ? _h : 0,
        roll: (_j = num(pose === null || pose === void 0 ? void 0 : pose.roll)) !== null && _j !== void 0 ? _j : 0,
        weak: Boolean(raw.weak),
        match,
        liveness: live.liveness,
        livenessLabel: live.livenessLabel,
    };
}
function parseVideoWorkerEvent(json) {
    var _a, _b, _c;
    try {
        const root = JSON.parse(json);
        const event = root === null || root === void 0 ? void 0 : root.event;
        if (event === 'tracking') {
            const facesRaw = Array.isArray(root.faces) ? root.faces : [];
            return {
                type: 'tracking',
                frameWidth: (_a = num(root.frame_width)) !== null && _a !== void 0 ? _a : 0,
                frameHeight: (_b = num(root.frame_height)) !== null && _b !== void 0 ? _b : 0,
                faces: facesRaw
                    .map((f) => f && typeof f === 'object'
                    ? parseWorkerFace(f)
                    : null)
                    .filter(Boolean),
            };
        }
        if (event === 'match') {
            return {
                type: 'match',
                trackId: (_c = num(root.track_id)) !== null && _c !== void 0 ? _c : 0,
                matched: Boolean(root.matched),
                personIndex: num(root.person_index),
                score: num(root.score),
            };
        }
        return null;
    }
    catch (_d) {
        return null;
    }
}
function workerFaceToBox(face) {
    return {
        x1: Math.round(face.x),
        y1: Math.round(face.y),
        x2: Math.round(face.x + face.width),
        y2: Math.round(face.y + face.height),
        yaw: face.yaw,
        pitch: face.pitch,
        roll: face.roll,
        liveness: face.liveness,
        livenessLabel: face.livenessLabel,
        landmarkCount: face.landmarks.length,
        landmarks: face.landmarks.flatMap((p) => [p.x, p.y]),
    };
}

function livenessPassed(settings, score, label) {
    const lower = (label !== null && label !== void 0 ? label : '').toLowerCase();
    if (lower.includes('spoof') || lower.includes('fake'))
        return false;
    return score >= settings.liveness_threshold;
}
function qualityText(score) {
    if (score < 0.5)
        return `Low · ${Math.round(score * 100)}%`;
    if (score < 0.75)
        return `Medium · ${Math.round(score * 100)}%`;
    return `High · ${Math.round(score * 100)}%`;
}
function genderText(gender, label) {
    if (label)
        return label;
    if (gender === 0)
        return 'Male';
    if (gender === 1)
        return 'Female';
    return 'Unknown';
}
function livenessText(settings, score, label) {
    const lower = (label !== null && label !== void 0 ? label : '').toLowerCase();
    const live = lower.includes('spoof') || lower.includes('fake')
        ? 'Spoof'
        : lower.includes('real')
            ? 'Real'
            : livenessPassed(settings, score, label)
                ? 'Real'
                : 'Spoof';
    if (label === null || label === void 0 ? void 0 : label.includes(' · '))
        return label;
    return `${live} · ${Math.round(score * 100)}%`;
}
function attrMap(box) {
    const out = {};
    const raw = box.attributes;
    if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw)) {
            if (v != null && String(v).trim())
                out[k] = String(v);
        }
    }
    return out;
}
function engineAttr(extra, ...keys) {
    for (const key of keys) {
        const v = extra[key];
        if (v && v.trim())
            return v;
    }
    return '';
}
function fmtDeg(n) {
    const v = Number.isFinite(n) ? n : 0;
    return `${v.toFixed(1)}°`;
}
function fmtScore(n) {
    if (n == null || !Number.isFinite(n))
        return '—';
    if (n >= 0 && n <= 1)
        return `${Math.round(n * 100)}%`;
    return String(n);
}
/** Mirrors Android ResultDetails.rows — known fields + leftover engine attributes. */
function resultDetailRows(box, settings, opts) {
    var _a, _b, _c, _d, _e, _f;
    const rows = [];
    const extra = attrMap(box);
    const used = new Set();
    const push = (title, value) => {
        if (value.trim())
            rows.push({ kind: 'field', title, value });
    };
    const section = (title) => rows.push({ kind: 'section', title, value: title });
    const take = (title, keys, fallback) => {
        const value = engineAttr(extra, ...keys) || fallback || '';
        if (value.trim()) {
            push(title, value);
            keys.forEach((k) => used.add(k));
        }
    };
    if ((opts === null || opts === void 0 ? void 0 : opts.includeMatch) && opts.personName) {
        section('Match');
        push('Person', opts.personName);
        if (opts.similarity != null) {
            push('Similarity', fmtScore(opts.similarity));
        }
    }
    section('Authenticity');
    take('Liveness (2D)', ['Liveness2D', 'liveness', 'Liveness'], livenessText(settings, (_a = box.liveness) !== null && _a !== void 0 ? _a : 0, box.livenessLabel));
    section('Person');
    take('Age', ['Age', 'age'], box.age && box.age > 0 ? `${box.age} years` : null);
    take('Gender', ['Gender', 'gender'], genderText(box.gender, box.genderLabel));
    take('Emotion', ['Emotion', 'emotion'], box.emotionLabel);
    take('All emotions', ['Emotions']);
    section('Face');
    take('Mask', ['MedicalMask', 'Mask', 'mask'], box.maskLabel);
    take('Glasses', ['Glasses', 'glasses'], box.glassesLabel);
    take('Sunglasses', ['Sunglasses', 'sunglasses'], box.sunglassesLabel);
    take('Occlusion', ['Occlusion', 'FaceOcclusion', 'occlusion'], box.occlusionLabel);
    const left = engineAttr(extra, 'EyesLeft', 'eyesLeft') || box.eyesLeftLabel || '';
    const right = engineAttr(extra, 'EyesRight', 'eyesRight') || box.eyesRightLabel || '';
    if (left || right) {
        push('Eyes', `Left: ${left || '—'}\nRight: ${right || '—'}`);
        used.add('EyesLeft');
        used.add('EyesRight');
        used.add('eyesLeft');
        used.add('eyesRight');
    }
    else if ((box.left_eye_closed != null && box.left_eye_closed > 0) ||
        (box.right_eye_closed != null && box.right_eye_closed > 0)) {
        push('Eye closeness', `Left: ${fmtScore(box.left_eye_closed)}\nRight: ${fmtScore(box.right_eye_closed)}`);
    }
    section('Quality');
    take('Face quality', ['FaceQuality', 'ExpressionLevel', 'face_quality'], box.qualityLabel || qualityText((_b = box.face_quality) !== null && _b !== void 0 ? _b : 0));
    for (const [label, key] of [
        ['Lighting', 'Lighting'],
        ['Sharpness', 'Sharpness'],
        ['Noise', 'Noise'],
        ['Flare', 'Flare'],
        ['Blur', 'BlurLevel'],
        ['Noise level', 'NoiseLevel'],
    ]) {
        take(label, [key]);
    }
    if (((_c = box.face_luminance) !== null && _c !== void 0 ? _c : 0) > 0) {
        push('Luminance', fmtScore(box.face_luminance));
    }
    section('Geometry');
    push('Head pose', `Yaw ${fmtDeg(box.yaw)}   Roll ${fmtDeg(box.roll)}   Pitch ${fmtDeg(box.pitch)}`);
    push('Face box (px)', `Left ${box.x1}, Top ${box.y1} → Right ${box.x2}, Bottom ${box.y2}`);
    const skipLeftover = new Set([
        ...used,
        'MouthOpened',
        'Deepfake',
        'Template',
        'mouth_opened',
        'Age',
        'age',
        'Gender',
        'gender',
        'Emotion',
        'emotion',
        'Liveness2D',
        'liveness',
        'Liveness',
        'FaceQuality',
        'face_quality',
    ]);
    const leftovers = Object.entries(extra).filter(([key, value]) => value.trim() &&
        !skipLeftover.has(key) &&
        !rows.some((r) => r.kind === 'field' && r.title.toLowerCase() === key.toLowerCase()));
    if (leftovers.length) {
        section('More from engine');
        for (const [key, value] of leftovers) {
            push(key, value);
        }
    }
    if (box.landmarkCount && ((_d = box.landmarks) === null || _d === void 0 ? void 0 : _d.length)) {
        section('Landmarks');
        push('Count', `${box.landmarkCount} points`);
        const n = Math.min(box.landmarkCount, Math.floor(((_f = (_e = box.landmarks) === null || _e === void 0 ? void 0 : _e.length) !== null && _f !== void 0 ? _f : 0) / 2));
        if (n > 0) {
            const lines = [];
            for (let i = 0; i < n; i++) {
                lines.push(`${i + 1}: ${box.landmarks[i * 2]}, ${box.landmarks[i * 2 + 1]}`);
            }
            push('Positions', lines.join('\n'));
        }
    }
    return rows.filter((row, i) => {
        if (row.kind !== 'section')
            return row.value.trim().length > 0;
        const next = rows[i + 1];
        return next != null && next.kind === 'field' && next.value.trim().length > 0;
    });
}

/** Android CaptureView.getROIRect — used by checkFace fit/size tests. */
function getROIRect(frame) {
    const margin = frame.w / 6;
    const rectHeight = ((frame.w - 2 * margin) * 6) / 5;
    const top = (frame.h - rectHeight) / 2;
    return {
        left: margin,
        top,
        right: frame.w - margin,
        bottom: top + rectHeight,
        width: frame.w - 2 * margin,
        height: rectHeight,
    };
}
/** Android CaptureView.getROIRect1 — circular guide in the overlay. */
function getROIRect1(frame) {
    const margin = frame.w / 6;
    const rectHeight = frame.w - 2 * margin;
    const top = (frame.h - rectHeight) / 2;
    const left = margin;
    const right = frame.w - margin;
    const bottom = top + rectHeight;
    return {
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
        centerX: (left + right) / 2,
        centerY: (top + bottom) / 2,
    };
}
/** Map frame ROI into view coords — same FILL_CENTER math as mapFramePoint. */
function mapRoiToView(frame, viewW, viewH) {
    const roi = getROIRect1(frame);
    const p1 = mapFramePoint(roi.left, roi.top, frame.w, frame.h, viewW, viewH, false);
    const p2 = mapFramePoint(roi.right, roi.bottom, frame.w, frame.h, viewW, viewH, false);
    const left = Math.min(p1.x, p2.x);
    const top = Math.min(p1.y, p2.y);
    const right = Math.max(p1.x, p2.x);
    const bottom = Math.max(p1.y, p2.y);
    return {
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
        centerX: (left + right) / 2,
        centerY: (top + bottom) / 2,
    };
}
/** Preview FILL_CENTER mapping (Android FaceView). */
function mapFramePoint(x, y, fw, fh, vw, vh, mirror) {
    const scale = Math.max(vw / fw, vh / fh);
    const dx = (vw - fw * scale) / 2;
    const dy = (vh - fh * scale) / 2;
    let vx = x * scale + dx;
    const vy = y * scale + dy;
    if (mirror)
        vx = vw - vx;
    return { x: vx, y: vy };
}
function warningFor(state) {
    switch (state) {
        case 'MULTIPLE_FACES':
            return 'Multiple face detected!';
        case 'FIT_IN_CIRCLE':
            return 'Fit in circle!';
        case 'MOVE_CLOSER':
            return 'Move closer!';
        case 'NO_FRONT':
            return 'Not fronted face!';
        case 'FACE_OCCLUDED':
            return 'Face occluded!';
        case 'EYE_CLOSED':
            return 'Eye closed!';
        case 'SPOOFED_FACE':
            return 'Spoof face';
        default:
            return '';
    }
}
/** Android CaptureActivity.checkFace */
function checkFace(boxes, settings, frame) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    if (!boxes.length)
        return 'NO_FACE';
    if (boxes.length > 1)
        return 'MULTIPLE_FACES';
    const faceBox = boxes[0];
    let faceLeft = Number.MAX_VALUE;
    let faceRight = 0;
    let faceBottom = 0;
    const lm = (_a = faceBox.landmarks) !== null && _a !== void 0 ? _a : [];
    const nMarks = Math.max(0, Math.min((_b = faceBox.landmarkCount) !== null && _b !== void 0 ? _b : lm.length / 2, Math.floor(lm.length / 2)));
    if (nMarks >= 5) {
        for (let i = 0; i < nMarks; i++) {
            const lx = (_c = lm[i * 2]) !== null && _c !== void 0 ? _c : 0;
            const ly = (_d = lm[i * 2 + 1]) !== null && _d !== void 0 ? _d : 0;
            faceLeft = Math.min(faceLeft, lx);
            faceRight = Math.max(faceRight, lx);
            faceBottom = Math.max(faceBottom, ly);
        }
    }
    else {
        faceLeft = faceBox.x1;
        faceRight = faceBox.x2;
        faceBottom = faceBox.y2;
    }
    const sizeRate = 0.3;
    const interRate = 0.03;
    const fw = frame.w > 0 ? frame.w : 720;
    const fh = frame.h > 0 ? frame.h : 1280;
    const roiRect = getROIRect({ w: fw, h: fh });
    const centerY = (faceBox.y2 + faceBox.y1) / 2;
    const topY = centerY - ((faceBox.y2 - faceBox.y1) * 2) / 3;
    const interX = Math.max(0, roiRect.left - faceLeft) + Math.max(0, faceRight - roiRect.right);
    const interY = Math.max(0, roiRect.top - topY) + Math.max(0, faceBottom - roiRect.bottom);
    if (interX / roiRect.width > interRate ||
        interY / roiRect.height > interRate) {
        return 'FIT_IN_CIRCLE';
    }
    if ((faceBox.y2 - faceBox.y1) * (faceBox.x2 - faceBox.x1) <
        roiRect.width * roiRect.height * sizeRate) {
        return 'MOVE_CLOSER';
    }
    if (Math.abs((_e = faceBox.yaw) !== null && _e !== void 0 ? _e : 0) > settings.yaw_threshold ||
        Math.abs((_f = faceBox.roll) !== null && _f !== void 0 ? _f : 0) > settings.roll_threshold ||
        Math.abs((_g = faceBox.pitch) !== null && _g !== void 0 ? _g : 0) > settings.pitch_threshold) {
        return 'NO_FRONT';
    }
    const mask = ((_h = faceBox.maskLabel) !== null && _h !== void 0 ? _h : '').toLowerCase();
    if (mask.includes('yes'))
        return 'FACE_OCCLUDED';
    const left = ((_j = faceBox.eyesLeftLabel) !== null && _j !== void 0 ? _j : '').toLowerCase();
    const right = ((_k = faceBox.eyesRightLabel) !== null && _k !== void 0 ? _k : '').toLowerCase();
    if (left.includes('closed') || right.includes('closed'))
        return 'EYE_CLOSED';
    if (!left &&
        !right &&
        (((_l = faceBox.left_eye_closed) !== null && _l !== void 0 ? _l : 0) > settings.eyeclose_threshold ||
            ((_m = faceBox.right_eye_closed) !== null && _m !== void 0 ? _m : 0) > settings.eyeclose_threshold)) {
        return 'EYE_CLOSED';
    }
    return 'CAPTURE_OK';
}
/**
 * Landmark xy in cropFace bitmap pixels — matches Android Utils.mapLandmarksToCrop
 * (1.4× square window scaled to outW×outH).
 */
function mapLandmarksToCrop(faceBox, srcW, srcH, outW, outH) {
    var _a, _b, _c, _d;
    const lm = (_a = faceBox.landmarks) !== null && _a !== void 0 ? _a : [];
    const n = Math.max(0, Math.min((_b = faceBox.landmarkCount) !== null && _b !== void 0 ? _b : lm.length / 2, Math.floor(lm.length / 2)));
    if (n === 0 || srcW <= 0 || srcH <= 0 || outW <= 0 || outH <= 0)
        return [];
    const centerX = (faceBox.x1 + faceBox.x2) / 2;
    const centerY = (faceBox.y1 + faceBox.y2) / 2;
    let cropWidth = Math.round((faceBox.x2 - faceBox.x1) * 1.4);
    if (cropWidth < 2) {
        cropWidth = Math.max(2, Math.max(faceBox.x2 - faceBox.x1, faceBox.y2 - faceBox.y1));
    }
    const cropX1 = Math.max(0, centerX - cropWidth / 2);
    const cropY1 = Math.max(0, centerY - cropWidth / 2);
    const cropX2 = Math.min(srcW - 1, centerX + cropWidth / 2);
    const cropY2 = Math.min(srcH - 1, centerY + cropWidth / 2);
    const cropSrcW = cropX2 - cropX1 + 1;
    const cropSrcH = cropY2 - cropY1 + 1;
    if (cropSrcW < 1 || cropSrcH < 1)
        return [];
    const sx = outW / cropSrcW;
    const sy = outH / cropSrcH;
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push({
            x: (((_c = lm[i * 2]) !== null && _c !== void 0 ? _c : 0) - cropX1) * sx,
            y: (((_d = lm[i * 2 + 1]) !== null && _d !== void 0 ? _d : 0) - cropY1) * sy,
        });
    }
    return out;
}
function hasLiveness(box) {
    var _a;
    if (box.livenessLabel && box.livenessLabel.length > 0)
        return true;
    return ((_a = box.liveness) !== null && _a !== void 0 ? _a : 0) > 0.001;
}
function mergeLiveness(track, pb) {
    if (!pb.length)
        return track;
    return track.map((dst) => {
        const src = bestMatch(dst, pb);
        if (!src)
            return dst;
        return Object.assign(Object.assign({}, dst), { liveness: src.liveness, livenessLabel: src.livenessLabel });
    });
}
function mergeEyes(track, pb, swapLeftRight) {
    if (!pb.length)
        return track;
    return track.map((dst) => {
        const src = bestMatch(dst, pb);
        if (!src)
            return dst;
        if (swapLeftRight) {
            return Object.assign(Object.assign({}, dst), { eyesLeftLabel: src.eyesRightLabel, eyesRightLabel: src.eyesLeftLabel, left_eye_closed: src.right_eye_closed, right_eye_closed: src.left_eye_closed });
        }
        return Object.assign(Object.assign({}, dst), { eyesLeftLabel: src.eyesLeftLabel, eyesRightLabel: src.eyesRightLabel, left_eye_closed: src.left_eye_closed, right_eye_closed: src.right_eye_closed });
    });
}
function bestMatch(dst, pb) {
    var _a, _b;
    if (pb.length === 1)
        return (_a = pb[0]) !== null && _a !== void 0 ? _a : null;
    let best = null;
    let bestIou = 0.1;
    for (const src of pb) {
        const v = iou(dst, src);
        if (v > bestIou) {
            bestIou = v;
            best = src;
        }
    }
    return (_b = best !== null && best !== void 0 ? best : pb[0]) !== null && _b !== void 0 ? _b : null;
}
function iou(a, b) {
    const left = Math.max(a.x1, b.x1);
    const top = Math.max(a.y1, b.y1);
    const right = Math.min(a.x2, b.x2);
    const bottom = Math.min(a.y2, b.y2);
    const inter = Math.max(0, right - left) * Math.max(0, bottom - top);
    const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
    const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
    const union = areaA + areaB - inter;
    if (union <= 0)
        return 0;
    return inter / union;
}

const DEFAULT_CAPTURE_SETTINGS = {
    camera_lens: 'front',
    liveness_threshold: 0.5,
    liveness_level: 0,
    yaw_threshold: 40,
    roll_threshold: 40,
    pitch_threshold: 40,
    eyeclose_threshold: 0.5,
};
/** Map demo / app settings onto Capture thresholds (one source of truth). */
function toCaptureSettings(s) {
    return {
        camera_lens: s.camera_lens,
        liveness_threshold: s.liveness_threshold,
        liveness_level: s.liveness_level,
        yaw_threshold: s.yaw_threshold,
        roll_threshold: s.roll_threshold,
        pitch_threshold: s.pitch_threshold,
        eyeclose_threshold: s.eyeclose_threshold,
    };
}

const FaceRecognitionSdkNative = core.registerPlugin('FaceRecognitionSdk', {
    web: () => Promise.resolve().then(function () { return web; }).then((m) => new m.FaceRecognitionSdkWeb()),
});
async function getMachineCode() {
    const { value } = await FaceRecognitionSdkNative.getMachineCode();
    return value;
}
async function getLicenseStatus() {
    const { value } = await FaceRecognitionSdkNative.getLicenseStatus();
    return value;
}
async function setActivation(license) {
    const { value } = await FaceRecognitionSdkNative.setActivation({ license });
    return value;
}
async function init() {
    const { value } = await FaceRecognitionSdkNative.init();
    return value;
}
async function deinit() {
    await FaceRecognitionSdkNative.deinit();
}
async function lastLicenseError() {
    const { value } = await FaceRecognitionSdkNative.lastLicenseError();
    return value;
}
async function setLandmarkMode(mode) {
    const { value } = await FaceRecognitionSdkNative.setLandmarkMode({ mode });
    return value;
}
async function getLandmarkMode() {
    const { value } = await FaceRecognitionSdkNative.getLandmarkMode();
    return value;
}
async function detect(image, crop = false, flags = DETECT_ALL) {
    const { value } = await FaceRecognitionSdkNative.detect({
        image,
        crop,
        flags,
    });
    return value;
}
async function faceDetection(image, param) {
    const { value } = await FaceRecognitionSdkNative.faceDetection({
        image,
        param: param ? JSON.stringify(param) : null,
    });
    try {
        const parsed = JSON.parse(value);
        return normalizeFaceBoxes(Array.isArray(parsed) ? parsed : []);
    }
    catch (_a) {
        return [];
    }
}
async function templateExtraction(image, faceBox) {
    const boxJson = typeof faceBox === 'string' ? faceBox : JSON.stringify(faceBox);
    const { value } = await FaceRecognitionSdkNative.templateExtraction({
        image,
        faceBox: boxJson,
    });
    return value;
}
async function cropFace(image, faceBox) {
    const boxJson = typeof faceBox === 'string' ? faceBox : JSON.stringify(faceBox);
    const { value } = await FaceRecognitionSdkNative.cropFace({
        image,
        faceBox: boxJson,
    });
    return value;
}
async function extractFeature(image) {
    const { value } = await FaceRecognitionSdkNative.extractFeature({ image });
    return value;
}
async function similarity(feature1B64, feature2B64) {
    const { value } = await FaceRecognitionSdkNative.similarity({
        feature1: feature1B64,
        feature2: feature2B64,
    });
    return value;
}
async function quality(image, crop = false) {
    const { value } = await FaceRecognitionSdkNative.quality({ image, crop });
    return value;
}
async function startVideoWorker(config = { matchThreshold: 0.67 }) {
    const json = typeof config === 'string' ? config : JSON.stringify(config !== null && config !== void 0 ? config : {});
    const { value } = await FaceRecognitionSdkNative.startVideoWorker({
        config: json,
    });
    return value;
}
async function stopVideoWorker() {
    await FaceRecognitionSdkNative.stopVideoWorker();
}
async function syncVideoWorkerDatabase(featuresB64, matchThreshold = 0.67) {
    const { value } = await FaceRecognitionSdkNative.syncVideoWorkerDatabase({
        features: featuresB64,
        matchThreshold,
    });
    return value;
}
function normalizeLiveFrameResult(raw) {
    return {
        ingested: Boolean(raw === null || raw === void 0 ? void 0 : raw.ingested),
        width: Number(raw === null || raw === void 0 ? void 0 : raw.width) || 0,
        height: Number(raw === null || raw === void 0 ? void 0 : raw.height) || 0,
        uri: typeof (raw === null || raw === void 0 ? void 0 : raw.uri) === 'string' ? raw.uri : null,
    };
}
function resolveLiveUri(input) {
    if (typeof input === 'string') {
        if (input.startsWith('file://') ||
            input.startsWith('content:') ||
            input.startsWith('data:')) {
            return input;
        }
        if (input.startsWith('/')) {
            return `file://${input}`;
        }
        return input;
    }
    const path = input === null || input === void 0 ? void 0 : input.path;
    if (!path || typeof path !== 'string') {
        throw new Error('ingestLiveCameraFrame: expected a URI string or { path }');
    }
    return path.startsWith('file://') || path.startsWith('content:')
        ? path
        : `file://${path}`;
}
function resolveLiveArgs(input, frontOrOptions, orientationArg) {
    var _a;
    if (typeof input === 'string' || (input && typeof input === 'object' && 'path' in input)) {
        if (typeof frontOrOptions === 'boolean') {
            return {
                uri: resolveLiveUri(input),
                options: {
                    frontCamera: frontOrOptions,
                    orientation: typeof orientationArg === 'string'
                        ? orientationArg
                        : typeof input === 'object'
                            ? input.orientation
                            : undefined,
                },
            };
        }
        const opts = frontOrOptions && typeof frontOrOptions === 'object' ? frontOrOptions : {};
        const photoOrient = typeof input === 'object' && input && 'orientation' in input
            ? input.orientation
            : undefined;
        return {
            uri: resolveLiveUri(input),
            options: {
                frontCamera: opts.frontCamera !== false,
                orientation: (_a = opts.orientation) !== null && _a !== void 0 ? _a : photoOrient,
                rotateDegrees: opts.rotateDegrees,
                maxEdge: opts.maxEdge,
            },
        };
    }
    throw new Error('ingestLiveCameraFrame: invalid arguments');
}
async function prepareAndMaybeFeed(input, frontOrOptions, orientationArg, feedWorker = true) {
    const { uri, options } = resolveLiveArgs(input, frontOrOptions, orientationArg);
    const maxEdge = options.maxEdge != null && options.maxEdge > 0
        ? options.maxEdge
        : LIVE_FRAME_MAX_EDGE;
    let rotateDegrees;
    if (options.rotateDegrees != null && Number.isFinite(options.rotateDegrees)) {
        rotateDegrees = options.rotateDegrees;
    }
    else {
        const probed = await FaceRecognitionSdkNative.probeLiveImage({ image: uri });
        const plan = planLiveFrame({
            frontCamera: options.frontCamera !== false,
            orientation: options.orientation,
            width: Number(probed === null || probed === void 0 ? void 0 : probed.width) || 0,
            height: Number(probed === null || probed === void 0 ? void 0 : probed.height) || 0,
            maxEdge,
            platform: core.Capacitor.getPlatform(),
        });
        rotateDegrees = plan.rotateDegrees;
    }
    const raw = await FaceRecognitionSdkNative.applyLiveFrame({
        image: uri,
        rotateDegrees,
        maxEdge,
        feedWorker,
    });
    return normalizeLiveFrameResult(raw);
}
function ingestLiveCameraFrame(input, frontOrOptions, orientation) {
    return prepareAndMaybeFeed(input, frontOrOptions, orientation, true);
}
async function prepareLiveCameraFrame(input, frontOrOptions, orientation) {
    const result = await prepareAndMaybeFeed(input, frontOrOptions, orientation, false);
    if (!result.uri) {
        throw new Error('prepareLiveCameraFrame: no output URI');
    }
    return result.uri;
}
async function addVideoWorkerFrame(input, frontOrOptions, orientation) {
    const result = await prepareAndMaybeFeed(input, frontOrOptions, orientation, true);
    return result.ingested ? 0 : 1;
}
async function exportLastLiveFrame() {
    const raw = await FaceRecognitionSdkNative.exportLastLiveFrame();
    return normalizeLiveFrameResult(raw);
}
async function writeStatus(payload) {
    await FaceRecognitionSdkNative.writeStatus({
        payload: JSON.stringify(payload),
    });
}
async function estimatorStatus() {
    const { value } = await FaceRecognitionSdkNative.estimatorStatus();
    return value;
}
async function startLivePreview(frontCamera = true) {
    if (typeof document !== 'undefined') {
        document.documentElement.classList.add('frs-live-camera');
    }
    await FaceRecognitionSdkNative.startLivePreview({ frontCamera });
}
async function stopLivePreview() {
    try {
        await FaceRecognitionSdkNative.stopLivePreview();
    }
    finally {
        if (typeof document !== 'undefined') {
            document.documentElement.classList.remove('frs-live-camera');
        }
    }
}
async function takeLiveSnapshot() {
    const snap = await FaceRecognitionSdkNative.takeLiveSnapshot();
    return { path: snap.path || snap.uri };
}
function subscribeVideoWorker(cb) {
    let removed = false;
    const handle = FaceRecognitionSdkNative.addListener('FaceRecognitionVideoWorkerEvent', (event) => {
        const ev = parseVideoWorkerEvent(typeof (event === null || event === void 0 ? void 0 : event.json) === 'string' ? event.json : '{}');
        if (ev)
            cb(ev);
    });
    return () => {
        if (removed)
            return;
        removed = true;
        void handle.then((h) => h.remove());
    };
}
const SDK_SUCCESS = 0;
const SDK_LICENSE_INVALID = 1;
const SDK_LICENSE_EXPIRED = 2;
const SDK_NOT_ACTIVATED = 3;
const SDK_INIT_FAILED = 4;
const DETECT_POSE = 1 << 0;
const DETECT_LANDMARKS = 1 << 1;
const DETECT_AGE = 1 << 2;
const DETECT_GENDER = 1 << 3;
const DETECT_EMOTION = 1 << 4;
const DETECT_MASK = 1 << 5;
const DETECT_QUALITY = 1 << 6;
const DETECT_FACE_QUALITY = 1 << 7;
const DETECT_EYES = 1 << 8;
const DETECT_LIVENESS = 1 << 9;
const DETECT_GLASSES = 1 << 11;
const DETECT_LIVENESS_ACCURATE = 1 << 16;
const DETECT_ALL = 0xffffffff;
const LANDMARK_MODE_14 = 14;
const LANDMARK_MODE_68 = 68;
const LANDMARK_MODE_468 = 468;

/** Parsed FaceRecognitionSDK.getLicenseStatus JSON — same contract as native LicenseStatus. */
const NOT_LICENSED = {
    licensed: false,
    level: -1,
    levelName: 'None',
    recognition: false,
    liveness: false,
    label: 'Not licensed',
};
function parseLicenseStatus(json) {
    try {
        const o = JSON.parse(json || '{}');
        if (!o || typeof o !== 'object' || Array.isArray(o))
            return NOT_LICENSED;
        const label = typeof o.label === 'string' && o.label.trim() ? o.label : 'Not licensed';
        return {
            licensed: Boolean(o.licensed),
            level: typeof o.level === 'number' ? o.level : -1,
            levelName: typeof o.levelName === 'string' ? o.levelName : 'None',
            recognition: Boolean(o.recognition),
            liveness: Boolean(o.liveness),
            label,
        };
    }
    catch (_a) {
        return NOT_LICENSED;
    }
}
/** Home status bar after a successful init — Android `Ready · %s`. */
function readyStatusMessage(label) {
    const t = (label || '').trim();
    return t ? `Ready · ${t}` : 'Ready';
}

class IdentifySession {
    constructor(opts) {
        this.lastLiveness = [];
        this.frameSize = { w: 480, h: 640 };
        this.lastUri = null;
        this.unsubscribe = null;
        this.cancelled = false;
        this.workerReady = false;
        this.livBusy = false;
        this.lastLivenessMs = 0;
        this.pollPromise = null;
        this.settings = opts.settings;
        this.featureTemplates = opts.featureTemplates;
        this.onTracking = opts.onTracking;
        this.onMatch = opts.onMatch;
    }
    /** Native front preview is mirrored on both platforms; engine frames are not. */
    get overlayMirror() {
        return this.settings.frontCamera;
    }
    async start() {
        this.cancelled = false;
        await startLivePreview(this.settings.frontCamera);
        this.unsubscribe = subscribeVideoWorker((ev) => {
            var _a, _b, _c;
            if (this.cancelled)
                return;
            if (ev.type === 'tracking') {
                if (ev.frameWidth > 0 && ev.frameHeight > 0) {
                    this.frameSize = { w: ev.frameWidth, h: ev.frameHeight };
                }
                let next = ev.faces.map(workerFaceToBox);
                next = mergeLiveness(next, this.lastLiveness);
                this.onTracking(next, this.frameSize);
                for (const f of ev.faces) {
                    if (((_a = f.match) === null || _a === void 0 ? void 0 : _a.matched) && f.match.personIndex != null) {
                        this.onMatch(f.match.personIndex, (_b = f.match.score) !== null && _b !== void 0 ? _b : 0);
                        break;
                    }
                }
            }
            else if (ev.type === 'match' && ev.matched && ev.personIndex != null) {
                this.onMatch(ev.personIndex, (_c = ev.score) !== null && _c !== void 0 ? _c : 0);
            }
        });
        const started = await startVideoWorker({
            matchThreshold: this.settings.matchThreshold,
        });
        const synced = await syncVideoWorkerDatabase(this.featureTemplates, this.settings.matchThreshold);
        if (!this.cancelled) {
            this.workerReady = started === 0 && synced === 0;
        }
        this.pollPromise = this.exportLoop();
    }
    leave() {
        this.cancelled = true;
        this.workerReady = false;
    }
    async stop() {
        var _a;
        this.leave();
        (_a = this.unsubscribe) === null || _a === void 0 ? void 0 : _a.call(this);
        this.unsubscribe = null;
        await this.pollPromise;
        this.pollPromise = null;
        await stopVideoWorker();
        await stopLivePreview();
    }
    async dispose() {
        await this.stop();
    }
    async exportLoop() {
        var _a, _b;
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const interval = (_a = this.settings.frameIntervalMs) !== null && _a !== void 0 ? _a : 120;
        while (!this.cancelled) {
            if (!this.workerReady) {
                await sleep(80);
                continue;
            }
            try {
                const exported = await exportLastLiveFrame();
                if (exported.uri)
                    this.lastUri = exported.uri;
                const now = Date.now();
                const livInterval = (_b = this.settings.livenessIntervalMs) !== null && _b !== void 0 ? _b : 450;
                if (exported.uri &&
                    !this.cancelled &&
                    !this.livBusy &&
                    now - this.lastLivenessMs >= livInterval) {
                    this.lastLivenessMs = now;
                    this.livBusy = true;
                    try {
                        if (this.cancelled)
                            return;
                        const liv = await faceDetection(exported.uri, {
                            check_liveness: true,
                            check_liveness_level: this.settings.livenessLevel,
                        });
                        if (liv.length > 0)
                            this.lastLiveness = liv;
                    }
                    catch (_c) {
                        // FaceBox.liveness copy is optional while the camera warms up.
                    }
                    finally {
                        this.livBusy = false;
                    }
                }
            }
            catch (_d) {
                // Export optional until the camera warms up.
            }
            await sleep(interval);
        }
    }
}

class CaptureSession {
    constructor(opts) {
        this.frameSize = { w: 480, h: 640 };
        this.lastBoxes = [];
        this.unsubscribe = null;
        this.cancelled = false;
        this.capturing = false;
        this.settings = opts.settings;
        this.onState = opts.onState;
        this.onCaptured = opts.onCaptured;
    }
    /** Native front preview is mirrored on both platforms; engine frames are not. */
    get overlayMirror() {
        return this.settings.camera_lens === 'front';
    }
    async start() {
        this.cancelled = false;
        this.capturing = false;
        await startLivePreview(this.settings.camera_lens === 'front');
        this.unsubscribe = subscribeVideoWorker((ev) => {
            if (this.cancelled || this.capturing || ev.type !== 'tracking')
                return;
            if (ev.frameWidth > 0 && ev.frameHeight > 0) {
                this.frameSize = { w: ev.frameWidth, h: ev.frameHeight };
            }
            const merged = mergeEyes(mergeLiveness(ev.faces.map(workerFaceToBox), []), [], this.overlayMirror);
            this.lastBoxes = merged;
            const state = checkFace(merged, this.settings, this.frameSize);
            this.onState(state, warningFor(state), merged, this.frameSize);
        });
        await startVideoWorker({ matchThreshold: 0.8 });
    }
    async stop() {
        var _a;
        this.cancelled = true;
        (_a = this.unsubscribe) === null || _a === void 0 ? void 0 : _a.call(this);
        this.unsubscribe = null;
        await stopVideoWorker();
        await stopLivePreview();
    }
    async captureNow(boxes) {
        var _a, _b, _c;
        if (this.capturing)
            return null;
        this.capturing = true;
        try {
            await stopVideoWorker();
            const exported = await exportLastLiveFrame();
            const uri = exported.uri;
            if (!uri)
                return null;
            if (exported.width > 0 && exported.height > 0) {
                this.frameSize = { w: exported.width, h: exported.height };
            }
            let box = (_b = (_a = boxes[0]) !== null && _a !== void 0 ? _a : this.lastBoxes[0]) !== null && _b !== void 0 ? _b : null;
            try {
                const detected = await faceDetection(uri, {
                    allAttributes: true,
                    check_liveness: true,
                    check_liveness_level: this.settings.liveness_level,
                });
                box = (_c = detected[0]) !== null && _c !== void 0 ? _c : box;
            }
            catch (_d) {
                // keep tracker box
            }
            if (!box)
                return null;
            let cropB64 = null;
            try {
                cropB64 = await cropFace(uri, box);
            }
            catch (_e) {
                cropB64 = null;
            }
            const result = { uri, faceBox: box, cropB64 };
            this.onCaptured(result);
            return result;
        }
        finally {
            this.capturing = false;
        }
    }
}

const MSG = 'Face Recognition SDK requires a native Android or iOS build (npx cap sync).';
class FaceRecognitionSdkWeb extends core.WebPlugin {
    async getMachineCode() {
        throw this.unimplemented(MSG);
    }
    async setActivation() {
        throw this.unimplemented(MSG);
    }
    async init() {
        throw this.unimplemented(MSG);
    }
    async deinit() {
        throw this.unimplemented(MSG);
    }
    async lastLicenseError() {
        throw this.unimplemented(MSG);
    }
    async getLicenseStatus() {
        throw this.unimplemented(MSG);
    }
    async setLandmarkMode() {
        throw this.unimplemented(MSG);
    }
    async getLandmarkMode() {
        throw this.unimplemented(MSG);
    }
    async detect() {
        throw this.unimplemented(MSG);
    }
    async faceDetection() {
        throw this.unimplemented(MSG);
    }
    async templateExtraction() {
        throw this.unimplemented(MSG);
    }
    async cropFace() {
        throw this.unimplemented(MSG);
    }
    async extractFeature() {
        throw this.unimplemented(MSG);
    }
    async similarity() {
        throw this.unimplemented(MSG);
    }
    async quality() {
        throw this.unimplemented(MSG);
    }
    async startVideoWorker() {
        throw this.unimplemented(MSG);
    }
    async stopVideoWorker() {
        throw this.unimplemented(MSG);
    }
    async syncVideoWorkerDatabase() {
        throw this.unimplemented(MSG);
    }
    async probeLiveImage() {
        throw this.unimplemented(MSG);
    }
    async applyLiveFrame() {
        throw this.unimplemented(MSG);
    }
    async exportLastLiveFrame() {
        throw this.unimplemented(MSG);
    }
    async writeStatus() {
        throw this.unimplemented(MSG);
    }
    async estimatorStatus() {
        throw this.unimplemented(MSG);
    }
    async startLivePreview() {
        throw this.unimplemented(MSG);
    }
    async stopLivePreview() {
        throw this.unimplemented(MSG);
    }
    async takeLiveSnapshot() {
        throw this.unimplemented(MSG);
    }
}

var web = /*#__PURE__*/Object.freeze({
    __proto__: null,
    FaceRecognitionSdkWeb: FaceRecognitionSdkWeb
});

exports.CaptureSession = CaptureSession;
exports.DEFAULT_CAPTURE_SETTINGS = DEFAULT_CAPTURE_SETTINGS;
exports.DETECT_AGE = DETECT_AGE;
exports.DETECT_ALL = DETECT_ALL;
exports.DETECT_EMOTION = DETECT_EMOTION;
exports.DETECT_EYES = DETECT_EYES;
exports.DETECT_FACE_QUALITY = DETECT_FACE_QUALITY;
exports.DETECT_GENDER = DETECT_GENDER;
exports.DETECT_GLASSES = DETECT_GLASSES;
exports.DETECT_LANDMARKS = DETECT_LANDMARKS;
exports.DETECT_LIVENESS = DETECT_LIVENESS;
exports.DETECT_LIVENESS_ACCURATE = DETECT_LIVENESS_ACCURATE;
exports.DETECT_MASK = DETECT_MASK;
exports.DETECT_POSE = DETECT_POSE;
exports.DETECT_QUALITY = DETECT_QUALITY;
exports.FaceRecognitionSdk = FaceRecognitionSdkNative;
exports.IdentifySession = IdentifySession;
exports.LANDMARK_MODE_14 = LANDMARK_MODE_14;
exports.LANDMARK_MODE_468 = LANDMARK_MODE_468;
exports.LANDMARK_MODE_68 = LANDMARK_MODE_68;
exports.LIVE_FRAME_MAX_EDGE = LIVE_FRAME_MAX_EDGE;
exports.NOT_LICENSED = NOT_LICENSED;
exports.SDK_INIT_FAILED = SDK_INIT_FAILED;
exports.SDK_LICENSE_EXPIRED = SDK_LICENSE_EXPIRED;
exports.SDK_LICENSE_INVALID = SDK_LICENSE_INVALID;
exports.SDK_NOT_ACTIVATED = SDK_NOT_ACTIVATED;
exports.SDK_SUCCESS = SDK_SUCCESS;
exports.addVideoWorkerFrame = addVideoWorkerFrame;
exports.checkFace = checkFace;
exports.cropFace = cropFace;
exports.deinit = deinit;
exports.detect = detect;
exports.estimatorStatus = estimatorStatus;
exports.exportLastLiveFrame = exportLastLiveFrame;
exports.extractFeature = extractFeature;
exports.faceDetection = faceDetection;
exports.getLandmarkMode = getLandmarkMode;
exports.getLicenseStatus = getLicenseStatus;
exports.getMachineCode = getMachineCode;
exports.getROIRect1 = getROIRect1;
exports.hasLiveness = hasLiveness;
exports.ingestLiveCameraFrame = ingestLiveCameraFrame;
exports.init = init;
exports.lastLicenseError = lastLicenseError;
exports.livenessPassed = livenessPassed;
exports.mapFramePoint = mapFramePoint;
exports.mapLandmarksToCrop = mapLandmarksToCrop;
exports.mapRoiToView = mapRoiToView;
exports.mergeEyes = mergeEyes;
exports.mergeLiveness = mergeLiveness;
exports.normalizeFaceBox = normalizeFaceBox;
exports.normalizeFaceBoxes = normalizeFaceBoxes;
exports.parseLicenseStatus = parseLicenseStatus;
exports.parseVideoWorkerEvent = parseVideoWorkerEvent;
exports.planLiveFrame = planLiveFrame;
exports.prepareLiveCameraFrame = prepareLiveCameraFrame;
exports.quality = quality;
exports.qualityText = qualityText;
exports.readyStatusMessage = readyStatusMessage;
exports.resultDetailRows = resultDetailRows;
exports.setActivation = setActivation;
exports.setLandmarkMode = setLandmarkMode;
exports.similarity = similarity;
exports.startLivePreview = startLivePreview;
exports.startVideoWorker = startVideoWorker;
exports.stopLivePreview = stopLivePreview;
exports.stopVideoWorker = stopVideoWorker;
exports.subscribeVideoWorker = subscribeVideoWorker;
exports.syncVideoWorkerDatabase = syncVideoWorkerDatabase;
exports.takeLiveSnapshot = takeLiveSnapshot;
exports.templateExtraction = templateExtraction;
exports.toCaptureSettings = toCaptureSettings;
exports.warningFor = warningFor;
exports.workerFaceToBox = workerFaceToBox;
exports.writeStatus = writeStatus;
//# sourceMappingURL=plugin.cjs.js.map
