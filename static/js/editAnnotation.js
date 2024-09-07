let isDragging = false;
let initialX, initialY;

function addMouseListeners(annotation) {
    annotation.addEventListener('mousedown', dragStart);
    annotation.addEventListener('mousemove', drag);
    annotation.addEventListener('mouseup', dragEnd);
    annotation.addEventListener('mouseleave', dragEnd);
}

function removeMouseListeners(annotation) {
    annotation.removeEventListener('mousedown', dragStart);
    annotation.removeEventListener('mousemove', drag);
    annotation.removeEventListener('mouseup', dragEnd);
    annotation.removeEventListener('mouseleave', dragEnd);
}

function dragStart(event) {
    initialX = event.clientX
    initialY = event.clientY
    isDragging = true;
}

function drag(event) {
    if (isDragging) {
      event.preventDefault();
const dX = parseInt(event.clientX - initialX);
      const dY = parseInt(event.clientY - initialY);
      updateAnnotationPoints(event.srcElement, dX, dY);
      removeMaskFill(event.srcElement);
      initialX = event.clientX;
      initialY = event.clientY;
    }
}

function dragEnd() {
    isDragging = false;
}

function updateAnnotationPoints(annotation, dx, dy) {
    const points = annotation.getAttribute("points").split(" ");
    const updatedPoints = points.map(point => {
        const [x, y] = point.split(",");
        return `${parseInt(x) + dx},${parseInt(y) + dy}`;
    });
    annotation.setAttribute("points", updatedPoints.join(" "));

    annotation.classList.add("edited-box");
}

function removeMaskFill(box) {
  //console.log(box.id, typeof box.id, box.id.replace('box','mask'));
  mask = document.getElementById(box.id.replace('box','polygon'));
  mask.setAttribute('fill-opacity', 0);
}

// Function to select an annotation
function selectAnnotation(box) {
  if (editmode) {
    unselectBoxes();

    // Select current box
    box.classList.add("selected", "draggable");
    addMouseListeners(box);
  }
}

// Function to unselect all boxes
function unselectBoxes() {
    var prev_sel = document.getElementsByClassName("selected")[0];
    if (prev_sel !== undefined) {
      prev_sel.classList.remove("selected", "draggable");
      removeMouseListeners(prev_sel);
    }
}

// Function to update all edited annotations in the DB 
function updateAnnotations() {
  var editedBoxes = Array.from(document.getElementsByClassName("edited-box"));

  for (box of editedBoxes) {
    var id_box = box.id.split("-")[1];
    var pointsArray = box.getAttribute('points').trim().split(/\s+/);
    var pointsStringList = "[" + pointsArray.map(point => `[${point}]`).join(", ") + "]";
    
    $.ajax({
	      type : "POST",
	      url : `/update_annotation/${id_box}`,
	      dataType: "json",
	      data: pointsStringList,
	      contentType: 'application/json;charset=UTF-8',
	  });
  }
}


