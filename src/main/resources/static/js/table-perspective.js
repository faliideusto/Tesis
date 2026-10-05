// The painted table recedes towards a shared point above its centre.
// Layout coordinates alone determine orientation; no game data is used.
const planeCosine = Math.cos(40 * Math.PI / 180);
export function studySkew(slot, table) {
  if (!table.width || !table.height) return 0;
  const centreX = slot.left + slot.width / 2;
  const centreY = slot.top + slot.height / 2;
  const vanishingX = table.left + table.width / 2;
  const vanishingY = table.top - table.height * 1.6;
  const distance = Math.max(1, centreY - vanishingY);
  // rotateX foreshortens Y, so compensate before applying the lateral shear.
  const angle = Math.atan((centreX - vanishingX) / distance * planeCosine) * 180 / Math.PI;
  return Math.max(-18, Math.min(18, angle));
}

export function orientTableStudies(table) {
  if (!table?.isConnected) return;
  const bounds = table.getBoundingClientRect();
  const projections = [...table.querySelectorAll('.table-study-slot')].map(slot =>
    ({slot, angle:studySkew(slot.getBoundingClientRect(), bounds)}));
  if (!projections.length) return;
  table.classList.add('is-projecting');
  try {
    for (const {slot, angle} of projections) slot.style.setProperty('--study-skew', `${angle.toFixed(3)}deg`);
    // Commit the new plane with transitions suppressed; hover remains animated.
    const card = projections.at(-1).slot.querySelector('.table-study');
    if (card) getComputedStyle(card).transform;
  } finally {
    table.classList.remove('is-projecting');
  }
}
