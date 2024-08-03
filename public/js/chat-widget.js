(function() {
    // Find the placeholder element by its ID
    var chatWidgetPlaceholder = document.getElementById('lamix-chat-widget');

    if (chatWidgetPlaceholder) {
        // Function to load a CSS file dynamically
        function loadCSS(href) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        }

        // Load Bootstrap CSS
        loadCSS('https://cdnjs.cloudflare.com/ajax/libs/mdb-ui-kit/7.3.2/mdb.min.css');
        loadCSS('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css')

        // Create the chat widget container
        var chatContainer = document.createElement('div');
        chatContainer.innerHTML = `
            <style>
                .message-container p {
                    margin-bottom: 0;
                }
                .choice-container {
                    text-wrap: nowrap;
                    overflow: auto;
                    padding: 15px 0px;
                }
                #chatContainer {
                    height: 100%;
                    overflow-y: scroll;
                }
                #chat-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow-x: hidden;
                }
                .card-header, .card-footer {
                    flex-shrink: 0;
                }
                .card-body {
                    flex-grow: 1;
                    overflow-y: hidden;
                    position: relative;
                }
                #messages {
                    padding: 10px;
                    padding-bottom: 100px;
                    border-radius: 5px;
                    z-index: 1;
                }
                .btn-flat-border {
                    display: inline-block;
                    padding: 0.3em 1em;
                    text-decoration: none;
                    color: #742af4;
                    border: solid 2px #b58df9;
                    border-radius: 3px;
                    transition: .4s;
                    margin-right: 5px;
                    margin-left: 5px;
                    font-size: 18px;;
                }
                
                .btn-flat-border:hover {
                    background: #742af4;
                    color: white;
                }
                #chatInput {
                    position: absolute;
                    bottom: 0;
                    width: 100%;
                    right: 0;
                    left: 0;
                    background: white;
                    z-index: 1000;
                    padding: 10px;
                }
                #lamix-chat-widget {
                    width: 100%;
                }
                #chat-widget-container.fixed {
                    position: fixed;
                    bottom: 0;
                    right: 0;
                    width: 300px;
                    max-height: 400px;
                    overflow: hidden;
                    border: 1px solid #ccc;
                    border-radius: 10px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                }
                #chat-widget-container{
                    position:relative;
                    height: 500px;
                    overflow: hidden;
                    border: 1px solid #ccc;
                    border-radius: 10px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    margin: auto;
                }
                #chat-widget-container{
                    margin-bottom:50px;
                }
                #chatInput {
                    position: absolute;
                    bottom: 0;
                    width: 100%;
                    right: 0;
                    left: 0;
                    background: white;
                    z-index: 1000;
                    padding: 10px;
                }
                #sendMessage,
                #chatInput .load {
                    border-left: 0 !important;
                    border-radius: 0px 30px 30px 0px !important;
                    box-shadow: none;
                }
                #userMessage {
                    border-radius: 30px 0px 0px 30px !important;
                    height:50px;
                    background-color: #f5f5f5;
                    font-size: 14px;
                    padding-left: 20px;
                }
                #userMessage:focus {
                    outline: none;
                    box-shadow: none; /* If there is a box shadow applied on focus */
                }
                .intro-thumbnail{
                    border-radius: 150px;
                    margin-bottom: 10px;
                    width: 100px;
                    object-fit: cover;
                    height: 100px;
                    object-position: top;
                }
            </style>
            <div id="chat-widget-container" class="card shadow">
                <div class="d-flex justify-content-between card-header text-center bg-dark text-white">
                    <div id="chat-title">LAMIXチャット</div>
                    <div class="d-flex align-items-center">
                        <div id="reset-chat" style="cursor: pointer;">
                            <i class="fas fa-plus-circle"></i>
                        </div>
                    </div>
                </div>
                <div class="card-body text-center py-0" style="min-height:250px;height: 300px;overflow-y:hidden;">
                    <h5 class="card-title d-none">Card Title</h5>
                    <div id="chatContainer" class="pt-2" style="padding-bottom: 100px !important;"></div>
                    <div id="chatInput" class="input-group rounded-0 rounded-bottom bg-white" style="position: absolute;bottom: 0;left: 0;right: 0;padding: 0px 15px 25px 15px;">
                        <div id="input-container" class="d-flex w-100">
                            <textarea id="userMessage" class="form-control py-3 border-0" placeholder="チャットしよう"></textarea>
                            <button id="sendMessage" class="btn btn-light px-4 border-0"><i class="fas fa-paper-plane"></i></button>
                        </div>
                    </div>
                </div>
                <div class="card-footer text-muted text-center" style="font-size: 12px;">
                        このチャットボットはLAMIXで作成しました。興味のある方は<a href="http://lamix.hatoltd.com/" target="_blank">こちら</a>をクリックしてね。
                </div>
            </div>
        `;

        // Append the chat container to the placeholder element
        chatWidgetPlaceholder.appendChild(chatContainer);

        function loadScript(src, callback) {
            var script = document.createElement('script');
            script.src = src;
            script.onload = callback;
            document.head.appendChild(script);
        }
        // jQuery
        loadScript('https://code.jquery.com/jquery-3.6.0.min.js')
        // Load chat.js script
        loadScript('https://lamix.hatoltd.com/js/chat.js');
        // Load marked.min.js script
        loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js');
        // Load sweetalert2.js script
        loadScript('https://cdn.jsdelivr.net/npm/sweetalert2@11');
        // MDB
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/mdb-ui-kit/7.3.2/mdb.umd.min.js')

    }
})();
