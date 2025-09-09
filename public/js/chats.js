// DOM elements
const userNameElement = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const dashboardLink = document.getElementById('dashboard-link');
const chatsContainer = document.getElementById('chats-container');
const chatTemplate = document.getElementById('chat-template');
const noChatsHelp = document.getElementById('no-chats-help');
const farmerAction = document.getElementById('farmer-action');
const wholesalerAction = document.getElementById('wholesaler-action');
const noChatsMessage = document.getElementById('no-chats-message');

// Current user info
let currentUser = null;
let userType = null;

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
                    
                    // Set dashboard link based on user type
                    dashboardLink.href = userType === 'farmer' ? 'farmer-dashboard.html' : 'wholesaler-dashboard.html';
                    
                    // Load active chats
                    loadActiveChats(user.uid, userType);
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
    auth.signOut()
        .then(() => {
            window.location.href = 'index.html';
        })
        .catch(err => {
            console.error('Logout error:', err);
        });
});

// Load active chats based on user type
function loadActiveChats(userId, userType) {
    // Clear any loading placeholder
    if (chatsContainer) {
        chatsContainer.innerHTML = '';
    } else {
        console.error('Chats container not found');
        return;
    }
    
    // Query chats based on user type
    const query = userType === 'farmer' 
        ? db.collection('chats').where('farmerId', '==', userId)
        : db.collection('chats').where('wholesalerId', '==', userId);
    
    query.get()
        .then(snapshot => {
            if (snapshot.empty) {
                showNoChatsHelp(userType);
                return;
            }
            
            // Process each chat document
            const chatPromises = snapshot.docs.map(doc => {
                const chatData = doc.data();
                const chatId = doc.id;
                
                // Get other user's info (farmer or wholesaler)
                const otherUserId = userType === 'farmer' ? chatData.wholesalerId : chatData.farmerId;
                
                return db.collection('users').doc(otherUserId).get()
                    .then(userDoc => {
                        if (userDoc.exists) {
                            return {
                                id: chatId,
                                ...chatData,
                                otherUserName: userDoc.data().name,
                                otherUserType: userDoc.data().userType
                            };
                        }
                        return null;
                    })
                    .then(chatWithUser => {
                        if (!chatWithUser) return null;
                        
                        // Get additional product details
                        if (chatWithUser.productId) {
                            return db.collection('products').doc(chatWithUser.productId).get()
                                .then(productDoc => {
                                    if (productDoc.exists) {
                                        const productData = productDoc.data();
                                        return {
                                            ...chatWithUser,
                                            productName: chatWithUser.productName || productData.name,
                                            productLocation: `${productData.district}, ${productData.state}`
                                        };
                                    }
                                    return chatWithUser;
                                });
                        }
                        return chatWithUser;
                    });
            });
            
            // Process all chat promises
            return Promise.all(chatPromises);
        })
        .then(chatsWithUserData => {
            // Filter out any null values
            const validChats = chatsWithUserData ? chatsWithUserData.filter(chat => chat !== null) : [];
            
            if (validChats.length === 0) {
                showNoChatsHelp(userType);
                return;
            }
            
            // Sort chats by last updated time if available
            validChats.sort((a, b) => {
                const timeA = a.lastUpdated ? a.lastUpdated.toDate() : a.createdAt ? a.createdAt.toDate() : new Date(0);
                const timeB = b.lastUpdated ? b.lastUpdated.toDate() : b.createdAt ? b.createdAt.toDate() : new Date(0);
                return timeB - timeA; // Most recent first
            });
            
            // Create and append chat elements
            validChats.forEach(chat => {
                const chatElement = createChatElement(chat, userType);
                chatsContainer.appendChild(chatElement);
            });
            
            // Hide the no chats help section
            noChatsHelp.classList.add('hidden');
        })
        .catch(err => {
            console.error('Error loading chats:', err);
            chatsContainer.innerHTML = `
                <div class="col-span-full flex items-center justify-center h-32">
                    <p class="text-red-500">Error loading chats. Please try again.</p>
                </div>
            `;
        });
}

// Show no chats help based on user type
function showNoChatsHelp(userType) {
    chatsContainer.innerHTML = ''; // Clear the loading message
    noChatsHelp.classList.remove('hidden');
    
    if (userType === 'farmer') {
        farmerAction.classList.remove('hidden');
        wholesalerAction.classList.add('hidden');
        noChatsMessage.textContent = 'You don\'t have any active chats yet.';
    } else {
        farmerAction.classList.add('hidden');
        wholesalerAction.classList.remove('hidden');
        noChatsMessage.textContent = 'You don\'t have any active chats yet.';
    }
}

// Create chat element from template
function createChatElement(chat, userType) {
    if (!chatTemplate) {
        console.error('Chat template not found');
        return document.createElement('div');
    }
    
    const element = chatTemplate.content.cloneNode(true);
    
    // Populate chat data
    element.querySelector('.chat-product-name').textContent = chat.productName || 'Product';
    
    // Set amount
    const amountElement = element.querySelector('.chat-amount');
    amountElement.textContent = `₹${chat.amount}`;
    
    // Set other user name based on user type
    const withText = userType === 'farmer' ? 'Chat with Wholesaler' : 'Chat with Farmer';
    element.querySelector('.chat-with').textContent = `${withText}: ${chat.otherUserName}`;
    
    // Set location if available
    if (chat.productLocation) {
        element.querySelector('.chat-location').textContent = chat.productLocation;
    }
    
    // Set time info
    const timeElement = element.querySelector('.chat-time');
    if (chat.lastUpdated) {
        timeElement.textContent = `Updated ${formatTimeAgo(chat.lastUpdated.toDate())}`;
    } else if (chat.createdAt) {
        timeElement.textContent = `Created ${formatTimeAgo(chat.createdAt.toDate())}`;
    } else {
        timeElement.textContent = 'Recently';
    }
    
    // Set open chat button action
    element.querySelector('.open-chat-btn').addEventListener('click', () => {
        // Extract the product ID from the chat ID if it follows the format product_[productId]
        const productId = chat.productId || chat.id.replace('product_', '');
        window.location.href = `chat.html?id=${productId}`;
    });
    
    return element;
}

// Format time ago
function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) {
        return 'just now';
    } else if (diffMin < 60) {
        return `${diffMin}m ago`;
    } else if (diffHour < 24) {
        return `${diffHour}h ago`;
    } else if (diffDay < 7) {
        return `${diffDay}d ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }
}
