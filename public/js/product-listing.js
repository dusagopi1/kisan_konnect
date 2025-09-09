// DOM elements
const userNameElement = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const stateFilter = document.getElementById('state-filter');
const districtFilter = document.getElementById('district-filter');
const categoryFilter = document.getElementById('category-filter');
const filterForm = document.getElementById('filter-form');
const sortOption = document.getElementById('sort-option');
const productsContainer = document.getElementById('products-container');
const productCount = document.getElementById('product-count');
const noProductsMessage = document.getElementById('no-products-message');
const productTemplate = document.getElementById('product-template');

// Filter and sort state
let filters = {
    state: '',
    district: '',
    category: ''
};
let currentSort = 'newest';
let allProducts = [];
let filteredProducts = [];

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
                    
                    // Initialize location dropdown filters
                    initializeLocationDropdowns();
                    
                    // Load products
                    loadProducts();
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

// Initialize location dropdowns with states and districts
function initializeLocationDropdowns() {
    // Fetch the locations data
    fetch('/data/locations.json')
        .then(response => response.json())
        .then(data => {
            // Populate states dropdown
            data.states.forEach(state => {
                const option = document.createElement('option');
                option.value = state.name;
                option.textContent = state.name;
                stateFilter.appendChild(option);
            });
            
            // Add event listener to update districts when state changes
            stateFilter.addEventListener('change', () => {
                const selectedState = stateFilter.value;
                
                // Clear and disable district dropdown if no state is selected
                districtFilter.innerHTML = '<option value="">All Districts</option>';
                districtFilter.disabled = !selectedState;
                
                if (selectedState) {
                    // Find the selected state and its districts
                    const state = data.states.find(s => s.name === selectedState);
                    if (state && state.districts) {
                        // Enable district dropdown and populate districts
                        districtFilter.disabled = false;
                        
                        // Add district options
                        state.districts.forEach(district => {
                            const option = document.createElement('option');
                            option.value = district;
                            option.textContent = district;
                            districtFilter.appendChild(option);
                        });
                    }
                }
            });
        })
        .catch(error => {
            console.error('Error loading locations data:', error);
        });
}

// Load all available products
function loadProducts() {
    db.collection('products')
        .where('status', '==', 'available')
        .get()
        .then(snapshot => {
            // Clear loading placeholder
            productsContainer.innerHTML = '';
            
            if (snapshot.empty) {
                showNoProductsMessage();
                return;
            }
            
            // Process products
            allProducts = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Convert Firestore timestamps to JS Date objects
                    biddingStartTime: data.biddingStartTime.toDate(),
                    harvestDate: data.harvestDate.toDate(),
                    createdAt: data.createdAt?.toDate() || new Date()
                };
            });
            
            // Apply initial filters and sort
            applyFiltersAndSort();
            
            // Start countdown timers
            startCountdowns();
        })
        .catch(err => {
            console.error('Error loading products:', err);
            productsContainer.innerHTML = `
                <div class="col-span-full flex items-center justify-center h-48">
                    <p class="text-red-500">Failed to load products. Please try again.</p>
                </div>
            `;
        });
}

// Apply filters and sort products
function applyFiltersAndSort() {
    // Filter products
    filteredProducts = allProducts.filter(product => {
        // Check if product is still active
        const now = new Date();
        const endTime = new Date(product.biddingStartTime.getTime() + product.biddingDuration * 60 * 1000);
        const isActive = now < endTime;
        
        if (!isActive) return false;
        
        // Apply state filter
        if (filters.state && product.state !== filters.state) return false;
        
        // Apply district filter
        if (filters.district && product.district !== filters.district) return false;
        
        // Apply category filter
        if (filters.category && product.category !== filters.category) return false;
        
        return true;
    });
    
    // Sort products
    sortProducts();
    
    // Update product count
    updateProductCount();
    
    // Render products
    renderProducts();
}

// Sort products based on current sort option
function sortProducts() {
    switch (currentSort) {
        case 'newest':
            filteredProducts.sort((a, b) => b.createdAt - a.createdAt);
            break;
        case 'price-low':
            filteredProducts.sort((a, b) => a.minimumBid - b.minimumBid);
            break;
        case 'price-high':
            filteredProducts.sort((a, b) => b.minimumBid - a.minimumBid);
            break;
        case 'time-left':
            filteredProducts.sort((a, b) => {
                const aEndTime = new Date(a.biddingStartTime.getTime() + a.biddingDuration * 60 * 1000);
                const bEndTime = new Date(b.biddingStartTime.getTime() + b.biddingDuration * 60 * 1000);
                const aTimeLeft = aEndTime - new Date();
                const bTimeLeft = bEndTime - new Date();
                return aTimeLeft - bTimeLeft; // Ascending order (least time left first)
            });
            break;
    }
}

// Render products to container
function renderProducts() {
    // Clear container
    productsContainer.innerHTML = '';
    
    if (filteredProducts.length === 0) {
        showNoProductsMessage();
        return;
    }
    
    // Hide no products message
    noProductsMessage.classList.add('hidden');
    
    // Render each product
    filteredProducts.forEach(product => {
        const productElement = createProductElement(product);
        productsContainer.appendChild(productElement);
    });
}

// Create product element from template
function createProductElement(product) {
    const element = productTemplate.content.cloneNode(true);
    
    // Set product image if available
    const imageContainer = element.querySelector('.product-image-container');
    if (product.imageUrl) {
        const img = document.createElement('img');
        img.src = product.imageUrl;
        img.alt = product.name;
        img.className = 'h-full w-full object-cover';
        imageContainer.appendChild(img);
    } else {
        // Add placeholder image
        const placeholder = document.createElement('div');
        placeholder.className = 'flex items-center justify-center h-full';
        placeholder.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        `;
        imageContainer.appendChild(placeholder);
    }
    
    // Set product status
    const statusElement = element.querySelector('.product-status');
    statusElement.textContent = 'ACTIVE';
    statusElement.classList.add('bg-green-100', 'text-green-800');
    
    // Set product details
    element.querySelector('.product-name').textContent = product.name;
    element.querySelector('.product-location').textContent = `${product.district}, ${product.state}`;
    element.querySelector('.product-details').textContent = 
        `${product.quantity} ${product.unit} - ${product.farmingMethod}`;
    element.querySelector('.product-min-bid').textContent = `₹${product.minimumBid}`;
    
    // Set initial countdown text
    const countdownElement = element.querySelector('.product-countdown');
    const endTime = new Date(product.biddingStartTime.getTime() + product.biddingDuration * 60 * 1000);
    const timeLeft = endTime - new Date();
    const timeLeftText = formatTimeLeft(timeLeft);
    countdownElement.textContent = timeLeftText;
    
    // Set data attributes for countdown
    countdownElement.dataset.endTime = endTime.getTime();
    countdownElement.dataset.productId = product.id;
    
    // Set button actions
    element.querySelector('.view-details-btn').addEventListener('click', () => {
        window.location.href = `product-details.html?id=${product.id}`;
    });
    
    element.querySelector('.place-bid-btn').addEventListener('click', () => {
        // Open bid form directly in the product details page
        window.location.href = `product-details.html?id=${product.id}&action=bid`;
    });
    
    return element;
}

// Show no products message
function showNoProductsMessage() {
    productsContainer.innerHTML = '';
    noProductsMessage.classList.remove('hidden');
}

// Update product count text
function updateProductCount() {
    const count = filteredProducts.length;
    if (count === 0) {
        productCount.textContent = 'No products found';
    } else {
        productCount.textContent = `${count} product${count !== 1 ? 's' : ''} found`;
    }
}

// Start countdown timers for all visible products
function startCountdowns() {
    // Update all countdowns every second
    setInterval(() => {
        document.querySelectorAll('.product-countdown').forEach(element => {
            const endTimeMs = parseInt(element.dataset.endTime);
            const endTime = new Date(endTimeMs);
            const now = new Date();
            const timeLeft = endTime - now;
            
            if (timeLeft <= 0) {
                element.textContent = 'Expired';
                // Find and remove this product as it's no longer active
                const productId = element.dataset.productId;
                const index = filteredProducts.findIndex(p => p.id === productId);
                if (index !== -1) {
                    filteredProducts.splice(index, 1);
                    applyFiltersAndSort(); // Re-render products
                }
            } else {
                element.textContent = formatTimeLeft(timeLeft);
            }
        });
    }, 1000);
}

// Format time left as a string (e.g., "2h 30m" or "45m")
function formatTimeLeft(timeLeftMs) {
    if (timeLeftMs <= 0) return 'Expired';
    
    const days = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
        return `${days}d ${hours}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

// Filter form submit handler
filterForm.addEventListener('submit', e => {
    e.preventDefault();
    
    // Update filters
    filters.state = stateFilter.value;
    filters.district = districtFilter.value;
    filters.category = categoryFilter.value;
    
    // Apply filters and sort
    applyFiltersAndSort();
});

// Reset filters button handler
filterForm.addEventListener('reset', () => {
    // Clear filter values
    filters.state = '';
    filters.district = '';
    filters.category = '';
    
    // Reset select elements (in case they were set programmatically)
    stateFilter.value = '';
    districtFilter.value = '';
    categoryFilter.value = '';
    districtFilter.disabled = true;
    
    // Apply filters and sort
    setTimeout(() => {
        applyFiltersAndSort();
    }, 0);
});

// Sort option change handler
sortOption.addEventListener('change', () => {
    currentSort = sortOption.value;
    applyFiltersAndSort();
});
