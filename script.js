$(document).ready(function() {
    init();

    function init() {
        $('#step1').addClass('active');
        setupEventHandlers();
        toggleNextButton();
    }

    function setupEventHandlers() {
        $('#nextStep1').click(handleNextStep1);
        $('#nextStep2').click(handleNextStep2);
        $('#prevStep2').click(() => goToStep(1));
        $('#prevStep3').click(() => goToStep(2));

        $('#fileMock').click(() => $('#file').click());
        $('#file').change(handleFileSelection);
        $('#urlMock').click(showUrlInput);
        $('#imageUrl').on('input', toggleNextButton);

        $('#toggleTheme').click(toggleTheme);
        $('#toggleContrast').click(toggleContrast);

        $('#responseFormat').change(handleResponseFormatChange);

        $('#submit').click(infer);

        $('#submitAnother').click(resetFormAndGoToStep1);
        $('#adjustSettings').click(() => goToStep(2));
        $('#downloadResults').click(downloadResults);

        $('#adjustConfidence').on('input', updateConfidence);
        $('#adjustOverlap').on('input', updateOverlap);

        $('#copyJsonButton').click(() => {
            copyJsonToClipboard();
            showCopyNotification();  // Exibe a notificação ao copiar
        });
    }

    function handleNextStep1() {
        if (isFileOrUrlSelected()) {
            goToStep(2);
        } else {
            showError("Please select a file or enter a URL before proceeding.");
        }
    }

    function handleNextStep2() {
        goToStep(3);
    }

    function toggleNextButton() {
        if (isFileOrUrlSelected()) {
            $('#nextStep1').prop('disabled', false);
        } else {
            $('#nextStep1').prop('disabled', true);
        }
    }

    function isFileOrUrlSelected() {
        return $('#file').get(0).files.length > 0 || $('#imageUrl').val() !== '';
    }

    function handleFileSelection() {
        if ($('#file').get(0).files.length > 0) {
            $('#urlContainer').hide();
            $('#imageUrl').val('');
        }
        toggleNextButton();
        resetProgressBar();
    }

    function showUrlInput() {
        $('#urlContainer').show();
        $('#file').val('');
        toggleNextButton();
        resetProgressBar();
    }

    function goToStep(stepNumber) {
        $('.step').removeClass('active');
        $('#step' + stepNumber).addClass('active');
        handleStepVisibility(stepNumber);
        if (stepNumber === 1) {
            $('#urlContainer').show();
        }
    }

    function handleStepVisibility(stepNumber) {
        const isFinalStep = stepNumber === 3;
        $('#postSubmitActions, #resultAdjustments').toggleClass('hidden', !isFinalStep);
    }

    function handleResponseFormatChange() {
        $('#copyJsonButton').addClass('hidden').hide(); // Esconde o botão ao mudar o formato
    }    

    function resetFormAndGoToStep1() {
        resetForm();
        goToStep(1);
    }

    function resetForm() {
        $('#file').val('');
        $('#imageUrl').val('');
        $('#confidence').val(50);
        $('#overlap').val(50);
        $('#output').html('');
        $('#copyJsonButton').addClass('hidden').hide();
        toggleNextButton();
        resetProgressBar();
    }

    function resetProgressBar() {
        $('#progressBarFill').css('width', '0%');
        $('#progressText').text('');
        $('#progressContainer').addClass('hidden');
    }

    function toggleTheme() {
        $('body').toggleClass('dark-mode').removeClass('high-contrast');
    }

    function toggleContrast() {
        $('body').toggleClass('high-contrast').removeClass('dark-mode');
    }

    function infer() {
        if (!isFileOrUrlSelected()) {
            showError("Please select a file or enter a URL.");
            return;
        }

        resetOutput();
        updateProgress(0, "Starting process...");

        const file = $('#file').get(0).files[0];
        const url = $('#imageUrl').val();

        if (file) {
            processFile(file);
        } else if (url) {
            processUrl(url);
        }
    }

    function resetOutput() {
        $('#output').removeClass('json-output').html('');
        $("#resultContainer, #progressContainer").removeClass('hidden');
        $('#copyJsonButton').addClass('hidden').hide();
    }

    function processFile(file) {
        updateProgress(20, "Reading file...");
        getBase64fromFile(file).then(base64image => processImage(base64image));
    }

    function processUrl(url) {
        updateProgress(20, "Fetching image from URL...");
        processImage(null, url);
    }

    function processImage(base64image, url = '') {
        updateProgress(40, "Processing image...");
        const settings = getRequestSettings(base64image, url);

        $.ajax(settings).then(handleResponse).fail(() => showError("Error loading response. Check your settings and try again."));
    }

    function getRequestSettings(base64image, url) {
        const responseFormat = $('#responseFormat').val();
        const settings = {
            method: "POST",
            url: buildRequestUrl(responseFormat, url),
            data: base64image || null,
            xhr: responseFormat === "image" ? createXhrForImage : undefined
        };
        return settings;
    }

    function buildRequestUrl(responseFormat, url) {
        let requestUrl = `https://detect.roboflow.com/vways-detec/2?api_key=Mo619V8ueyJuR68Ua7Ud&format=${responseFormat}`;
        requestUrl += `&confidence=${encodeURIComponent($('#confidence').val())}`;
        requestUrl += `&overlap=${encodeURIComponent($('#overlap').val())}`;
        requestUrl += `&labels=${encodeURIComponent($('#labels').val())}`;
        requestUrl += `&stroke=${encodeURIComponent($('#stroke').val())}`;
        if (url) {
            requestUrl += `&image=${encodeURIComponent(url)}`;
        }
        return requestUrl;
    }

    function createXhrForImage() {
        const xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';
        return xhr;
    }

    function handleResponse(response) {
        updateProgress(80, "Processing response...");
        displayResponse(response);
        updateProgress(100, "Process complete.");
        $('#postSubmitActions').removeClass('hidden');
    
        // Exibe o botão de copiar JSON somente após o envio e se o formato for JSON
        const responseFormat = $('#responseFormat').val();
        if (responseFormat === "json") {
            $('#copyJsonButton').removeClass('hidden').show();
        }
    }    

    function displayResponse(response) {
        const responseFormat = $('#responseFormat').val();
        $('#output').html('');
        $('#copyJsonButton').addClass('hidden').hide();

        if (responseFormat === "json") {
            const formattedJson = syntaxHighlight(response);
            $('#output').addClass('json-output').append('<pre>' + formattedJson + '</pre>');
            $('#downloadResults').data('content', JSON.stringify(response, null, 4)).data('type', 'json');
            $('#copyJsonButton').removeClass('hidden').show();
        } else {
            displayImageResponse(response);
        }
    }

    function displayImageResponse(response) {
        const blob = new Blob([new Uint8Array(response)], { type: 'image/png' });
        const imageUrl = URL.createObjectURL(blob);

        const img = $('<img/>').attr('src', imageUrl).on('load', () => $('html').scrollTop(100000));
        $('#output').append(img);
        $('#downloadResults').data('content', blob).data('type', 'png');
    }

    function updateConfidence() {
        $('#confidenceValue').text($(this).val() + '%');
        updateResultSettings('confidence', $(this).val());
    }

    function updateOverlap() {
        $('#overlapValue').text($(this).val() + '%');
        updateResultSettings('overlap', $(this).val());
    }

    function updateProgress(percentage, text) {
        $('#progressBarFill').css('width', percentage + '%');
        $('#progressText').text(text);
    }

    function updateResultSettings(setting, value) {
        $('#' + setting).val(value);
        infer();
    }

    function downloadResults() {
        const type = $('#downloadResults').data('type');
        const content = $('#downloadResults').data('content');
        const link = document.createElement('a');
        if (type === 'json') {
            link.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
            link.download = `result.json`;
        } else if (type === 'png') {
            link.href = URL.createObjectURL(content);
            link.download = `result.png`;
        }
        link.click();
    }

    function getBase64fromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
        });
    }

    function syntaxHighlight(json) {
        if (typeof json != 'string') {
            json = JSON.stringify(json, undefined, 4);  // Usando espaçamento de 4 para melhor indentação
        }
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            let cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    function copyJsonToClipboard() {
        const jsonContent = $('#output').text();
        const tempInput = $('<textarea>');
        $('body').append(tempInput);
        tempInput.val(jsonContent).select();
        document.execCommand('copy');
        tempInput.remove();
    }

    function showCopyNotification() {
        const notification = $('#copyNotification');
        notification.removeClass('hide').addClass('show');

        setTimeout(() => {
            notification.removeClass('show').addClass('hide');
        }, 3000); // Exibe por 2 segundos
    }

    function showError(message) {
        $('#errorMessage').text(message).show();
    }
});
