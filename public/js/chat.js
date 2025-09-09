// DOM elements
const userNameElement = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const backBtn = document.getElementById('back-btn');
const loadingState = document.getElementById('loading-state');
const chatContainer = document.getElementById('chat-container');
const chatProductName = document.getElementById('chat-product-name');
const chatWith = document.getElementById('chat-with');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sentMessageTemplate = document.getElementById('sent-message-template');
const receivedMessageTemplate = document.getElementById('received-message-template');

// Get product ID from URL (support both id and productId parameters)
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id') || urlParams.get('productId');

// Current user info
let currentUser = null;
let userType = null;
let otherUserId = null;
let otherUserName = null;
let chatId = null;
let unsubscribeMessages = null;

// Check auth state
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        
        // Get user data
        db.collection('users').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    userType = userData.userType;
                    
                    // Display user name
                    userNameElement.textContent = userData.name;
                    
                    // Load product details and chat
                    if (productId) {
                        loadProductAndChatDetails(productId);
                    } else {
                        alert('No product specified');
                        window.location.href = userType === 'farmer' ? 'farmer-dashboard.html' : 'wholesaler-dashboard.html';
                    }
                } else {
                    console.error('User document not found');
                    auth.signOut();
                    window.location.href = 'index.html';
                }
            })
            .catch(err => {
                console.error('Error fetching user data:', err);
                alert('Error fetching user data');
            });
    } else {
        // Not logged in, redirect to login page
        window.location.href = 'index.html';
    }
});

// Logout function
logoutBtn.addEventListener('click', () => {
    // Unsubscribe from messages listener if exists
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }
    
    auth.signOut()
        .then(() => {
            window.location.href = 'index.html';
        })
        .catch(err => {
            console.error('Logout error:', err);
        });
});

// Back button handler
backBtn.addEventListener('click', () => {
    // Unsubscribe from messages listener if exists
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }
    
    window.location.href = userType === 'farmer' ? 'farmer-dashboard.html' : 'wholesaler-dashboard.html';
});

// Load product details and chat setup
function loadProductAndChatDetails(productId) {
    console.log('Loading product details for chat, productId:', productId);
    if (!productId) {
        alert('No product specified. Redirecting to dashboard.');
        window.location.href = userType === 'farmer' ? 'farmer-dashboard.html' : 'wholesaler-dashboard.html';
        return;
    }
    
    db.collection('products').doc(productId).get()
        .then(doc => {
            if (doc.exists) {
                const productData = doc.data();
                
                // Verify this is a sold product
                if (productData.status !== 'sold') {
                    alert('This product is not yet sold. Chat is only available after a sale is complete.');
                    window.location.href = userType === 'farmer' ? 'farmer-dashboard.html' : 'wholesaler-dashboard.html';
                    return;
                }
                
                // Verify user is either the farmer or the winning wholesaler
                if (userType === 'farmer' && productData.farmerId !== currentUser.uid) {
                    alert('You can only chat about your own products.');
                    window.location.href = 'farmer-dashboard.html';
                    return;
                } else if (userType === 'wholesaler' && productData.soldTo !== currentUser.uid) {
                    alert('You can only chat about products you have purchased.');
                    window.location.href = 'wholesaler-dashboard.html';
                    return;
                }
                
                // Set product details in the chat header
                chatProductName.textContent = productData.name;
                
                // Add product details for better context
                const productInfoElement = document.createElement('div');
                productInfoElement.className = 'text-xs text-gray-600 mt-1';
                productInfoElement.innerHTML = `
                    <span class="font-medium">Quantity:</span> ${productData.quantity} ${productData.unit} | 
                    <span class="font-medium">Sold For:</span> ₹${productData.soldAmount || productData.minimumBid} | 
                    <span class="font-medium">Location:</span> ${productData.district}, ${productData.state}
                `;
                
                // Append to chat header if it has a parent
                if (chatProductName.parentNode) {
                    chatProductName.parentNode.appendChild(productInfoElement);
                }
                
                // Determine who the other user is
                if (userType === 'farmer') {
                    otherUserId = productData.soldTo;
                } else {
                    otherUserId = productData.farmerId;
                }
                
                // Get other user's details
                return db.collection('users').doc(otherUserId).get()
                    .then(userDoc => {
                        if (userDoc.exists) {
                            otherUserName = userDoc.data().name;
                            chatWith.textContent = `Chatting with ${otherUserName}`;
                            
                            // Add role information
                            chatWith.innerHTML += ` <span class="text-xs">(${userType === 'farmer' ? 'Wholesaler' : 'Farmer'})</span>`;
                            
                            // Set up chat ID (unique identifier for this conversation)
                            // Format: product_[productId]
                            chatId = `product_${productId}`;
                            
                            // Show chat UI
                            loadingState.classList.add('hidden');
                            chatContainer.classList.remove('hidden');
                            
                            // Load existing messages
                            loadMessages();
                            
                            // Set up message form
                            setupMessageForm();
                            
                            // Auto-focus the message input
                            if (messageInput) {
                                messageInput.focus();
                            }
                        } else {
                            console.error('Other user not found');
                            alert('Error: Could not find the other user');
                        }
                    });
            } else {
                console.error('Product not found');
                alert('Product not found');
                window.location.href = userType === 'farmer' ? 'farmer-dashboard.html' : 'wholesaler-dashboard.html';
            }
        })
        .catch(err => {
            console.error('Error loading product details:', err);
            alert('Error loading product details');
        });
}

// Load existing messages
function loadMessages() {
    // Set up real-time listener for messages
    unsubscribeMessages = db.collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            // Handle initial load and updates
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const message = change.doc.data();
                    displayMessage(message);
                }
            });
            
            // Scroll to bottom after loading messages
            scrollToBottom();
        }, error => {
            console.error('Error loading messages:', error);
        });
}

// Display a message in the UI
function displayMessage(message) {
    const isCurrentUser = message.senderId === currentUser.uid;
    const template = isCurrentUser ? sentMessageTemplate : receivedMessageTemplate;
    
    const messageElement = template.content.cloneNode(true);
    messageElement.querySelector('.message-text').textContent = message.text;
    messageElement.querySelector('.message-time').textContent = formatTime(message.timestamp);
    
    messagesContainer.appendChild(messageElement);
}

// Set up message form
function setupMessageForm() {
    messageForm.addEventListener('submit', e => {
        e.preventDefault();
        
        const messageText = messageInput.value.trim();
        if (!messageText) return;
        
        // Clear input
        messageInput.value = '';
        
        // Create the chats collection and document if it doesn't exist
        db.collection('chats').doc(chatId).set({
            productId: productId,
            participants: [currentUser.uid, otherUserId],
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
        .then(() => {
            // Add message to the subcollection
            return db.collection('chats')
                .doc(chatId)
                .collection('messages')
                .add({
                    text: messageText,
                    senderId: currentUser.uid,
                    senderName: userNameElement.textContent,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
        })
        .then(() => {
            // Update the last message in the chat document
            return db.collection('chats').doc(chatId).update({
                lastMessage: messageText,
                lastMessageSenderId: currentUser.uid,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            // Send notification to other user
            if (typeof NotificationEvents !== 'undefined' && 
                typeof NotificationEvents.newMessage === 'function' && 
                otherUserId) {
                
                return db.collection('users').doc(currentUser.uid).get()
                    .then(userDoc => {
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            return NotificationEvents.newMessage(
                                productId, 
                                chatId, 
                                currentUser.uid, 
                                otherUserId, 
                                userData.name
                            );
                        }
                        return Promise.resolve();
                    });
            }
            return Promise.resolve();
        })
        .catch(err => {
            console.error('Error sending message:', err);
            alert('Error sending message');
        });
    });
}

// Format timestamp to readable time
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    }) + ' | ' + date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short'
    });
}

// Scroll to the bottom of the messages container
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
