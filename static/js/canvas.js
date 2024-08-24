var points = []
var labels = []

// Function to get the point prompts for SAM
document.getElementById('image').addEventListener('click', function(event) {
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

