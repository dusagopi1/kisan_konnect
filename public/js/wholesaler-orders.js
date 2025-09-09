// DOM elements
const userNameElement = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const ordersContainer = document.getElementById('orders-container');
const emptyState = document.getElementById('empty-state');
const allOrdersTab = document.getElementById('all-orders-tab');
const completedOrdersTab = document.getElementById('completed-orders-tab');
const orderTemplate = document.getElementById('order-template');

// Current filter
let currentFilter = 'all'; // 'all' or 'completed'

// Check auth state
auth.onAuthStateChanged(user => {
    if (user) {
        // Get user data
        db.collection('users').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    // Verify this is a wholesaler account
                    if (userData.userType !== 'wholesaler') {
                        window.location.href = 'index.html';
                        return;
                    }
                    
                    // Display user name
                    userNameElement.textContent = userData.name;
                    
                    // Load orders
                    loadOrders(user.uid);
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

// Tab button event listeners
allOrdersTab.addEventListener('click', () => {
    setActiveTab('all');
});

completedOrdersTab.addEventListener('click', () => {
    setActiveTab('completed');
});

// Set active tab and update display
function setActiveTab(tabName) {
    // Update current filter
    currentFilter = tabName;
    
    // Update tab styles
    allOrdersTab.classList.toggle('text-green-700', tabName === 'all');
    allOrdersTab.classList.toggle('border-green-500', tabName === 'all');
    allOrdersTab.classList.toggle('text-gray-500', tabName !== 'all');
    allOrdersTab.classList.toggle('border-transparent', tabName !== 'all');
    
    completedOrdersTab.classList.toggle('text-green-700', tabName === 'completed');
    completedOrdersTab.classList.toggle('border-green-500', tabName === 'completed');
    completedOrdersTab.classList.toggle('text-gray-500', tabName !== 'completed');
    completedOrdersTab.classList.toggle('border-transparent', tabName !== 'completed');
    
    // Reload orders with the new filter
    const userId = auth.currentUser?.uid;
    if (userId) {
        loadOrders(userId);
    }
}

// Load wholesaler's orders (purchased products + placed bids)
function loadOrders(wholesalerId) {
    // Clear container and show loading indicator
    ordersContainer.innerHTML = `
        <tr>
            <td colspan="5" class="px-6 py-4">
                <div class="flex justify-center">
                    <svg class="animate-spin h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            </td>
        </tr>
    `;
    
    // We'll need to gather data from both products and bids
    const allOrderItems = [];
    
    // First, query for products purchased by this wholesaler
    db.collection('products')
        .where('soldTo', '==', wholesalerId)
        .get()
        .then(snapshot => {
            snapshot.forEach(doc => {
                const product = {
                    id: doc.id,
                    ...doc.data(),
                    orderType: 'purchase' // Mark as completed purchase
                };
                allOrderItems.push(product);
            });
            
            // Then, query for bids placed by this wholesaler
            return db.collection('bids')
                .where('wholesalerId', '==', wholesalerId)
                .get();
        })
        .then(snapshot => {
            // Process bids and get product info for each bid
            const bidPromises = [];
            
            snapshot.forEach(doc => {
                const bid = {
                    id: doc.id,
                    ...doc.data()
                };
                
                // Only add bids with status 'pending' if we're on the 'all' tab
                if (bid.status === 'pending' && currentFilter !== 'completed') {
                    // Get product info for this bid
                    const productPromise = db.collection('products').doc(bid.productId).get()
                        .then(productDoc => {
                            if (productDoc.exists) {
                                const productData = productDoc.data();
                                return {
                                    id: bid.productId,
                                    ...productData,
                                    orderType: 'bid', // Mark as pending bid
                                    bidAmount: bid.amount,
                                    bidId: bid.id,
                                    bidStatus: bid.status,
                                    bidCreatedAt: bid.createdAt
                                };
                            }
                            return null;
                        });
                    bidPromises.push(productPromise);
                }
            });
            
            return Promise.all(bidPromises);
        })
        .then(bidProducts => {
            // Filter out any null values and add valid bid products to our order items
            bidProducts.filter(item => item !== null).forEach(product => {
                // Only add if product status is not 'sold' (avoid duplicates with purchases)
                if (product.status !== 'sold') {
                    allOrderItems.push(product);
                }
            });
            
            // Filter based on current tab
            const filteredOrders = allOrderItems.filter(item => {
                if (currentFilter === 'completed') {
                    return item.status === 'completed' || item.status === 'sold';
                }
                return true;
            });
            
            if (filteredOrders.length === 0) {
                showEmptyState();
                return;
            }
            
            emptyState.classList.add('hidden');
            ordersContainer.innerHTML = '';
            
            // Fetch seller details for each product
            const promises = filteredOrders.map(product => {
                return db.collection('users').doc(product.farmerId).get()
                    .then(userDoc => {
                        if (userDoc.exists) {
                            const sellerData = userDoc.data();
                            return {
                                product,
                                seller: sellerData
                            };
                        }
                        return {
                            product,
                            seller: { name: 'Unknown Seller', phoneNumber: 'N/A' }
                        };
                    })
                    .catch(err => {
                        console.error('Error fetching seller data:', err);
                        return {
                            product,
                            seller: { name: 'Unknown Seller', phoneNumber: 'N/A' }
                        };
                    });
            });
            
            // Process all orders
            Promise.all(promises)
                .then(results => {
                    // Sort by newest first
                    results.sort((a, b) => {
                        const dateA = a.product.bidCreatedAt?.toDate() || a.product.soldAt?.toDate() || a.product.createdAt?.toDate() || new Date(0);
                        const dateB = b.product.bidCreatedAt?.toDate() || b.product.soldAt?.toDate() || b.product.createdAt?.toDate() || new Date(0);
                        return dateB - dateA; // newest first
                    });
                    
                    results.forEach(result => {
                        const orderElement = createOrderElement(result.product, result.seller);
                        ordersContainer.appendChild(orderElement);
                    });
                })
                .catch(err => {
                    console.error('Error processing orders:', err);
                    ordersContainer.innerHTML = `
                        <tr>
                            <td colspan="5" class="px-6 py-4 text-center text-red-500">
                                Error loading orders. Please try again.
                            </td>
                        </tr>
                    `;
                });
        })
        .catch(err => {
            console.error('Error loading orders:', err);
            ordersContainer.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-red-500">
                        Error loading orders. Please try again.
                    </td>
                </tr>
            `;
        });
}

// Create order element from template
function createOrderElement(product, seller) {
    const element = orderTemplate.content.cloneNode(true);
    
    // Set product image if available
    const productImage = element.querySelector('.product-image');
    if (product.imageUrl) {
        productImage.src = product.imageUrl;
        productImage.alt = product.name;
    } else {
        productImage.src = 'https://via.placeholder.com/40?text=No+Image';
        productImage.alt = 'No image available';
    }
    
    // Set product details
    element.querySelector('.product-name').textContent = product.name;
    element.querySelector('.product-details').textContent = 
        `${product.quantity} ${product.unit} - ${product.farmingMethod}`;
    
    // Set seller details
    element.querySelector('.seller-name').textContent = seller.name;
    element.querySelector('.seller-contact').textContent = seller.phoneNumber;
    
    // Handle different order types (bid vs purchase)
    const amountElement = element.querySelector('.purchase-amount');
    const dateElement = element.querySelector('.purchase-date');
    const statusBadge = document.createElement('span');
    statusBadge.className = 'ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
    
    if (product.orderType === 'bid') {
        // This is a bid, not a completed purchase
        amountElement.textContent = `₹${product.bidAmount} (Bid)`;
        amountElement.parentNode.appendChild(statusBadge);
        statusBadge.className += ' bg-yellow-100 text-yellow-800';
        statusBadge.textContent = 'Pending';
        
        // Show bid date
        const bidDate = product.bidCreatedAt?.toDate() || new Date();
        dateElement.textContent = formatDate(bidDate);
    } else {
        // This is a completed purchase
        amountElement.textContent = `₹${product.soldAmount}`;
        amountElement.parentNode.appendChild(statusBadge);
        statusBadge.className += ' bg-green-100 text-green-800';
        statusBadge.textContent = 'Purchased';
        
        // Show purchase date
        const purchaseDate = product.soldAt?.toDate() || new Date();
        dateElement.textContent = formatDate(purchaseDate);
    }
    
    // Set view details link
    element.querySelector('.view-details-btn').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = `product-details.html?id=${product.id}`;
    });
    
    return element;
}

// Show empty state message
function showEmptyState() {
    ordersContainer.innerHTML = '';
    emptyState.classList.remove('hidden');
}

// Format date to readable string
function formatDate(date) {
    return date.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
