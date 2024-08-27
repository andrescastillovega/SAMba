document.getElementById('imgs_file').addEventListener('change', function(event) {
    const file = event.target.files[0];

    if (file) {
        // Check if the file is a ZIP file
        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (fileExtension !== 'zip') {
            // Show modal
            document.getElementById('modalExt').setAttribute('open','');

            // Clear the input field
            event.target.value = '';  // Reset the file input for further uploads
        }
    }
});

document.getElementById('modalExtButton').addEventListener('click', function(event) {
    // Close modal
    document.getElementById('modalExt').removeAttribute('open');
})

