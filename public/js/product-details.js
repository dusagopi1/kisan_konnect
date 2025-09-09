// DOM elements
const userNameElement = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const backBtn = document.getElementById('back-btn');
const loadingState = document.getElementById('loading-state');
const productDetails = document.getElementById('product-details');
const bidsSection = document.getElementById('bids-section');
const biddingFormSection = document.getElementById('bidding-form-section');
const bidsContainer = document.getElementById('bids-container');
const biddingForm = document.getElementById('bidding-form');
const bidTemplate = document.getElementById('bid-template');
const farmerControls = document.getElementById('farmer-controls');
const endBiddingBtn = document.getElementById('end-bidding-btn');
const selectWinnerModal = document.getElementById('select-winner-modal');
const winnerSelectionBids = document.getElementById('winner-selection-bids');
const cancelWinnerSelect = document.getElementById('cancel-winner-select');

// Get product ID from URL
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

// Current user info
let currentUser = null;
let userType = null;

// Product data
let productData = null;

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
                    
                    // Load product details
                    if (productId) {
                        loadProductDetails(productId);
                    } else {
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
    window.location.href = userType === 'farmer' ? 'farmer-dashboard.html' : 'wholesaler-dashboard.html';
});

// End bidding button handler
if (endBiddingBtn) {
    endBiddingBtn.addEventListener('click', () => {
        // Show winner selection modal
        loadBidsForWinnerSelection(productId);
        selectWinnerModal.classList.remove('hidden');
    });
}

// Cancel winner selection button handler
if (cancelWinnerSelect) {
    cancelWinnerSelect.addEventListener('click', () => {
        selectWinnerModal.classList.add('hidden');
    });
}

// Load product details
function loadProductDetails(productId) {
    db.collection('products').doc(productId).get()
        .then(doc => {
            if (doc.exists) {
                productData = doc.data();
                productData.id = doc.id;
                
                // Show product details and hide loading state
                displayProductDetails(productData);
                loadingState.classList.add('hidden');
                productDetails.classList.remove('hidden');
                
                // Show appropriate sections based on user type
                if (userType === 'farmer') {
                    // Check if this is the farmer's own product
                    if (currentUser.uid === productData.farmerId) {
                        // Show bids section for the farmer
                        bidsSection.classList.remove('hidden');
                        
                        // Load bids
                        loadBids(productId);
                        
                        // If product is not sold, show farmer controls
                        if (productData.status !== 'sold') {
                            // Always show the end bidding controls to farmers for their products
                            farmerControls.classList.remove('hidden');
                            
                            // Update the button text based on whether bidding time has ended naturally
                            const now = new Date();
                            const startTime = productData.biddingStartTime.toDate();
                            const durationMs = productData.biddingDuration * 60 * 1000;
                            const endTime = new Date(startTime.getTime() + durationMs);
                            
                            const endBiddingBtn = document.getElementById('end-bidding-btn');
                            if (endBiddingBtn) {
                                if (now >= endTime) {
                                    endBiddingBtn.textContent = 'Select Winner';
                                    endBiddingBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
                                    endBiddingBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
                                } else {
                                    endBiddingBtn.textContent = 'End Bidding Early & Select Winner';
                                }
                            }
                        }
                    }
                } else if (userType === 'wholesaler') {
                    // For wholesaler, hide bids section and show bidding form if bidding is still open
                    bidsSection.classList.add('hidden');
                    
                    const now = new Date();
                    const startTime = productData.biddingStartTime.toDate();
                    const durationMs = productData.biddingDuration * 60 * 1000;
                    const endTime = new Date(startTime.getTime() + durationMs);
                    
                    if (now < endTime && productData.status === 'available') {
                        // Bidding is still open, show bidding form
                        biddingFormSection.classList.remove('hidden');
                        setupBiddingForm(productId, productData.minimumBid);
                    }
                    
                    // If this product is sold to current wholesaler, show chat button
                    if (productData.status === 'sold' && productData.soldTo === currentUser.uid) {
                        // Add chat button
                        const chatButton = document.createElement('button');
                        chatButton.className = 'mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline';
                        chatButton.textContent = 'Chat with Farmer';
                        chatButton.addEventListener('click', () => {
                            window.location.href = `chat.html?productId=${productId}`;
                        });
                        
                        // Append to bids section or create new section
                        const chatSection = document.createElement('div');
                        chatSection.className = 'bg-white rounded-lg shadow p-6 mb-6';
                        chatSection.innerHTML = `
                            <h2 class="text-xl font-bold text-gray-800 mb-4">Contact Farmer</h2>
                            <p class="text-gray-600 mb-4">You've won the bid for this product! Chat with the farmer to arrange pickup/delivery.</p>
                        `;
                        chatSection.appendChild(chatButton);
                        productDetails.appendChild(chatSection);
                    }
                }
                
                // Start countdown timer if product is available
                if (productData.status === 'available') {
                    const startTime = productData.biddingStartTime.toDate();
                    startCountdown(startTime, productData.biddingDuration);
                }
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

// Display product details
function displayProductDetails(product) {
    // Set product image if available
    if (product.imageUrl) {
        const imageContainer = document.getElementById('product-image-container');
        const noImagePlaceholder = document.getElementById('no-image-placeholder');
        
        const img = document.createElement('img');
        img.src = product.imageUrl;
        img.alt = product.name;
        img.className = 'h-full w-full object-cover';
        
        imageContainer.replaceChild(img, noImagePlaceholder);
    }
    
    // Set product status
    const statusElement = document.getElementById('product-status');
    if (product.status === 'sold') {
        statusElement.textContent = 'SOLD';
        statusElement.classList.add('bg-blue-100', 'text-blue-800');
    } else {
        // Calculate if bidding is still active
        const now = new Date();
        const startTime = product.biddingStartTime.toDate();
        const durationMs = product.biddingDuration * 60 * 1000;
        const endTime = new Date(startTime.getTime() + durationMs);
        
        if (now < endTime) {
            statusElement.textContent = 'ACTIVE';
            statusElement.classList.add('bg-green-100', 'text-green-800');
        } else {
            statusElement.textContent = 'EXPIRED';
            statusElement.classList.add('bg-gray-100', 'text-gray-800');
        }
    }
    
    // Set product information
    document.getElementById('product-name').textContent = product.name;
    document.getElementById('product-description').textContent = product.description;
    document.getElementById('product-quantity').textContent = `${product.quantity} ${product.unit}`;
    document.getElementById('product-farming-method').textContent = product.farmingMethod;
    document.getElementById('product-harvest-date').textContent = formatDate(product.harvestDate.toDate());
    
    // Set expiry date if available
    if (product.expiryDate) {
        document.getElementById('product-expiry-date').textContent = formatDate(product.expiryDate.toDate());
    } else {
        document.getElementById('product-expiry-date').textContent = 'Not applicable';
    }
    
    // Set price and location information
    document.getElementById('product-price').textContent = `₹${product.pricePerUnit} per ${product.unit}`;
    document.getElementById('product-min-bid').textContent = `₹${product.minimumBid}`;
    document.getElementById('product-location').textContent = `${product.district}, ${product.state}`;
    document.getElementById('product-contact').textContent = product.phoneNumber;
    
    // Set bidding status
    const biddingStatus = document.getElementById('bidding-status');
    if (product.status === 'sold') {
        biddingStatus.textContent = `Sold on ${formatDate(product.soldAt.toDate())}`;
    } else {
        const now = new Date();
        const startTime = product.biddingStartTime.toDate();
        const durationMs = product.biddingDuration * 60 * 1000;
        const endTime = new Date(startTime.getTime() + durationMs);
        
        if (now < endTime) {
            biddingStatus.textContent = 'Bidding is open';
        } else {
            biddingStatus.textContent = 'Bidding has ended';
            document.getElementById('countdown-container').classList.add('hidden');
        }
    }
}
function startCountdown(startTime, durationMinutes) {
    const countdownElement = document.getElementById('countdown');
    const progressBar = document.getElementById('progress-bar');
    
    if (!countdownElement || !progressBar) {
        console.error('Countdown elements not found');
        return;
    }
    
    const durationMs = durationMinutes * 60 * 1000;
    const endTime = new Date(startTime.getTime() + durationMs);
    
    // Function to update the timer and progress bar
    function updateTimer() {
        const now = new Date();
        const timeLeft = endTime - now;
        const totalDuration = durationMs;
        const elapsed = now - startTime;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            countdownElement.textContent = 'Bidding has ended';
            progressBar.style.width = '0%';
            
            // Reload page to update UI states
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            return;
        }
        
        // Calculate time units
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        // Format countdown text
        let countdownText = '';
        if (days > 0) {
            countdownText += `${days}d `;
        }
        countdownText += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update DOM safely
        if (countdownElement) {
            countdownElement.textContent = countdownText;
        }
        
        // Update progress bar - show remaining time as percentage
        const timeElapsedPercentage = (elapsed / totalDuration) * 100;
        const timeRemainingPercentage = 100 - timeElapsedPercentage;
        
        if (progressBar) {
            progressBar.style.width = `${timeRemainingPercentage}%`;
            
            // Update progress bar color based on time remaining
            progressBar.classList.remove('bg-green-500', 'bg-yellow-500', 'bg-red-500');
            if (timeRemainingPercentage < 20) {
                progressBar.classList.add('bg-red-500');
            } else if (timeRemainingPercentage < 50) {
                progressBar.classList.add('bg-yellow-500');
            } else {
                progressBar.classList.add('bg-green-500');
            }
        }
        
        // Log for debugging
        console.log(`Time remaining: ${countdownText}, Progress: ${timeRemainingPercentage.toFixed(2)}%`);
    }
    
    // Call once immediately
    updateTimer();
    
    // Update timer every second
    const timerInterval = setInterval(updateTimer, 1000);
    
    return timerInterval; // Return interval ID for potential cleanup
}

// Load bids for a product
function loadBids(productId) {
    return db.collection('bids')
        .where('productId', '==', productId)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                bidsContainer.innerHTML = '<p class="text-gray-500">No bids have been placed yet.</p>';
                return [];
            }
            
            // Sort bids by amount in descending order
            const sortedBids = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => b.amount - a.amount);
            
            // Clear container
            bidsContainer.innerHTML = '';
            
            // Render bids
            const promises = sortedBids.map(bid => {
                // Get bidder name
                return db.collection('users').doc(bid.wholesalerId).get()
                    .then(doc => {
                        if (doc.exists) {
                            const userData = doc.data();
                            
                            // Clone bid template
                            const bidElement = bidTemplate.content.cloneNode(true);
                            
                            // Set bid data
                            bidElement.querySelector('.bid-amount').textContent = `₹${bid.amount}`;
                            bidElement.querySelector('.bidder-name').textContent = userData.name;
                            bidElement.querySelector('.bid-time').textContent = formatDate(bid.createdAt.toDate());
                            
                            bidsContainer.appendChild(bidElement);
                            
                            // Return bid with user data for later use
                            return {
                                ...bid,
                                bidderName: userData.name
                            };
                        }
                    });
            });
            
            return Promise.all(promises).then(bidsWithUserData => {
                return bidsWithUserData.filter(bid => bid); // Filter out undefined values
            });
        })
        .catch(err => {
            console.error('Error loading bids:', err);
            bidsContainer.innerHTML = '<p class="text-red-500">Error loading bids. Please try again.</p>';
            return [];
        });
}

// Load bids for winner selection modal
function loadBidsForWinnerSelection(productId) {
    db.collection('bids')
        .where('productId', '==', productId)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                winnerSelectionBids.innerHTML = '<p class="text-gray-500">No bids have been placed yet.</p>';
                return;
            }
            
            // Sort bids by amount in descending order
            const sortedBids = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => b.amount - a.amount);
            
            // Clear container
            winnerSelectionBids.innerHTML = '';
            
            // Render bids with select buttons
            sortedBids.forEach(bid => {
                // Get bidder name
                db.collection('users').doc(bid.wholesalerId).get()
                    .then(doc => {
                        if (doc.exists) {
                            const userData = doc.data();
                            
                            // Create bid element
                            const bidElement = document.createElement('div');
                            bidElement.className = 'p-4 border rounded-lg flex justify-between items-center';
                            bidElement.innerHTML = `
                                <div>
                                    <div class="text-lg font-bold text-green-600">₹${bid.amount}</div>
                                    <div class="text-sm text-gray-600">by ${userData.name}</div>
                                    <div class="text-xs text-gray-500">${formatDate(bid.createdAt.toDate())}</div>
                                </div>
                                <button class="select-winner-btn bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                    data-bid-id="${bid.id}"
                                    data-wholesaler-id="${bid.wholesalerId}"
                                    data-amount="${bid.amount}">
                                    Select as Winner
                                </button>
                            `;
                            
                            // Add event listener to select button
                            bidElement.querySelector('.select-winner-btn').addEventListener('click', () => {
                                selectWinner(bid.id, bid.wholesalerId, bid.amount);
                            });
                            
                            winnerSelectionBids.appendChild(bidElement);
                        }
                    });
            });
        })
        .catch(err => {
            console.error('Error loading bids for winner selection:', err);
            winnerSelectionBids.innerHTML = '<p class="text-red-500">Error loading bids. Please try again.</p>';
        });
}

// Select a winner and end bidding
function selectWinner(bidId, wholesalerId, amount) {
    const confirmSelection = confirm(`Are you sure you want to select this bid (₹${amount}) as the winner?`);
    
    if (!confirmSelection) return;
    
    // Show loading state
    selectWinnerModal.classList.add('pointer-events-none');
    const winnerBtn = selectWinnerModal.querySelector('.select-winner-btn');
    if (winnerBtn) {
        winnerBtn.textContent = 'Processing...';
        winnerBtn.disabled = true;
    }
    
    // Get product data for notification
    db.collection('products').doc(productId).get()
        .then(doc => {
            if (!doc.exists) throw new Error('Product not found');
            
            const productData = doc.data();
            const productName = productData.name;
            
            // Update product status to sold
            return db.collection('products').doc(productId).update({
                status: 'sold',
                soldAt: firebase.firestore.FieldValue.serverTimestamp(),
                soldTo: wholesalerId,
                soldAmount: amount,
                winningBidId: bidId
            })
            .then(() => {
                // Update bid status to accepted
                return db.collection('bids').doc(bidId).update({
                    status: 'accepted'
                });
            })
            .then(() => {
                // Update all other bids for this product to rejected
                return db.collection('bids')
                    .where('productId', '==', productId)
                    .get()
                    .then(snapshot => {
                        const batch = db.batch();
                        snapshot.docs.forEach(doc => {
                            const bid = doc.data();
                            if (doc.id !== bidId) {
                                batch.update(doc.ref, { status: 'rejected' });
                            }
                        });
                        return batch.commit();
                    });
            })
            .then(() => {
                // Create a chat reference
                const chatId = `product_${productId}`;
                return db.collection('chats').doc(chatId).set({
                    productId: productId,
                    productName: productName,
                    farmerId: currentUser.uid,
                    wholesalerId: wholesalerId,
                    amount: amount,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            })
            .then(() => {
                // Check if notification system is available
                if (typeof NotificationEvents !== 'undefined' && 
                    typeof NotificationEvents.bidAccepted === 'function') {
                    // Send notification to wholesaler
                    return db.collection('users').doc(currentUser.uid).get()
                        .then(userDoc => {
                            if (userDoc.exists) {
                                const userData = userDoc.data();
                                return NotificationEvents.bidAccepted(
                                    productId,
                                    productName,
                                    currentUser.uid,
                                    userData.name,
                                    wholesalerId
                                );
                            }
                            return Promise.resolve();
                        });
                }
                return Promise.resolve();
            })
            .then(() => {
                alert('Bidding ended successfully! The winner has been notified.');
                // Redirect to chat with the winner
                window.location.href = `chat.html?id=${productId}`;
            });
        })
        .catch(err => {
            console.error('Error selecting winner:', err);
            alert('Error selecting winner: ' + err.message);
            selectWinnerModal.classList.remove('pointer-events-none');
            const winnerBtn = selectWinnerModal.querySelector('.select-winner-btn');
            if (winnerBtn) {
                winnerBtn.textContent = 'Select as Winner';
                winnerBtn.disabled = false;
            }
        });
}

// Setup bidding form
function setupBiddingForm(productId, minimumBid) {
    const bidAmountInput = document.getElementById('bid-amount');
    const biddingFormSection = document.getElementById('bidding-form-section');
    const bidFormStatus = document.getElementById('bid-form-status') || document.createElement('div');
    const submitBtn = document.getElementById('place-bid-btn');
    
    // First check if wholesaler has already placed a bid on this product
    db.collection('bids')
        .where('productId', '==', productId)
        .where('wholesalerId', '==', currentUser.uid)
        .where('status', '==', 'pending')
        .get()
        .then(snapshot => {
            if (!snapshot.empty) {
                // User has already placed a bid, show message instead of form
                const bid = snapshot.docs[0].data();
                
                // Create status message if it doesn't exist
                if (!document.getElementById('bid-form-status')) {
                    bidFormStatus.id = 'bid-form-status';
                    bidFormStatus.className = 'bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4';
                    biddingFormSection.insertBefore(bidFormStatus, biddingForm);
                }
                
                bidFormStatus.innerHTML = `
                    <p><strong>You have already placed a bid on this product!</strong></p>
                    <p>Your bid: ₹${bid.amount}</p>
                    <p>Please wait for the farmer to respond or check your <a href="wholesaler-orders.html" class="text-green-600 hover:underline">orders</a> for status.</p>
                `;
                
                // Hide the bidding form
                biddingForm.classList.add('hidden');
                return;
            }
            
            // Setup normal bidding form if no existing bid
            bidAmountInput.min = minimumBid;
            bidAmountInput.value = minimumBid;
            biddingForm.classList.remove('hidden');
            
            // Remove any existing status message
            if (document.getElementById('bid-form-status')) {
                document.getElementById('bid-form-status').remove();
            }
        })
        .catch(err => {
            console.error('Error checking existing bids:', err);
        });
    
    biddingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const bidAmount = parseInt(bidAmountInput.value);
        
        if (bidAmount < minimumBid) {
            alert(`Bid must be at least ₹${minimumBid}`);
            return;
        }
        
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Placing Bid...';
        
        // Check again if user has already placed a bid (in case they opened multiple tabs)
        db.collection('bids')
            .where('productId', '==', productId)
            .where('wholesalerId', '==', currentUser.uid)
            .where('status', '==', 'pending')
            .get()
            .then(snapshot => {
                if (!snapshot.empty) {
                    throw new Error('You have already placed a bid on this product!');
                }
                
                // Create bid object
                const bid = {
                    productId: productId,
                    wholesalerId: currentUser.uid,
                    amount: bidAmount,
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Add bid to Firestore
                return db.collection('bids').add(bid);
            })
            .then(() => {
                // Create notification for the farmer if notification system is available
                if (typeof NotificationEvents !== 'undefined' && 
                    typeof NotificationEvents.bidPlaced === 'function' && 
                    productData && productData.farmerId) {
                    
                    return db.collection('users').doc(currentUser.uid).get()
                        .then(userDoc => {
                            if (userDoc.exists) {
                                const userData = userDoc.data();
                                return NotificationEvents.bidPlaced(
                                    productId, 
                                    productData.name, 
                                    bidAmount, 
                                    currentUser.uid, 
                                    userData.name, 
                                    productData.farmerId
                                );
                            }
                            return Promise.resolve();
                        });
                }
                return Promise.resolve();
            })
            .then(() => {
                alert('Bid placed successfully!');
                window.location.href = 'wholesaler-orders.html';
            })
            .catch(err => {
                console.error('Error placing bid:', err);
                alert('Error placing bid: ' + (err.message || 'Unknown error'));
                
                // Re-enable submit button
                submitBtn.disabled = false;
                submitBtn.textContent = 'Place Bid';
            });
    });
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
