export function livenessPassed(settings, score, label) {
    const lower = (label !== null && label !== void 0 ? label : '').toLowerCase();
    if (lower.includes('spoof') || lower.includes('fake'))
        return false;
    return score >= settings.liveness_threshold;
}
export function qualityText(score) {
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
export function resultDetailRows(box, settings, opts) {
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
//# sourceMappingURL=resultDetails.js.map