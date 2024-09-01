document.addEventListener('keydown', function(event) {
    if (event.key === 'w') {
        document.getElementById('next-button').click();
    }

    if (event.key === 'q') {
        document.getElementById('prev-button').click();
    }
    
    if (event.key.match(/^[0-9]$/)) {
        // Unselect previous class
        prev_class = document.getElementById('class').value;
        document.getElementById(`class-${prev_class}`).style.backgroundColor = '';
        document.getElementById(`class-${prev_class}`).style.border = '';

        // Set the new class
        new_color = document.getElementById(`class-${event.key}`).getAttribute('color');
        document.getElementById(`class-${event.key}`).style.backgroundColor = `${new_color}65`;
        document.getElementById(`class-${event.key}`).style.border = `3px solid ${new_color}`;
        document.getElementById('class').value = event.key;
    }

    if (event.key === 'i') {
        project = document.getElementById('project').value
        id_img = document.getElementById('id_img').value
        class_id = document.getElementById('class').value
        $.ajax({
	          type : "POST",
	          url : `/infer/${project}/${id_img}/${class_id}`,
	          dataType: "json",
	          data: JSON.stringify({"points": points, "labels": labels}),
	          contentType: 'application/json;charset=UTF-8',
	          success: function (data) {
		          points.length = 0;
              labels.length = 0;
              cleanPointPrompts();
              saveAnnotation(data);
		        }
	      });
    }
    
    if (event.key === 'c') {
      cleanPointPrompts();
    }

    if (event.key === 'e') {
      editmode = !editmode;
      var img = document.getElementById('img')
      var canvas = document.getElementById('canvas')
      
      const editModeDiv = document.createElement('div');
      editModeDiv.id = "edit-mode-msg";
      editModeDiv.innerHTML = "<h3>Edit Mode - WARNING!</h3>";

      if (editmode) {
        // Add edit-mode msg
        img.style.opacity = 0.3;
        canvas.insertAdjacentElement('beforebegin', editModeDiv)

        // Add edit-mode class
        boxes = document.getElementsByClassName('box');
        for (box of boxes) {
          box.classList.add("edit-mode");
        }
      } else {
        // Remove edit mode msg
        document.getElementById('img').style.opacity = 1.0;
        document.getElementById('edit-mode-msg').remove();

        // Remove edit-mode and selected clases
        boxes = document.getElementsByClassName('box');
        for (box of boxes) {
          box.classList.remove("edit-mode", "selected");
        }

      }
    }
    
    if (event.key === 'd') {
      if (editmode) {
        annotation = document.getElementsByClassName("selected")[0]
        id = annotation.id.split("-")[1]

        // Delete mask
        document.getElementById(`polygon-${id}`).remove();

        // Delete box
        annotation.remove();

        // Delete annotation in db
        $.ajax({
            type : "GET",
            url : `/delete_annotation/${id}`,
            success: function () {
            }
        });
      }
    }
});

