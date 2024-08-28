document.addEventListener('keydown', function(event) {
    if (event.key === 'w') {
        document.getElementById('next-button').click();
    }

    if (event.key === 'q') {
        document.getElementById('prev-button').click();
    }
    
    if (event.key.match(/^[0-9]$/)) {
        var new_class = document.getElementById(`class-${event.key}`).innerText
        document.getElementById('class').value = event.key;
        document.getElementById(`current-class`).innerText = `Current class: ${new_class}` 
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
      console.log(editmode);
    }
});

