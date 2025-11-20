// init.js
// Final initialization. Keep lightweight, run after other modules.

$(document).ready(function () {
    // Nav persona filter behavior
    $('.nav-link').on('click', function (e) {
        e.preventDefault();
        $('.nav-link').removeClass('active');
        $(this).addClass('active');

        if ($(this).text().trim() === 'ペルソナ') {
            $('.custom-card').hide();
            $('.custom-card .persona.on').closest('.custom-card').show();
        } else {
            $('.custom-card').show();
        }
    });
});
