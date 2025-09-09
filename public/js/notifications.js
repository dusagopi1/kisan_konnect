// Notifications System for KisanConnect
// This file contains helper functions for sending, receiving, and displaying notifications

// Function to create a new notification
function createNotification(userId, title, message, type, relatedId = null) {
    return db.collection('notifications').add({
        userId,
        title,
        message,
        type, // 'bid', 'sale', 'chat', 'review', etc.
        relatedId, // productId, chatId, etc.
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// Function to mark a notification as read
function markNotificationAsRead(notificationId) {
    return db.collection('notifications').doc(notificationId).update({
        read: true
    });
}

// Function to mark all notifications as read for a user
function markAllNotificationsAsRead(userId) {
    const batch = db.batch();
    
    return db.collection('notifications')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .get()
        .then(snapshot => {
            snapshot.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });
            return batch.commit();
        });
}

// Function to get unread notification count
function getUnreadNotificationCount(userId) {
    return db.collection('notifications')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .get()
        .then(snapshot => snapshot.size);
}

// Function to get all notifications for a user
function getUserNotifications(userId, limit = 20) {
    return db.collection('notifications')
        .where('userId', '==', userId)
        .get()
        .then(snapshot => {
            const notifications = [];
            snapshot.forEach(doc => {
                notifications.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Sort by createdAt timestamp in descending order client-side
            notifications.sort((a, b) => {
                const timeA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : a.createdAt) : 0;
                const timeB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : b.createdAt) : 0;
                return timeB - timeA;
            });
            
            // Apply limit after sorting
            return notifications.slice(0, limit);
        });
}

// Function to set up real-time notifications listener
function setupNotificationsListener(userId, onNotification) {
    // Using a simpler query to avoid needing composite indexes
    // We'll filter for unread notifications in the client code
    return db.collection('notifications')
        .where('userId', '==', userId)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const notification = {
                        id: change.doc.id,
                        ...change.doc.data()
                    };
                    
                    // Only notify about unread notifications
                    if (notification.read === false) {
                        onNotification(notification);
                    }
                }
            });
        });
}

// Function to render a notification dropdown
function renderNotificationDropdown(container, notifications) {
    // Clear container
    container.innerHTML = '';
    
    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="py-4 px-2 text-center text-gray-500">
                No notifications
            </div>
        `;
        return;
    }
    
    notifications.forEach(notification => {
        const notificationElement = document.createElement('div');
        notificationElement.className = `px-4 py-3 border-b ${notification.read ? 'bg-white' : 'bg-green-50'}`;
        
        // Set icon based on notification type
        let icon = '';
        switch (notification.type) {
            case 'bid':
                icon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5z" /><path d="M8 7a1 1 0 011-1h4a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7z" /><path d="M14 3a1 1 0 011-1h2a1 1 0 011 1v13a1 1 0 01-1 1h-2a1 1 0 01-1-1V3z" /></svg>';
                break;
            case 'sale':
                icon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clip-rule="evenodd" /></svg>';
                break;
            case 'chat':
                icon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" /></svg>';
                break;
            case 'review':
                icon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>';
                break;
            default:
                icon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>';
        }
        
        notificationElement.innerHTML = `
            <div class="flex items-start">
                <div class="flex-shrink-0 mr-3">
                    ${icon}
                </div>
                <div class="flex-grow">
                    <h4 class="text-sm font-medium text-gray-800">${notification.title}</h4>
                    <p class="text-xs text-gray-600">${notification.message}</p>
                    <p class="text-xs text-gray-500 mt-1">${formatNotificationTime(notification.createdAt)}</p>
                </div>
                <div class="flex-shrink-0 ml-2">
                    <button class="text-gray-400 hover:text-gray-600 mark-read-btn" data-id="${notification.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        // Add click event to mark as read
        notificationElement.querySelector('.mark-read-btn').addEventListener('click', event => {
            event.stopPropagation();
            const notificationId = event.currentTarget.getAttribute('data-id');
            markNotificationAsRead(notificationId)
                .then(() => {
                    notificationElement.classList.remove('bg-green-50');
                    notificationElement.classList.add('bg-white');
                });
        });
        
        // Add click event to navigate to related content
        notificationElement.addEventListener('click', () => {
            if (notification.relatedId) {
                navigateToNotificationTarget(notification.type, notification.relatedId);
            }
            
            if (!notification.read) {
                markNotificationAsRead(notification.id);
            }
        });
        
        container.appendChild(notificationElement);
    });
    
    // Add "Mark all as read" button
    const markAllBtn = document.createElement('div');
    markAllBtn.className = 'p-2 text-center';
    markAllBtn.innerHTML = `
        <button class="text-sm text-green-600 hover:text-green-800 font-medium">
            Mark all as read
        </button>
    `;
    
    markAllBtn.querySelector('button').addEventListener('click', () => {
        markAllNotificationsAsRead(currentUser.uid)
            .then(() => {
                // Update UI to show all notifications as read
                const notificationItems = container.querySelectorAll('.bg-green-50');
                notificationItems.forEach(item => {
                    item.classList.remove('bg-green-50');
                    item.classList.add('bg-white');
                });
            });
    });
    
    container.appendChild(markAllBtn);
}

// Helper function to format notification time
function formatNotificationTime(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) {
        return 'Just now';
    } else if (diffMin < 60) {
        return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    } else if (diffHour < 24) {
        return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    } else if (diffDay < 7) {
        return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
}

// Helper function to navigate to the appropriate page based on notification type
function navigateToNotificationTarget(type, targetId) {
    // Get current user type from localStorage if available
    let userType = localStorage.getItem('userType');
    
    // If userType not in localStorage, try to determine from auth
    if (!userType && auth.currentUser) {
        // Make a synchronous check to get user type
        db.collection('users').doc(auth.currentUser.uid).get()
            .then(doc => {
                if (doc.exists) {
                    userType = doc.data().userType;
                    localStorage.setItem('userType', userType); // Cache for future use
                }
                performNavigation(type, targetId, userType);
            })
            .catch(err => {
                console.error('Error getting user type:', err);
                performNavigation(type, targetId, null);
            });
    } else {
        performNavigation(type, targetId, userType);
    }
}

// Helper function to perform the actual navigation
function performNavigation(type, targetId, userType) {
    switch (type) {
        case 'bid':
            if (userType === 'farmer') {
                window.location.href = `product-details.html?id=${targetId}`;
            } else {
                window.location.href = `product-details.html?id=${targetId}`;
            }
            break;
        case 'sale':
            if (userType === 'farmer') {
                window.location.href = `farmer-orders.html`;
            } else {
                window.location.href = `wholesaler-orders.html`;
            }
            break;
        case 'chat':
            window.location.href = `chat.html?id=${targetId}`;
            break;
        case 'review':
            window.location.href = `profile.html?review=${targetId}`;
            break;
        default:
            // If we can't determine the notification type, go to the dashboard
            const dashboardUrl = userType === 'farmer' ? 'farmer-dashboard.html' : 'wholesaler-dashboard.html';
            window.location.href = dashboardUrl;
            break;
    }
}

// Function to send notifications for different events
const NotificationEvents = {
    // Send notification when a new bid is placed
    newBid: (productId, bidAmount, farmerId, wholesalerId, wholesalerName) => {
        return createNotification(
            farmerId, 
            'New Bid Received',
            `${wholesalerName} placed a bid of ₹${bidAmount} on your product.`,
            'bid',
            productId
        );
    },
    
    // Alias for newBid function for backward compatibility
    bidPlaced: (productId, productName, bidAmount, wholesalerId, wholesalerName, farmerId) => {
        return createNotification(
            farmerId, 
            'New Bid Received',
            `${wholesalerName} placed a bid of ₹${bidAmount} on ${productName}.`,
            'bid',
            productId
        );
    },
    
    // Send notification when a bid is accepted
    bidAccepted: (productId, productName, farmerId, farmerName, wholesalerId) => {
        return createNotification(
            wholesalerId,
            'Bid Accepted',
            `${farmerName} accepted your bid for ${productName}.`,
            'sale',
            productId
        );
    },
    
    // Send notification when a new message is received
    newMessage: (productId, chatId, senderId, receiverId, senderName) => {
        return createNotification(
            receiverId,
            'New Message',
            `You have a new message from ${senderName}.`,
            'chat',
            chatId
        );
    },
    
    // Send notification when a new review is received
    newReview: (productId, reviewerId, targetUserId, reviewerName, rating) => {
        return createNotification(
            targetUserId,
            'New Review',
            `${reviewerName} gave you a ${rating}-star review.`,
            'review',
            productId
        );
    },
    
    // Send reminder notification for expiring auctions
    auctionEnding: (productId, productName, farmerId) => {
        return createNotification(
            farmerId,
            'Auction Ending Soon',
            `Your auction for ${productName} is ending soon.`,
            'sale',
            productId
        );
    }
};
