

function appendHeadlineCharacterByCharacter($element, headline, callback) {
    let index = 0;

    let intervalID = setInterval(function() {
        if (index < headline.length) {
            $element.append(headline.charAt(index));
            index++;
        } else {
            clearInterval(intervalID);
            if (callback) callback();
        }
    }, 50);
}

function clearContentFromEnd($element, callback) {
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