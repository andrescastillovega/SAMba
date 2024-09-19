let isDragging = false;
let initialX, initialY;

function addDragListeners(annotation) {
    annotation.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
}

function removeDragListeners(annotation) {
    annotation.removeEventListener('mousedown', dragStart);
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', dragEnd);
}

function dragStart(event) {
    if (event.target.classList.contains('resize-handle')) return;
    isDragging = true;
    initialX = event.clientX;
    initialY = event.clientY;
}

function drag(event) {
    if (!isDragging) return;
    event.preventDefault();
    const selectedBox = document.querySelector('.selected');
    if (!selectedBox) return;

    const dX = event.clientX - initialX;
    const dY = event.clientY - initialY;
    updateAnnotationPoints(selectedBox, dX, dY);
    updateResizeHandles(selectedBox);
    updateRotationHandle(selectedBox);  // Add this line
    initialX = event.clientX;
    initialY = event.clientY;
}

function dragEnd() {
    isDragging = false;
}

function updateAnnotationPoints(annotation, dx, dy) {
    const points = annotation.getAttribute("points").split(" ");
    const updatedPoints = points.map(point => {
        const [x, y] = point.split(",");
        return `${parseFloat(x) + dx},${parseFloat(y) + dy}`;
    });
    annotation.setAttribute("points", updatedPoints.join(" "));
    annotation.classList.add("edited-box");

    // Update center coordinates
    const cx = parseFloat(annotation.getAttribute("cx")) + dx;
    const cy = parseFloat(annotation.getAttribute("cy")) + dy;
    annotation.setAttribute("cx", cx);
    annotation.setAttribute("cy", cy);
}
