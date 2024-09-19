let isRotating = false;
let rotationCenter = { x: 0, y: 0 };
let startAngle = 0;
let currentRotation = 0;
let handleOffset = { x: 0, y: 0 };

function addRotationHandle(box) {
    const points = box.getAttribute('points').split(' ').map(p => p.split(',').map(Number));
    const handleStart = [(points[0][0] + points[3][0]) / 2, (points[0][1] + points[3][1]) / 2];
    const centerX = parseFloat(box.getAttribute('cx'));
    const centerY = parseFloat(box.getAttribute('cy'));
    const width = parseFloat(box.getAttribute('width'));
    const height = parseFloat(box.getAttribute('height'));
    const angle = parseFloat(box.getAttribute('angle') || 0);
    const angleRad = angle * (Math.PI / 180);

    // Create rotation handle group
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'rotation-handle-group');

    // Set handle offset
    handleOffset = { x: -30, y: 0 };

    // Calculate initial handle position
    const handleX = handleStart[0] + (handleOffset.x * Math.cos(angleRad) - handleOffset.y * Math.sin(angleRad));
    const handleY = handleStart[1] + (handleOffset.x * Math.sin(angleRad) + handleOffset.y * Math.cos(angleRad));

    // Create dashed line
    const dashedLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    dashedLine.setAttribute('x1', centerX);
    dashedLine.setAttribute('y1', centerY);
    dashedLine.setAttribute('x2', handleX);
    dashedLine.setAttribute('y2', handleY);
    dashedLine.setAttribute('stroke', 'white');
    dashedLine.setAttribute('stroke-width', '1');
    dashedLine.setAttribute('stroke-dasharray', '2,2');

    // Create rotation handle
    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    handle.setAttribute('cx', handleX);
    handle.setAttribute('cy', handleY);
    handle.setAttribute('r', 5);
    handle.setAttribute('fill', 'white');
    handle.setAttribute('stroke', 'black');
    handle.setAttribute('stroke-width', '2');
    handle.setAttribute('class', 'rotation-handle');
    handle.style.cursor = 'grab';

    g.appendChild(dashedLine);
    g.appendChild(handle);
    box.parentNode.appendChild(g);

    handle.addEventListener('mousedown', rotationStart);
    document.addEventListener('mousemove', rotate);
    document.addEventListener('mouseup', rotationEnd);
}

function removeRotationHandle(box) {
    const handle = box.parentNode.querySelector('.rotation-handle-group');
    if (handle) {
        handle.remove();
    }
    document.removeEventListener('mousemove', rotate);
    document.removeEventListener('mouseup', rotationEnd);
}

function rotationStart(event) {
    isRotating = true;
    const box = document.querySelector('.selected');
    if (!box) return;

    rotationCenter.x = parseFloat(box.getAttribute('cx'));
    rotationCenter.y = parseFloat(box.getAttribute('cy'));

    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    startAngle = Math.atan2(mouseY - rotationCenter.y, mouseX - rotationCenter.x);
    currentRotation = parseFloat(box.getAttribute('angle') || 0);

    event.stopPropagation();
    event.preventDefault();
}

function rotate(event) {
    if (!isRotating) return;

    const box = document.querySelector('.selected');
    if (!box) return;

    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const currentAngle = Math.atan2(mouseY - rotationCenter.y, mouseX - rotationCenter.x);
    let angleDiff = currentAngle - startAngle;

    // Ensure the angle difference is always between -PI and PI
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    let newRotation = currentRotation + angleDiff * (180 / Math.PI);

    // Normalize the rotation angle to be between 0 and 360 degrees
    newRotation = (newRotation + 360) % 360;

    updateBoxRotation(box, newRotation);
    updateAllHandles(box);

    box.classList.add("edited-box");

    // Update the start angle and current rotation for the next rotation
    startAngle = currentAngle;
    currentRotation = newRotation;
}

function rotationEnd() {
    isRotating = false;
}

function updateBoxRotation(box, angle) {
    const centerX = parseFloat(box.getAttribute('cx'));
    const centerY = parseFloat(box.getAttribute('cy'));
    const width = parseFloat(box.getAttribute('width'));
    const height = parseFloat(box.getAttribute('height'));

    const newPoints = boxPoints([centerX, centerY], width, height, angle);
    box.setAttribute('points', newPoints.map(p => p.join(',')).join(' '));
    box.setAttribute('angle', angle);
}

function updateAllHandles(box) {
    updateRotationHandle(box);
    updateResizeHandles(box);
}

function updateRotationHandle(box) {
    const points = box.getAttribute('points').split(' ').map(p => p.split(',').map(Number));
    const handleStart = [(points[0][0] + points[3][0]) / 2, (points[0][1] + points[3][1]) / 2];
    const centerX = parseFloat(box.getAttribute('cx'));
    const centerY = parseFloat(box.getAttribute('cy'));
    const angle = parseFloat(box.getAttribute('angle'));
    const angleRad = angle * (Math.PI / 180);

    const handleGroup = box.parentNode.querySelector('.rotation-handle-group');
    if (handleGroup) {
        const dashedLine = handleGroup.querySelector('line');
        const handle = handleGroup.querySelector('circle');

        // Calculate new handle position
        const newHandleX = handleStart[0] + (handleOffset.x * Math.cos(angleRad) - handleOffset.y * Math.sin(angleRad));
        const newHandleY = handleStart[1] + (handleOffset.x * Math.sin(angleRad) + handleOffset.y * Math.cos(angleRad));

        // Update dashed line
        dashedLine.setAttribute('x1', centerX);
        dashedLine.setAttribute('y1', centerY);
        dashedLine.setAttribute('x2', newHandleX);
        dashedLine.setAttribute('y2', newHandleY);

        // Update handle position
        handle.setAttribute('cx', newHandleX);
        handle.setAttribute('cy', newHandleY);
    }
}
