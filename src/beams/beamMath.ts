import {
  Arc3D,
  GEOMETRY_TOLERANCE,
  Helix3D,
  Line3D,
  type MemberCurve,
  Point3D,
  TOLERANCE,
  Vector3D,
} from '../geometry';
import type { CrossSection } from '../sections/crossSection';
import type { InsertPosition } from '../sections/insertPosition';
import { calculateDefaultUpVector } from './beamGeometry';

/**
 * Shifts the driver line so the chosen insert anchor of the cross-section lies on the driver,
 * then applies the user's additional section-plane offset. Both ride the rotated section axes.
 */
export function applyInsertOffset(
  driver: Line3D,
  crossSection: CrossSection,
  insertPosition: InsertPosition,
  rotation: number,
  offsetXMm = 0,
  offsetYMm = 0,
): Line3D {
  const anchor2d = crossSection.getInsertOffset(insertPosition);
  const shiftX = offsetXMm - anchor2d.x;
  const shiftY = offsetYMm - anchor2d.y;
  if (Math.abs(shiftX) < TOLERANCE && Math.abs(shiftY) < TOLERANCE) return driver;

  const direction = driver.direction;
  let up = calculateDefaultUpVector(direction);
  if (Math.abs(rotation) > TOLERANCE) up = up.rotateAroundAxis(direction, rotation);

  const binormal = up.cross(direction).normalized();
  const orthogonalUp = direction.cross(binormal).normalized();
  const shift3d = binormal.scale(shiftX).add(orthogonalUp.scale(shiftY));

  return new Line3D(driver.startPoint.add(shift3d), driver.endPoint.add(shift3d));
}

/** Extends (+) or shortens (-) each end along the beam axis by the given mm amounts. */
export function applyEndExtensions(centerline: Line3D, startMm: number, endMm: number): Line3D {
  if (Math.abs(startMm) < TOLERANCE && Math.abs(endMm) < TOLERANCE) return centerline;

  const direction = centerline.direction;
  const newStart = centerline.startPoint.subV(direction.scale(startMm));
  const newEnd = centerline.endPoint.add(direction.scale(endMm));

  if (newEnd.sub(newStart).length < TOLERANCE) return centerline;

  return new Line3D(newStart, newEnd);
}

/**
 * Extends (+) or shortens (-) each end of any MemberCurve centerline by the given mm amounts,
 * measured ALONG the curve. Lines delegate to applyEndExtensions (kept exported — it stays the
 * line-only path and applyInsertOffset's companion); arcs and helices grow their angular sweep
 * by dθ = mm / (arc length per radian), staying exactly on the same underlying circle/helix —
 * for small extensions the new endpoint sits ~mm past the old one along the (reversed) tangent,
 * and the mid-curve points are untouched. Degenerate results (shortening past the whole curve)
 * return the input unchanged, mirroring applyEndExtensions' guard.
 */
export function extendCurveEnds(
  curve: MemberCurve,
  startExtMm: number,
  endExtMm: number,
): MemberCurve {
  if (Math.abs(startExtMm) < TOLERANCE && Math.abs(endExtMm) < TOLERANCE) return curve;

  switch (curve.kind) {
    case 'line3d':
      return applyEndExtensions(curve, startExtMm, endExtMm);

    case 'arc3d': {
      // Arc length per radian is |radius|, so each mm of extension is dθ = mm/|radius| of extra
      // sweep. The travel direction in θ is sign(sweep): the start angle moves AGAINST it, the
      // end angle WITH it — both angles stay un-wrapped raw values so sweepAngle's (0,2π]
      // normalization (see Arc3D.sweepAngle) reads the grown sweep back exactly.
      const r = Math.abs(curve.radius);
      const sweep = curve.sweepAngle;
      const s = sweep >= 0 ? 1 : -1;
      const dStart = startExtMm / r;
      const dEnd = endExtMm / r;
      if ((Math.abs(sweep) + dStart + dEnd) * r < TOLERANCE) return curve; // shortened away
      // End angle from startAngle + sweep (not endAngle + dθ): for wrapped angle pairs (a full
      // turn stored as equal angles) endAngle-relative math would collapse the normalized 2π
      // sweep back to just the extension.
      return new Arc3D(
        curve.center, curve.normal, curve.xAxis, curve.radius,
        curve.startAngle - s * dStart,
        curve.startAngle + sweep + s * dEnd,
        curve.isCounterClockwise,
      );
    }

    case 'helix3d': {
      // Arc length per radian is sqrt(R² + (pitch/2π)²) (see Helix3D.length). Growing the start
      // moves θ₀ against the travel direction; because Helix3D measures its axial rise FROM
      // startAngle relative to `origin`, the origin must slide down the axis to where the new
      // start height is: Δh = pitch·(θ₀' − θ₀)/2π = −pitch·s·dθ_start/2π. Substituting back
      // shows every θ then maps to the identical world point of the original infinite helix.
      const rise = curve.pitch / (2 * Math.PI);
      const perRadian = Math.sqrt(curve.radius * curve.radius + rise * rise);
      const s = curve.sweepAngle >= 0 ? 1 : -1;
      const dStart = startExtMm / perRadian;
      const dEnd = endExtMm / perRadian;
      if ((Math.abs(curve.sweepAngle) + dStart + dEnd) * perRadian < TOLERANCE) return curve;
      return new Helix3D(
        curve.origin.add(curve.axis.scale(-curve.pitch * s * dStart / (2 * Math.PI))),
        curve.axis, curve.xAxis, curve.radius,
        curve.startAngle - s * dStart,
        curve.sweepAngle + s * (dStart + dEnd),
        curve.pitch,
      );
    }
  }
}

/**
 * The shared miter-plane normal for two beams meeting at `joint`, given the far (non-joint)
 * endpoints of each beam. Null when the beams are collinear (no miter).
 */
export function miterBisectorNormal(
  joint: Point3D,
  thisFar: Point3D,
  otherFar: Point3D,
): Vector3D | null {
  const d1 = thisFar.sub(joint).normalized();
  const d2 = otherFar.sub(joint).normalized();
  const normal = d1.sub(d2);
  return normal.length < GEOMETRY_TOLERANCE ? null : normal.normalized();
}
