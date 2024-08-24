document.addEventListener('keydown', function(event) {
    if (event.key === 'w') {
        document.getElementById('next-button').click();
    }

    if (event.key === 'q') {
        document.getElementById('prev-button').click();
    }
    
    if (event.key.match(/^[0-9]$/)) {
        document.getElementById('veh-class').value = event.key;
    }

    if (event.key === 'i') {
        project = document.getElementById('project').value
        id_img = document.getElementById('id_img').value
        $.ajax({
	          type : "POST",
	          url : `/infer/${project}/${id_img}`,
	          dataType: "json",
	          data: JSON.stringify({"points": points, "labels": labels}),
	          contentType: 'application/json;charset=UTF-8',
	          success: function (data) {
		          points.length = 0;
              labels.length = 0;
		        }
	      });
    }
});

