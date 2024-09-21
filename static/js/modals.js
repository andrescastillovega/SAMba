//Add listeners after DOM loading
document.addEventListener('DOMContentLoaded', function() {
    // Helper function to safely add event listeners
    function addEventListenerIfExists(elementId, eventType, callback) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(eventType, callback);
        }
    }

    // File input change event
    addEventListenerIfExists('imgs_file', 'change', function(event) {
        const file = event.target.files[0];

        if (file) {
            const fileExtension = file.name.split('.').pop().toLowerCase();
            if (fileExtension !== 'zip') {
                const modalExt = document.getElementById('modalExt');
                if (modalExt) {
                    modalExt.setAttribute('open', '');
                }
                event.target.value = ''; // Reset the file input
            }
        }
    });

    // Shortcuts button click event
    addEventListenerIfExists('shortcutsButton', 'click', function(event) {
        const modalShortcuts = document.getElementById('modalShortcuts');
        if (modalShortcuts) {
            modalShortcuts.setAttribute('open', '');
        }
    });

    // Modal extension close button click event
    addEventListenerIfExists('modalExtButton', 'click', function(event) {
        const modalExt = document.getElementById('modalExt');
        if (modalExt) {
            modalExt.removeAttribute('open');
        }
    });

    // Modal shortcuts close button click event
    addEventListenerIfExists('modalShortcutsButton', 'click', function(event) {
        const modalShortcuts = document.getElementById('modalShortcuts');
        if (modalShortcuts) {
            modalShortcuts.removeAttribute('open');
        }
    });
});
