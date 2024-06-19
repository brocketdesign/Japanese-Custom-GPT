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
        loadCSS('https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css');

        // Create the chat widget container
        var chatContainer = document.createElement('div');
        chatContainer.innerHTML = `
            <style>
                .choice-container {
                    text-wrap: nowrap;
                    overflow: auto;
                    padding: 15px 0px;
                }
                #chat-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .card-header, .card-footer {
                    flex-shrink: 0;
                }
                .card-body {
                    flex-grow: 1;
                    overflow-y: auto;
                    position: relative;
                }
                #messages {
                    padding: 10px;
                    padding-bottom: 100px;
                    border-radius: 5px;
                    z-index: 1;
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
                    border-top: 1px solid #ccc;
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
                    position:initial;
                    height: 750px;
                    overflow: hidden;
                    border: 1px solid #ccc;
                    border-radius: 10px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    margin: auto;
                }
                #chat-widget-container{
                    margin-bottom:50px;
                }
            </style>
            <div id="chat-widget-container" class="card">
                <div class="d-flex justify-content-between card-header text-center bg-dark text-white">
                    <div>LAMIXチャット</div>
                    <div class="d-flex align-items-center">
                        <div class="count me-2"></div><i class="fas fa-comment"></i>
                    </div>
                </div>
                <div class="card-body text-center py-5 shadow" style="min-height:250px;height: 300px;overflow-y: auto;">
                    <h5 class="card-title d-none">Card Title</h5>
                    <div id="chatContainer" class="pb-5">
                    </div>
                    <div id="chatInput" class="input-group rounded-0 rounded-bottom bg-white" style="position: absolute;bottom: 0;left: 0;right: 0;padding: 0px 15px 25px 15px;">
                        <input type="text" id="userMessage" class="form-control py-3 border" placeholder="メッセージを入力してください">
                        <button id="sendMessage" class="btn btn-light px-4 border"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
                <div class="card-footer text-muted text-center d-none">
                    フッターコンテンツ
                </div>
            </div>
        `;

        // Append the chat container to the placeholder element
        chatWidgetPlaceholder.appendChild(chatContainer);

        // Load any additional scripts required for the chat functionality
        var script = document.createElement('script');
        script.src = 'https://lamix.hatoltd.com/js/chat.js'; // Adjust the path as necessary
        document.head.appendChild(script);
    }
})();
