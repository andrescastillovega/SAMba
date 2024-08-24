var points = []
var labels = []

//Load canvas and img
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img_path = document.getElementById('img_path').value;
    console.log(img_path);
    img.src = `../../${img_path}`; // Replace with your image path

    img.onload = function() {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
});

// Function to get the point prompts for SAM
document.getElementById('canvas').addEventListener('click', function(event) {
  // Get the bounding rectangle of the target
  var rect = event.target.getBoundingClientRect();
  var img_width = document.getElementById('img_width').value
  var img_height = document.getElementById('img_height').value

  // Calculate cursor position relative to the image
  var x = (event.clientX - rect.left) / this.width * img_width;
  var y = (event.clientY - rect.top) / this.height * img_height;

  // Log the coordinates or use them for other purposes
  console.log(`Cursor Position: X=${x}, Y=${y}`);
  points.push([x, y]);
  
  if (event.ctrlKey) {
      labels.push(0)
  } else {
      labels.push(1)
  }
});

// Function to draw the SAM masks
function drawPolygon(data) {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    // Start the path
    ctx.beginPath();
    
    // Define the points of the polygon
    const points = data;
    
    // Move to the first point
    ctx.moveTo(points[0][0][0], points[0][0][1]);

    // Draw lines to subsequent points
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0][0], points[i][0][1]);
    }
    
    // Close the path and stroke the shape
    ctx.closePath();
    ctx.stroke();

    // Set stroke color to blue
    ctx.strokeStyle = 'blue';
    ctx.stroke();

    // Set fill color to blue with 50% transparency
    ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
    ctx.fill();
  }
