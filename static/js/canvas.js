var points = []
var labels = []

var editmode = false

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
    svgImage.id = "img";
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
            drawAnnotation(annotation);
        }
    },
    error: function(xhr, status, error) {
        var err = eval("(" + xhr.responseText + ")");
        console.log(err.Message);
      }, 
	  });

    // Select default class
    def_class = document.getElementById('class').value;
    def_color = document.getElementById(`class-${def_class}`).getAttribute('color');
    document.getElementById(`class-${def_class}`).style.backgroundColor = `${def_color}65`;
    document.getElementById(`class-${def_class}`).style.border = `3px solid ${def_color}`;
});

// Function to draw the SAM masks using SVG
function drawAnnotation(data) {
    const svg = document.getElementById('canvas'); // Ensure there's an SVG element with this ID in your HTML

    // Define the points of the polygon from the data
    let polygonString = data["mask"].map(point => point[0].join(',')).join(' ');
    let boxString = data["box"].map(point => point.join(',')).join(' ');

    // Create a new polygon element
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.id = `polygon-${data['id']}`
    polygon.setAttribute('points', polygonString);
    polygon.classList.add('mask');
    polygon.setAttribute('fill', data["color"] + "65");

    // Create annotation box element
    const box = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    box.id = `box-${data['id']}`
    box.setAttribute('points', boxString);
    box.style.setProperty('--color', data['color']);
    box.classList.add('box');
    box.setAttribute('onclick', 'selectAnnotation(this);');

    // Change style if box is edited
    if (!polygonString) {
      box.classList.add('edited-box');
    }

    // Append the polygon to the SVG
    svg.appendChild(polygon);
    svg.appendChild(box);
}

// Function to save the annotation and trigger the annotation drawing
function saveAnnotation(data) {
    project = document.getElementById('project').value
    id_img = document.getElementById('id_img').value
    class_id = document.getElementById('class').value
    $.ajax({
	      type : "POST",
	      url : `/save_annotation/${project}/${id_img}/${class_id}`,
	      dataType: "json",
	      data: JSON.stringify(data),
	      contentType: 'application/json;charset=UTF-8',
	      success: function (data) {
          drawAnnotation(data);
		    }
	  });
}

// Function to handle clicks on canvas
document.getElementById('canvas').addEventListener('click', function(event) {
  if (editmode) {
      if (event.target.id === 'canvas' || event.target.id === 'img') {
          unselectBoxes();
      } 
  } else {
      getPointPrompt(this);
  }
});

