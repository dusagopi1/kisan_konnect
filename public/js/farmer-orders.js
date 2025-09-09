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
                    // Verify this is a farmer account
                    if (userData.userType !== 'farmer') {
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

// Load farmer's orders (sold products)
function loadOrders(farmerId) {
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
    
    // Query for sold products by this farmer
    db.collection('products')
        .where('farmerId', '==', farmerId)
        .where('status', '==', 'sold')
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                showEmptyState();
                return;
            }
            
            // Process sold products
            const soldProducts = snapshot.docs.map(doc => {
                return {
                    id: doc.id,
                    ...doc.data()
                };
            });
            
            // Sort by sold date (newest first)
            soldProducts.sort((a, b) => {
                const dateA = a.soldAt?.toDate() || new Date(0);
                const dateB = b.soldAt?.toDate() || new Date(0);
                return dateB - dateA;
            });
            
            // Filter orders if needed
            let filteredOrders = soldProducts;
            if (currentFilter === 'completed') {
                // For now, all sold products are considered completed
                // In a real app, you might have additional statuses like "shipped", "delivered", etc.
                filteredOrders = soldProducts;
            }
            
            if (filteredOrders.length === 0) {
                showEmptyState();
                return;
            }
            
            // Clear container before adding orders
            ordersContainer.innerHTML = '';
            emptyState.classList.add('hidden');
            
            // Get buyer details for each order
            const promises = filteredOrders.map(product => {
                return db.collection('users').doc(product.soldTo).get()
                    .then(userDoc => {
                        if (userDoc.exists) {
                            const buyerData = userDoc.data();
                            return {
                                product,
                                buyer: buyerData
                            };
                        }
                        return {
                            product,
                            buyer: { name: 'Unknown Buyer', phoneNumber: 'N/A' }
                        };
                    })
                    .catch(err => {
                        console.error('Error fetching buyer data:', err);
                        return {
                            product,
                            buyer: { name: 'Unknown Buyer', phoneNumber: 'N/A' }
                        };
                    });
            });
            
            // Process all orders
            Promise.all(promises)
                .then(results => {
                    results.forEach(result => {
                        const orderElement = createOrderElement(result.product, result.buyer);
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
function createOrderElement(product, buyer) {
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
    
    // Set buyer details
    element.querySelector('.buyer-name').textContent = buyer.name;
    element.querySelector('.buyer-contact').textContent = buyer.phoneNumber;
    
    // Set sale amount
    element.querySelector('.sold-amount').textContent = `₹${product.soldAmount}`;
    element.querySelector('.min-bid').textContent = `Min bid: ₹${product.minimumBid}`;
    
    // Set sold date
    const soldDate = product.soldAt?.toDate() || new Date();
    element.querySelector('.sold-date').textContent = formatDate(soldDate);
    
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
