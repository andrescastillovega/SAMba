var points = []
var labels = []

//Load canvas and img
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('canvas');
  
    project = document.getElementById('project').value
    id_img = document.getElementById('id_img').value

    const img = new Image();
    img_path = document.getElementById('img_path').value;
    img.src = `../../${img_path}`; 

    // Create an SVG image element
    const svgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    svgImage.setAttributeNS(null, 'href', img.src);
    svgImage.setAttribute('x', '0');
    svgImage.setAttribute('y', '0');
    svgImage.setAttribute('width', canvas.getAttribute('width'));
    svgImage.setAttribute('height', canvas.getAttribute('height'));

    // Append the image to the SVG
    canvas.appendChild(svgImage);

    $.ajax({
    type : "GET",
    url : `/get_annotations/${project}/${id_img}`,
    success: function (annotations) {
        // Draw annotations on top of image
        for (annotation of annotations) {
            drawPolygon(annotation);
        }
    },
    error: function(xhr, status, error) {
        var err = eval("(" + xhr.responseText + ")");
        console.log(err.Message);
      }, 
	  });
});

// Function to get the point prompts for SAM
document.getElementById('canvas').addEventListener('click', function(event) {
  // Get the bounding rectangle of the target
  var rect = this.getBoundingClientRect();
  var img_width = document.getElementById('img_width').value
  var img_height = document.getElementById('img_height').value

  // Calculate cursor position relative to the image
  var x = (event.clientX - rect.left) / rect.width * img_width;
  var y = (event.clientY - rect.top) / rect.height * img_height;

  // Log the coordinates or use them for other purposes
  console.log(`Cursor Position: X=${x}, Y=${y}`);
  points.push([x, y]);
  
  if (event.ctrlKey) {
      labels.push(0)
  } else {
      labels.push(1)
  }
});

// Function to draw the SAM masks using SVG
function drawPolygon(data) {
    const svg = document.getElementById('canvas'); // Ensure there's an SVG element with this ID in your HTML

    // Define the points of the polygon from the data
    let polygonString = data["mask"].map(point => point[0].join(',')).join(' ');
    let boxString = data["box"].map(point => point.join(',')).join(' ');

    // Create a new polygon element
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    // polygon.id
    polygon.setAttribute('points', polygonString);
    polygon.classList.add('mask');
    polygon.style.fill = 'rgba(0, 0, 255, 0.5)';
    polygon.style.stroke = 'blue';

    // Create annotation box element
    const box = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    // box.id
    box.setAttribute('points', boxString);
    box.classList.add('box');
    box.style.fill = 'rgba(0, 0, 0, 0)';
    box.style.stroke = 'red';
    
    // Append the polygon to the SVG
    svg.appendChild(polygon);
    svg.appendChild(box);
}


// Function to save the annotation
function saveAnnotation(data) {
    project = document.getElementById('project').value
    id_img = document.getElementById('id_img').value
    $.ajax({
	      type : "POST",
	      url : `/save_annotation/${project}/${id_img}`,
	      dataType: "json",
	      data: JSON.stringify(data),
	      contentType: 'application/json;charset=UTF-8',
	      success: function (data) {
		    }
	  });
}
