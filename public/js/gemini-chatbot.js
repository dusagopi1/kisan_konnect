// Gemini Chatbot for KisanConnect
document.addEventListener('DOMContentLoaded', function() {
    // Create chatbot UI elements
    createChatbotUI();
    
    // Initialize chatbot functionality
    initChatbot();
});

function createChatbotUI() {
    // Create the chat button that will show in the bottom-right corner
    const chatButton = document.createElement('div');
    chatButton.id = 'chatbot-button';
    chatButton.className = 'fixed bottom-6 right-6 bg-green-600 hover:bg-green-700 text-white rounded-full p-3 shadow-lg cursor-pointer transition-all z-50';
    chatButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
    `;
    document.body.appendChild(chatButton);
    
    // Create the chat panel (initially hidden)
    const chatPanel = document.createElement('div');
    chatPanel.id = 'chatbot-panel';
    chatPanel.className = 'fixed bottom-6 right-6 w-80 h-96 bg-white rounded-lg shadow-xl flex flex-col overflow-hidden z-50 transform scale-0 transition-transform duration-300 origin-bottom-right';
    chatPanel.innerHTML = `
        <div class="bg-green-600 text-white p-3 flex justify-between items-center">
            <div class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                    <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
                <span class="font-semibold">KisanConnect Assistant</span>
            </div>
            <button id="close-chatbot" class="text-white hover:text-green-200">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
            </button>
        </div>
        <div id="chatbot-messages" class="flex-1 p-3 overflow-y-auto space-y-3"></div>
        <div class="border-t border-gray-200 p-3">
            <form id="chatbot-form" class="flex">
                <input type="text" id="chatbot-input" class="flex-1 border border-gray-300 rounded-l-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Type your message...">
                <button type="submit" class="bg-green-600 hover:bg-green-700 text-white rounded-r-lg px-4 py-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </form>
        </div>
    `;
    document.body.appendChild(chatPanel);

    // Add some help messages to guide farmers
    const suggestedQuestions = [
        "What crops are best for this season?",
        "How can I increase my crop yield?",
        "What's the current market price for wheat?",
        "Tips for pest control in rice?",
        "How to use KisanConnect effectively?"
    ];
    
    const welcomeMessages = [
        createBotMessage("👋 Hello! I'm your KisanConnect Assistant. How can I help you today?"),
        createBotMessage("Here are some questions you might ask:")
    ];
    
    const chatMessages = document.getElementById('chatbot-messages');
    welcomeMessages.forEach(msg => chatMessages.appendChild(msg));
    
    const suggestionsList = document.createElement('div');
    suggestionsList.className = 'space-y-2 my-2';
    
    suggestedQuestions.forEach(question => {
        const suggestion = document.createElement('div');
        suggestion.className = 'bg-green-50 text-green-800 p-2 rounded-lg cursor-pointer hover:bg-green-100 text-sm';
        suggestion.textContent = question;
        suggestion.onclick = () => {
            document.getElementById('chatbot-input').value = question;
            // Focus the input after clicking a suggestion
            document.getElementById('chatbot-input').focus();
        };
        suggestionsList.appendChild(suggestion);
    });
    
    chatMessages.appendChild(suggestionsList);
}

function initChatbot() {
    const chatButton = document.getElementById('chatbot-button');
    const chatPanel = document.getElementById('chatbot-panel');
    const closeButton = document.getElementById('close-chatbot');
    const chatForm = document.getElementById('chatbot-form');
    const chatInput = document.getElementById('chatbot-input');
    const chatMessages = document.getElementById('chatbot-messages');

    // Toggle chat panel when the button is clicked
    chatButton.addEventListener('click', () => {
        chatButton.classList.add('scale-0');
        setTimeout(() => {
            chatPanel.classList.remove('scale-0');
            chatPanel.classList.add('scale-100');
        }, 150);
    });

    // Close chat panel
    closeButton.addEventListener('click', () => {
        chatPanel.classList.remove('scale-100');
        chatPanel.classList.add('scale-0');
        setTimeout(() => {
            chatButton.classList.remove('scale-0');
        }, 150);
    });

    // Handle form submission
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        // Add user message to chat
        const userMessageElement = createUserMessage(userMessage);
        chatMessages.appendChild(userMessageElement);
        
        // Clear input
        chatInput.value = '';
        
        // Scroll to bottom of chat
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Add temporary loading message
        const loadingMessage = createBotMessage('Thinking...');
        loadingMessage.classList.add('bot-loading');
        chatMessages.appendChild(loadingMessage);
        
        // Scroll to show loading message
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        try {
            // Send message to Gemini API via our server endpoint
            const response = await fetch('/api/gemini-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: userMessage })
            });
            
            if (!response.ok) {
                throw new Error('Failed to get response from server');
            }
            
            const data = await response.json();
            
            // Remove loading message
            chatMessages.removeChild(loadingMessage);
            
            // Add bot response to chat
            const botResponse = createBotMessage(data.response || 'Sorry, I couldn\'t generate a response.');
            chatMessages.appendChild(botResponse);
            
            // Scroll to bottom again
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
        } catch (error) {
            console.error('Error sending message to Gemini:', error);
            
            // Remove loading message
            chatMessages.removeChild(loadingMessage);
            
            // Add error message
            const errorMessage = createBotMessage('Sorry, there was an error processing your request. Please try again later.');
            chatMessages.appendChild(errorMessage);
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
}

function createUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex justify-end';
    messageDiv.innerHTML = `
        <div class="bg-green-600 text-white rounded-lg px-3 py-2 max-w-xs break-words">
            ${text}
        </div>
    `;
    return messageDiv;
}

function createBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex justify-start';
    
    // Process text for line breaks and links
    const processedText = text
        .replace(/\n/g, '<br>')
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-blue-500 underline">$1</a>');
    
    messageDiv.innerHTML = `
        <div class="bg-gray-200 text-gray-800 rounded-lg px-3 py-2 max-w-xs break-words">
            ${processedText}
        </div>
    `;
    return messageDiv;
}

// Add some additional CSS for the chatbot
const chatbotStyles = document.createElement('style');
chatbotStyles.textContent = `
    #chatbot-messages::-webkit-scrollbar {
        width: 6px;
    }
    #chatbot-messages::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 10px;
    }
    #chatbot-messages::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 10px;
    }
    #chatbot-messages::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
    }
    .bot-loading {
        opacity: 0.6;
    }
`;
document.head.appendChild(chatbotStyles);
