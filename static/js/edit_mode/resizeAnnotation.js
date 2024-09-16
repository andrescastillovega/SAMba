let activeHandle = null;

function addResizeHandles(box) {
    const points = box.getAttribute('points').split(' ').map(p => p.split(',').map(Number));

    points.forEach((pos, index) => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');

        handle.setAttribute('cx', pos[0]);
        handle.setAttribute('cy', pos[1]);
        handle.setAttribute('r', 5);
        handle.setAttribute('fill', 'white');
        handle.setAttribute('stroke', 'black');
        handle.setAttribute('stroke-width', '2');
        handle.setAttribute('class', 'resize-handle');
        handle.setAttribute('data-handle-index', index);
        handle.style.cursor = 'pointer';
        
        handle.addEventListener('mousedown', handleResizeStart);

        //text.setAttribute('x', pos[0]);
        //text.setAttribute('y', pos[1]);
        //text.setAttribute("font-size","7");
        //text.setAttribute("text-anchor", "middle");
        //text.setAttribute("dominant-baseline", "middle");
        //text.setAttribute("fill", "black");
        //text.textContent = index;

        g.appendChild(handle);  
        //g.appendChild(text);
        box.parentNode.appendChild(g);
    });

    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleResizeEnd);
}

function removeResizeHandles(box) {
    const handles = box.parentNode.querySelectorAll('.resize-handle');
    handles.forEach(handle => handle.remove());
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', handleResizeEnd);
}



function handleResizeStart(event) {
    activeHandle = event.target;
    event.stopPropagation();
}

function handleResize(event) {
  if (!activeHandle) return;

  const box = document.querySelector('.selected');
  if (!box) return;

  const canvas = document.getElementById('canvas');
  const rect = canvas.getBoundingClientRect();
  const newX = event.clientX - rect.left;
  const newY = event.clientY - rect.top;
  const activId = parseInt(activeHandle.getAttribute('data-handle-index'));
  const opposId = (activId + 2) % 4;

  let points = box.getAttribute('points').split(' ').map(p => p.split(',').map(Number));
  let angle = parseFloat(box.getAttribute('angle'));
  let newCenter = rotatedRecCenter(points[opposId], [newX, newY]);
  let [newWidth, newHeight] = getWidthHeight(newCenter, points[opposId], [newX, newY], angle);
  let newBox = boxPoints(newCenter, newWidth, newHeight, angle);
  
  // Update the position of the dragged handle
  activeHandle.setAttribute('cx', newX);
  activeHandle.setAttribute('cy', newY);

  points[activId] = [newX, newY];

  // Update the box
  box.setAttribute('points', newBox.map(p => p.join(',')).join(' '));
  box.setAttribute('cx', newCenter[0]);
  box.setAttribute('cy', newCenter[1]);
  box.setAttribute('width', newWidth);
  box.setAttribute('height', newHeight);

  box.classList.add("edited-box");

  // Update handle positions
  updateResizeHandles(box);
}

function handleResizeEnd() {
    activeHandle = null
}

function updateResizeHandles(box) {
    const points = box.getAttribute('points').split(' ').map(p => p.split(',').map(Number));
    const handles = box.parentNode.querySelectorAll('.resize-handle');

    handles.forEach((handle, index) => {
        handle.setAttribute('cx', points[index][0]);
        handle.setAttribute('cy', points[index][1]);
    });
}
