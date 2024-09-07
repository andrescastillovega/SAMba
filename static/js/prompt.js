// Function to get the point prompts for SAM
function getPointPrompt(canvas) {
    // Get the bounding rectangle of the target
    var rect = canvas.getBoundingClientRect();
    var img_width = document.getElementById('img_width').value
    var img_height = document.getElementById('img_height').value

    // Calculate cursor position relative to the image
    var x = (event.clientX - rect.left) / rect.width * img_width;
    var y = (event.clientY - rect.top) / rect.height * img_height;

    // Log the coordinates or use them for other purposes
    points.push([x, y]);
    
    if (event.ctrlKey) {
        labels.push(0);
        drawPointPrompt(event.clientX - rect.left, event.clientY - rect.top, 0);
    } else {
        labels.push(1);
        drawPointPrompt(event.clientX - rect.left, event.clientY - rect.top, 1);
    }
}

// Function to draw the point prompts
function drawPointPrompt(x, y, label) {
  const svg = document.getElementById('canvas');

  // Create a new circle element
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.classList.add('point-prompt');
  circle.setAttribute('cx', x);
  circle.setAttribute('cy', y);
  circle.setAttribute('r', 5);
  circle.style.stroke = 'white';
  circle.style.strokeWidth = '2px';
  if (label == 0) {
    circle.style.fill = 'red';  // Color of the circle
  } else {
    circle.style.fill = 'green';
  }

  // Append the circle to the SVG
  svg.appendChild(circle);
}

// Function to clean all point Prompts
function cleanPointPrompts() {
  var points = Array.from(document.getElementsByClassName('point-prompt'));
  for (point of points) {
    point.remove();
  }
}



