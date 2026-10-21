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
export function parseVideoWorkerEvent(json) {
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
export function workerFaceToBox(face) {
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
//# sourceMappingURL=videoWorker.js.map