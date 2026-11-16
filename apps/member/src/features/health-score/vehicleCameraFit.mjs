// Shared with the real-asset validator so camera fitting and its checks cannot drift.
export const VEHICLE_CAMERA_FOV = 45;
// Encloses every vertex around the rotation origin after the model's -0.72m Y offset.
// The asset validator rejects geometry that outgrows this maintenance contract.
export const VEHICLE_BOUNDING_RADIUS = 2.52;

/** Fit the bounding sphere inside the narrower camera angle, allowing any rotation.
 * @param {number} width
 * @param {number} height
 * @returns {number}
 */
export function fitVehicleCameraDistance(width, height) {
  const aspect = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
    ? width / height : 1;
  const verticalHalfAngle = VEHICLE_CAMERA_FOV * Math.PI / 360;
  const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * aspect);
  const halfAngle = Math.min(verticalHalfAngle, horizontalHalfAngle);
  return VEHICLE_BOUNDING_RADIUS * 1.08 / Math.sin(halfAngle);
}
