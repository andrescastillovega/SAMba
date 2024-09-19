let editmode = false;

function toggleEditMode() {
    editmode = !editmode;
    const img = document.getElementById('img');
    const canvas = document.getElementById('canvas');
    
    const editModeDiv = document.createElement('div');
    editModeDiv.id = "edit-mode-msg";
    editModeDiv.innerHTML = "<h3>Edit Mode - WARNING!</h3>";

    if (editmode) {
        img.style.opacity = 0.3;
        canvas.insertAdjacentElement('beforebegin', editModeDiv);
        enableEditModeForBoxes();
    } else {
        img.style.opacity = 1.0;
        document.getElementById('edit-mode-msg').remove();
        disableEditModeForBoxes();
        updateAllEditedAnnotations();
    }
}

function enableEditModeForBoxes() {
    const boxes = document.getElementsByClassName('box');
    for (let box of boxes) {
        box.classList.add("edit-mode");
    }
}

function disableEditModeForBoxes() {
    const boxes = document.getElementsByClassName('box');
    for (let box of boxes) {
        box.classList.remove("edit-mode", "selected", "draggable", "edited");
        removeDragListeners(box);
        removeResizeHandles(box);
        removeRotationHandle(box);
    }
}

function selectMask(mask) {
    if (editmode) {
        unselectBoxes();

        let boxId = mask.id.replace("polygon", "box");
        let box = document.getElementById(boxId);

        box.classList.add("selected", "draggable");
        addDragListeners(box);
        addResizeHandles(box);
        addRotationHandle(box);
    }
}

function selectBox(box) {
    if (editmode) {
        unselectBoxes();
        box.classList.add("selected", "draggable");
        addDragListeners(box);
        addResizeHandles(box);
        addRotationHandle(box);
    }
}

function unselectBoxes() {
    const prevSelected = document.getElementsByClassName("selected")[0];
    if (prevSelected) {
        prevSelected.classList.remove("selected", "draggable");
        removeDragListeners(prevSelected);
        removeResizeHandles(prevSelected);
        removeRotationHandle(prevSelected);
    }
}

function updateAllEditedAnnotations() {
    const editedBoxes = Array.from(document.getElementsByClassName("edited-box"));
    for (let box of editedBoxes) {
        updateAnnotationInDB(box);
    }
}

function updateAnnotationInDB(box) {
    const idBox = box.id.split("-")[1];
    const boxAtt = getBoxAtt(box);
    
    $.ajax({
        type: "POST",
        url: `/update_annotation/${idBox}`,
        dataType: "json",
        data: JSON.stringify(boxAtt),
        contentType: 'application/json;charset=UTF-8',
    });
}

function deleteSelectedAnnotation() {
    if (editmode) {
        const selectedAnnotation = document.getElementsByClassName("selected")[0];
      
        removeResizeHandles(selectedAnnotation);
        removeRotationHandle(selectedAnnotation);       
        
        if (selectedAnnotation) {
            const id = selectedAnnotation.id.split("-")[1];
            document.getElementById(`polygon-${id}`).remove();
            selectedAnnotation.remove();
            $.ajax({
                type: "GET",
                url: `/delete_annotation/${id}`,
            });
        }

        
    }
}
