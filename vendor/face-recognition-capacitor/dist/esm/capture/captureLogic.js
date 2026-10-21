/** Android CaptureView.getROIRect — used by checkFace fit/size tests. */
export function getROIRect(frame) {
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
export function getROIRect1(frame) {
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
export function mapRoiToView(frame, viewW, viewH) {
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
export function mapFramePoint(x, y, fw, fh, vw, vh, mirror) {
    const scale = Math.max(vw / fw, vh / fh);
    const dx = (vw - fw * scale) / 2;
    const dy = (vh - fh * scale) / 2;
    let vx = x * scale + dx;
    const vy = y * scale + dy;
    if (mirror)
        vx = vw - vx;
    return { x: vx, y: vy };
}
export function warningFor(state) {
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
export function checkFace(boxes, settings, frame) {
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
export function mapLandmarksToCrop(faceBox, srcW, srcH, outW, outH) {
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
export function hasLiveness(box) {
    var _a;
    if (box.livenessLabel && box.livenessLabel.length > 0)
        return true;
    return ((_a = box.liveness) !== null && _a !== void 0 ? _a : 0) > 0.001;
}
export function mergeLiveness(track, pb) {
    if (!pb.length)
        return track;
    return track.map((dst) => {
        const src = bestMatch(dst, pb);
        if (!src)
            return dst;
        return Object.assign(Object.assign({}, dst), { liveness: src.liveness, livenessLabel: src.livenessLabel });
    });
}
export function mergeEyes(track, pb, swapLeftRight) {
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
//# sourceMappingURL=captureLogic.js.map