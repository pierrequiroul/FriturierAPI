/**
 * Calcule le chevauchement en millisecondes entre deux plages horaires.
 * @returns {number} La durée du chevauchement en ms.
 */
exports.calculateOverlap = function(sessionStart, sessionEnd, rangeStart, rangeEnd) {
    const overlapStart = Math.max(sessionStart, rangeStart);
    const overlapEnd = Math.min(sessionEnd, rangeEnd);
    return Math.max(0, overlapEnd - overlapStart);
}