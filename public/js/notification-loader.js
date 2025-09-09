// Notification Loader Script for KisanConnect
// This file loads notification components and initializes the notification system

document.addEventListener('DOMContentLoaded', () => {
    // Check if notification bell container exists
    const notificationBellContainer = document.getElementById('notification-bell-container');
    if (!notificationBellContainer) return;
    
    // Function to load notification bell HTML
    function loadNotificationBell() {
        fetch('./components/notification-bell.html')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text();
            })
            .then(html => {
                notificationBellContainer.innerHTML = html;
                
                // Initialize notification bell functionality once loaded
                initializeNotificationBell();
            })
            .catch(error => {
                console.error('Error loading notification bell component:', error);
                
                // Provide fallback HTML directly when fetch fails
                const fallbackHTML = `
                <div class="relative">
                    <button id="notification-bell" class="relative p-1 rounded-full hover:bg-green-800 focus:outline-none">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <span id="notification-count" class="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full hidden">0</span>
                    </button>
                    
                    <div id="notification-dropdown" class="hidden absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-20">
                        <div class="py-2">
                            <div class="px-4 py-2 border-b">
                                <div class="flex justify-between items-center">
                                    <h3 class="text-sm font-bold text-gray-800">Notifications</h3>
                                    <a href="#" id="view-all-notifications" class="text-xs text-green-600 hover:text-green-800">View All</a>
                                </div>
                            </div>
                            <div id="notifications-container" class="max-h-80 overflow-y-auto">
                                <!-- Notifications will be loaded here -->
                                <div class="py-4 px-2 text-center text-gray-500">
                                    Loading notifications...
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                `;
                
                notificationBellContainer.innerHTML = fallbackHTML;
                initializeNotificationBell();
            });
    }
    
    // Function to initialize notification bell functionality
    function initializeNotificationBell() {
        const notificationBell = document.getElementById('notification-bell');
        const notificationDropdown = document.getElementById('notification-dropdown');
        const notificationCount = document.getElementById('notification-count');
        const notificationsContainer = document.getElementById('notifications-container');
        
        if (!notificationBell || !notificationDropdown || !notificationCount || !notificationsContainer) {
            console.error('Notification elements not found');
            return;
        }
        
        // Check if user is authenticated
        auth.onAuthStateChanged(user => {
            if (user) {
                // Check if notification functions exist
                if (typeof getUnreadNotificationCount === 'function') {
                    // Get unread notification count
                    getUnreadNotificationCount(user.uid)
                        .then(count => {
                            if (count > 0) {
                                notificationCount.textContent = count > 9 ? '9+' : count;
                                notificationCount.classList.remove('hidden');
                            } else {
                                notificationCount.classList.add('hidden');
                            }
                        })
                        .catch(error => {
                            console.error('Error getting notification count:', error);
                            notificationCount.classList.add('hidden');
                        });
                } else {
                    // Notification functions not loaded yet
                    console.warn('Notification functions not available');
                    notificationCount.classList.add('hidden');
                }
                
                // Set up notification click handler
                notificationBell.addEventListener('click', () => {
                    notificationDropdown.classList.toggle('hidden');
                    
                    // Load notifications when dropdown is opened
                    if (!notificationDropdown.classList.contains('hidden')) {
                        // Show loading state
                        notificationsContainer.innerHTML = '<div class="py-4 px-2 text-center text-gray-500">Loading notifications...</div>';
                        
                        // Load notifications
                        getUserNotifications(user.uid)
                            .then(notifications => {
                                renderNotificationDropdown(notificationsContainer, notifications);
                            })
                            .catch(error => {
                                console.error('Error loading notifications:', error);
                                notificationsContainer.innerHTML = '<div class="py-4 px-2 text-center text-red-500">Error loading notifications</div>';
                            });
                    }
                });
                
                // Close dropdown when clicking outside
                document.addEventListener('click', event => {
                    if (!notificationBell.contains(event.target) && !notificationDropdown.contains(event.target)) {
                        notificationDropdown.classList.add('hidden');
                    }
                });
                
                // Set up real-time notification updates
                setupNotificationsListener(user.uid, notification => {
                    // Update notification count
                    getUnreadNotificationCount(user.uid)
                        .then(count => {
                            if (count > 0) {
                                notificationCount.textContent = count > 9 ? '9+' : count;
                                notificationCount.classList.remove('hidden');
                            } else {
                                notificationCount.classList.add('hidden');
                            }
                        });
                    
                    // Show notification toast if dropdown is closed
                    if (notificationDropdown.classList.contains('hidden')) {
                        showNotificationToast(notification);
                    }
                });
            }
        });
    }
    
    // Function to show a notification toast
    function showNotificationToast(notification) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-white rounded-lg shadow-lg max-w-sm w-full z-50 transform transition-transform duration-300 ease-in-out translate-x-full';
        toast.innerHTML = `
            <div class="p-4">
                <div class="flex items-start">
                    <div class="flex-shrink-0 pt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                    </div>
                    <div class="ml-3 w-0 flex-1">
                        <p class="text-sm font-medium text-gray-900">${notification.title}</p>
                        <p class="mt-1 text-sm text-gray-500">${notification.message}</p>
                    </div>
                    <div class="ml-4 flex-shrink-0 flex">
                        <button class="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none">
                            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add to document
        document.body.appendChild(toast);
        
        // Add click event to close button
        toast.querySelector('button').addEventListener('click', () => {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                toast.remove();
            }, 300);
        });
        
        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 5000);
    }
    
    // Load notification bell
    loadNotificationBell();
});
