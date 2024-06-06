// quiz.js
const userId = 'user_' + Date.now(); // Generate a unique user ID for the session.

function choosePath(choice) {
    $.ajax({
        url: '/api/data',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ userId, choice }),
        success: function(data) {
            console.log(data)
            $('#storyText').text(data.nextStoryPart); // Update the story text using jQuery
            if (data.endOfStory) {
                promptForEmail();
            }
        },
        error: function(error) {
            console.error('Error:', error);
        }
    });
}

function promptForEmail() {
    Swal.fire({
        title: 'End of Story',
        text: 'Enter your Gmail to receive your story outcome!',
        input: 'email',
        inputLabel: 'Your Gmail',
        inputPlaceholder: 'Enter your email address',
        showCancelButton: true,
        confirmButtonText: 'Submit',
        preConfirm: (email) => {
            return new Promise((resolve, reject) => {
                $.ajax({
                    url: '/api/submit-email',
                    type: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({ email, userId }),
                    success: function(response) {
                        resolve(response);
                    },
                    error: function(error) {
                        reject(error.statusText);
                    }
                });
            })
            .catch(error => {
                Swal.showValidationMessage(
                    `Request failed: ${error}`
                );
            });
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire('Submitted!', 'Your email has been submitted.', 'success');
        }
    });
}
