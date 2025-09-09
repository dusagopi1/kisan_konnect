// DOM elements
const userNameElement = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const backBtn = document.getElementById('back-btn');
const loadingState = document.getElementById('loading-state');
const profileContent = document.getElementById('profile-content');
const profileFullName = document.getElementById('profile-full-name');
const profileUserType = document.getElementById('profile-user-type');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profilePhone = document.getElementById('profile-phone');
const profileState = document.getElementById('profile-state');
const farmersOnly = document.getElementById('farmers-only');
const totalTransactions = document.getElementById('total-transactions');
const activeListings = document.getElementById('active-listings');
const averageRating = document.getElementById('average-rating');
const reviewsContainer = document.getElementById('reviews-container');
const noReviewsText = document.getElementById('no-reviews');
const reviewTemplate = document.getElementById('review-template');
const editProfileBtn = document.getElementById('edit-profile-btn');
const editProfileModal = document.getElementById('edit-profile-modal');
const closeEditModal = document.getElementById('close-edit-modal');
const editProfileForm = document.getElementById('edit-profile-form');
const editName = document.getElementById('edit-name');
const editPhone = document.getElementById('edit-phone');
const editState = document.getElementById('edit-state');
const editFarmersOnly = document.getElementById('edit-farmers-only');

// Current user info
let currentUser = null;
let userType = null;
let userData = null;

// Check auth state
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        
        // Get user data
        db.collection('users').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    userData = doc.data();
                    userType = userData.userType;
                    
                    // Display user name
                    userNameElement.textContent = userData.name;
                    
                    // Load user profile
                    loadUserProfile(userData);
                    loadUserStats();
                    loadUserReviews();
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

// Load user profile data
function loadUserProfile(user) {
    // Hide loading and show profile
    loadingState.classList.add('hidden');
    profileContent.classList.remove('hidden');
    
    // Set profile info
    profileFullName.textContent = user.name;
    profileUserType.textContent = user.userType === 'farmer' ? 'Farmer' : 'Wholesaler';
    profileName.textContent = user.name;
    profileEmail.textContent = user.email;
    profilePhone.textContent = user.phone || 'Not provided';
    
    // Show state for farmers
    if (user.userType === 'farmer') {
        farmersOnly.classList.remove('hidden');
        profileState.textContent = user.state || 'Not provided';
    }
    
    // Set edit form values
    editName.value = user.name;
    editPhone.value = user.phone || '';
    
    if (user.userType === 'farmer') {
        editFarmersOnly.classList.remove('hidden');
        if (user.state) {
            editState.value = user.state;
        }
    }
}

// Load user stats
function loadUserStats() {
    const collectionName = userType === 'farmer' ? 'products' : 'bids';
    const fieldName = userType === 'farmer' ? 'farmerId' : 'wholesalerId';
    
    // Get total transactions (completed sales or accepted bids)
    if (userType === 'farmer') {
        db.collection('products')
            .where(fieldName, '==', currentUser.uid)
            .where('status', '==', 'sold')
            .get()
            .then(snapshot => {
                totalTransactions.textContent = snapshot.size;
            });
    } else {
        db.collection('bids')
            .where(fieldName, '==', currentUser.uid)
            .where('status', '==', 'accepted')
            .get()
            .then(snapshot => {
                totalTransactions.textContent = snapshot.size;
            });
    }
    
    // Get active listings for farmers or active bids for wholesalers
    if (userType === 'farmer') {
        db.collection('products')
            .where(fieldName, '==', currentUser.uid)
            .where('status', '==', 'available')
            .get()
            .then(snapshot => {
                activeListings.textContent = snapshot.size;
            });
    } else {
        db.collection('bids')
            .where(fieldName, '==', currentUser.uid)
            .where('status', '==', 'pending')
            .get()
            .then(snapshot => {
                activeListings.textContent = snapshot.size;
            });
    }
    
    // Get average rating
    db.collection('reviews')
        .where('targetUserId', '==', currentUser.uid)
        .get()
        .then(snapshot => {
            if (!snapshot.empty) {
                let totalRating = 0;
                snapshot.forEach(doc => {
                    totalRating += doc.data().rating;
                });
                const avgRating = (totalRating / snapshot.size).toFixed(1);
                averageRating.textContent = avgRating;
            }
        });
}

// Load user reviews
function loadUserReviews() {
    db.collection('reviews')
        .where('targetUserId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                noReviewsText.classList.remove('hidden');
                return;
            }
            
            noReviewsText.classList.add('hidden');
            
            snapshot.forEach(doc => {
                const review = doc.data();
                
                // Get reviewer name
                db.collection('users').doc(review.reviewerId).get()
                    .then(userDoc => {
                        if (userDoc.exists) {
                            const reviewer = userDoc.data();
                            
                            // Clone review template
                            const reviewElement = reviewTemplate.content.cloneNode(true);
                            
                            // Set review data
                            const ratingContainer = reviewElement.querySelector('.review-rating');
                            for (let i = 0; i < 5; i++) {
                                const star = document.createElement('span');
                                star.innerHTML = i < review.rating ? '★' : '☆';
                                ratingContainer.appendChild(star);
                            }
                            
                            reviewElement.querySelector('.review-date').textContent = formatDate(review.createdAt);
                            reviewElement.querySelector('.review-from').textContent = `${reviewer.name} (${reviewer.userType === 'farmer' ? 'Farmer' : 'Wholesaler'})`;
                            reviewElement.querySelector('.review-text').textContent = review.comment;
                            reviewElement.querySelector('.review-transaction').textContent = `Transaction ID: ${review.productId.slice(0, 8)}`;
                            
                            reviewsContainer.appendChild(reviewElement);
                        }
                    });
            });
        })
        .catch(err => {
            console.error('Error loading reviews:', err);
        });
}

// Edit profile modal handlers
editProfileBtn.addEventListener('click', () => {
    editProfileModal.classList.remove('hidden');
});

closeEditModal.addEventListener('click', () => {
    editProfileModal.classList.add('hidden');
});

// Handle profile edit form submission
editProfileForm.addEventListener('submit', e => {
    e.preventDefault();
    
    const updates = {
        name: editName.value,
        phone: editPhone.value
    };
    
    if (userType === 'farmer') {
        updates.state = editState.value;
    }
    
    db.collection('users').doc(currentUser.uid).update(updates)
        .then(() => {
            alert('Profile updated successfully!');
            
            // Update UI
            profileFullName.textContent = updates.name;
            profileName.textContent = updates.name;
            userNameElement.textContent = updates.name;
            profilePhone.textContent = updates.phone || 'Not provided';
            
            if (userType === 'farmer') {
                profileState.textContent = updates.state || 'Not provided';
            }
            
            // Close modal
            editProfileModal.classList.add('hidden');
        })
        .catch(err => {
            console.error('Error updating profile:', err);
            alert('Error updating profile: ' + err.message);
        });
});

// Format date
function formatDate(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
