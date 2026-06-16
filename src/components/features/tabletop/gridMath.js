const toFiniteNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

export const clientToMapPoint = ({
    clientX,
    clientY,
    mapLeft,
    mapTop,
    scale,
    offsetX = 0,
    offsetY = 0
}) => {
    const safeScale = Math.max(toFiniteNumber(scale, 1), 0.001);
    return {
        x: (toFiniteNumber(clientX) - toFiniteNumber(mapLeft)) / safeScale - toFiniteNumber(offsetX),
        y: (toFiniteNumber(clientY) - toFiniteNumber(mapTop)) / safeScale - toFiniteNumber(offsetY)
    };
};

export const snapTokenToGrid = ({
    x,
    y,
    gridSize,
    tokenWidth = 62,
    tokenHeight = 62
}) => {
    const safeGridSize = Math.max(toFiniteNumber(gridSize, 50), 1);
    const snapAxis = (value, tokenSize) => {
        const safeTokenSize = Math.max(toFiniteNumber(tokenSize, 62), 1);
        const tokenCenter = toFiniteNumber(value) + safeTokenSize / 2;
        // Half-cell anchors cover cell centers, line midpoints and line intersections.
        const snapStep = safeGridSize / 2;
        const nearestAnchor = Math.round(tokenCenter / snapStep) * snapStep;
        return Math.round(nearestAnchor - safeTokenSize / 2);
    };

    return {
        x: snapAxis(x, tokenWidth),
        y: snapAxis(y, tokenHeight)
    };
};
