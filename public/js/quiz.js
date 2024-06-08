

function appendHeadlineCharacterByCharacter($element, headline, callback) {
    let index = 0;

    const spinner = $(`<div class="spinner-grow spinner-grow-sm text-light" role="status"><span class="visually-hidden">Loading...</span></div>`)
    $element.append(spinner)
    $element.closest(`.message-container`).animate({ opacity: 1 }, 1000, function() { 
        setTimeout(() => {
            spinner.css(`opacity`,0)
            setTimeout(() => {
                let intervalID = setInterval(function() {
                    if (index < headline.length) {
                        $element.append(headline.charAt(index));
                        index++;
                    } else {
                        clearInterval(intervalID);
                        if (callback) callback();
                    }
                }, 50);
            }, 500);
        }, 2000);
    });


}

function clearContentFromEnd($element, callback) {
    $element.html('')
    if (typeof callback === 'function') {
        callback();
    }
    return
    let currentContent = $element.text();

    let clearIntervalID = setInterval(function() {
        if (currentContent.length > 0) {
            currentContent = currentContent.substring(0, currentContent.length - 1);
            $element.text(currentContent);
        } else {
            clearInterval(clearIntervalID);
            if (typeof callback === 'function') {
                callback();
            }
        }
    }, 25); // This duration can be adjusted as per your requirement
}