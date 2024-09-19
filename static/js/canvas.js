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
    let boxCoords = boxPoints([data['cx'], data['cy']],
                              data['width'],
                              data['height'],
                              data['angle']);
    let boxString = boxCoords.map(point => point.join(',')).join(' ');

    // Create a new polygon element
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.id = `polygon-${data['id']}`
    polygon.setAttribute('points', polygonString);
    polygon.classList.add('mask');
    polygon.setAttribute('fill', data["color"] + "65");
    polygon.setAttribute('onclick', 'selectMask(this);');

    // Create annotation box element
    const box = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    box.id = `box-${data['id']}`
    box.setAttribute('points', boxString);
    box.setAttribute('cx', data["cx"]); 
    box.setAttribute('cy', data["cy"]);
    box.setAttribute('height', data['height']);
    box.setAttribute('width', data['width']);
    box.setAttribute('angle', data['angle']);
    box.style.setProperty('--color', data['color']);
    box.classList.add('box');
    box.setAttribute('onclick', 'selectBox(this);');
    

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

// Function to get the corners coordinates of an oriented box
function boxPoints(center, width, height, angle) {
    const [cx, cy] = center;
    const angleRad = angle * Math.PI / 180;

    // Half-widths
    const wHalf = width / 2;
    const hHalf = height / 2;

    // Pre-compute sine and cosine of the rotation angle
    const cosTheta = Math.cos(angleRad);
    const sinTheta = Math.sin(angleRad);

    // Calculate the four corners
    const corners = [
        [-wHalf, -hHalf],
        [wHalf, -hHalf],
        [wHalf, hHalf],
        [-wHalf, hHalf]
    ];

    // Rotate each corner and add the center offset
    const rotatedCorners = corners.map(([x, y]) => [
        cx + (x * cosTheta - y * sinTheta),
        cy + (x * sinTheta + y * cosTheta)
    ]);

    return rotatedCorners;
}

// Function to get some attributes from a box
function getBoxAtt(box) {
  let centerX = parseFloat(box.getAttribute('cx'));
  let centerY = parseFloat(box.getAttribute('cy'));
  let width = parseFloat(box.getAttribute('width'));
  let height = parseFloat(box.getAttribute('height'));
  let angle = parseFloat(box.getAttribute('angle'));
  return {'center': [centerX, centerY], 'width': width, 'height': height, 'angle': angle}
}

// Function to rotate a point around a center
function rotatePoint(point, center, angleDegrees) {
    const [x, y] = point;
    const [centerX, centerY] = center;
    const angleRadians = angleDegrees * Math.PI / 180;
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);
    
    const translatedX = x - centerX;
    const translatedY = y - centerY;
    
    const rotatedX = translatedX * cos - translatedY * sin;
    const rotatedY = translatedX * sin + translatedY * cos;
    
    return [rotatedX + centerX, rotatedY + centerY];
}

// Function to calculate the center of a rectangle given two opposite corners
function rotatedRecCenter(cornerA, cornerB) {
  const [xa, ya] = cornerA;
  const [xb, yb] = cornerB;

  centerX = (xa + xb) / 2;
  centerY = (ya + yb) / 2;

  return [centerX, centerY]
}

// Function to calculate the width and height of a rotated rectangle
// NOTE: it rotates back the rectangule to calculate height and width
function getWidthHeight(center, cornerA, cornerB, angle) {
  let [rotCornerAx, rotCornerAy] = rotatePoint(cornerA, center, -angle);
  let [rotCornerBx, rotCornerBy] = rotatePoint(cornerB, center, -angle);

  const width = Math.abs(rotCornerAx - rotCornerBx);
  const height = Math.abs(rotCornerAy - rotCornerBy);

  return [width, height];
}
