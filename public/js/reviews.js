// Review System for KisanConnect
// This file contains helper functions for the review and rating system

// Function to create a new review 
function createReview(productId, reviewerId, targetUserId, rating, comment) {
    return db.collection('reviews').add({
        productId,
        reviewerId,
        targetUserId,
        rating,
        comment,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// Function to check if a user can leave a review for a transaction
function canReview(userId, productId) {
    return db.collection('products').doc(productId).get()
        .then(doc => {
            if (!doc.exists) return false;
            
            const product = doc.data();
            
            // Can only review if product is sold
            if (product.status !== 'sold') return false;
            
            // Farmer can review if they sold the product
            if (userId === product.farmerId) return { canReview: true, targetUserId: product.soldTo };
            
            // Wholesaler can review if they bought the product
            if (userId === product.soldTo) return { canReview: true, targetUserId: product.farmerId };
            
            return { canReview: false };
        });
}

// Function to check if a user has already left a review for a transaction
function hasReviewed(userId, productId) {
    return db.collection('reviews')
        .where('reviewerId', '==', userId)
        .where('productId', '==', productId)
        .get()
        .then(snapshot => !snapshot.empty);
}

// Function to get the average rating for a user
function getUserAverageRating(userId) {
    return db.collection('reviews')
        .where('targetUserId', '==', userId)
        .get()
        .then(snapshot => {
            if (snapshot.empty) return 0;
            
            let totalRating = 0;
            snapshot.forEach(doc => {
                totalRating += doc.data().rating;
            });
            
            return (totalRating / snapshot.size).toFixed(1);
        });
}

// Function to get reviews for a user
function getUserReviews(userId, limit = 5) {
    return db.collection('reviews')
        .where('targetUserId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get()
        .then(snapshot => {
            const reviews = [];
            snapshot.forEach(doc => {
                reviews.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return reviews;
        });
}

// Function to render a star rating (1-5)
function renderStarRating(container, rating) {
    container.innerHTML = '';
    
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.className = i <= rating ? 'text-yellow-500' : 'text-gray-300';
        star.innerHTML = '★';
        container.appendChild(star);
    }
}

// Function to render a review form
function renderReviewForm(container, productId, targetUserId, onSubmit) {
    container.innerHTML = `
        <h3 class="text-lg font-bold text-gray-800 mb-4">Leave a Review</h3>
        <form id="review-form" class="space-y-4">
            <div>
                <label class="block text-gray-700 text-sm font-bold mb-2">Rating</label>
                <div class="flex space-x-2 rating-stars">
                    <button type="button" data-rating="1" class="text-gray-300 text-2xl hover:text-yellow-500 focus:outline-none transition-colors">★</button>
                    <button type="button" data-rating="2" class="text-gray-300 text-2xl hover:text-yellow-500 focus:outline-none transition-colors">★</button>
                    <button type="button" data-rating="3" class="text-gray-300 text-2xl hover:text-yellow-500 focus:outline-none transition-colors">★</button>
                    <button type="button" data-rating="4" class="text-gray-300 text-2xl hover:text-yellow-500 focus:outline-none transition-colors">★</button>
                    <button type="button" data-rating="5" class="text-gray-300 text-2xl hover:text-yellow-500 focus:outline-none transition-colors">★</button>
                </div>
                <input type="hidden" id="rating-value" name="rating" value="0" required>
                <p id="rating-error" class="hidden text-red-500 text-xs mt-1">Please select a rating</p>
            </div>
            <div>
                <label for="review-comment" class="block text-gray-700 text-sm font-bold mb-2">Comment</label>
                <textarea id="review-comment" name="comment" rows="4" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600" required></textarea>
            </div>
            <div class="flex justify-end">
                <button type="submit" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                    Submit Review
                </button>
            </div>
        </form>
    `;
    
    // Set up rating stars
    const ratingStars = container.querySelectorAll('.rating-stars button');
    const ratingValue = container.querySelector('#rating-value');
    const ratingError = container.querySelector('#rating-error');
    
    ratingStars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.getAttribute('data-rating'));
            ratingValue.value = rating;
            
            // Update stars UI
            ratingStars.forEach((s, i) => {
                s.className = i < rating 
                    ? 'text-yellow-500 text-2xl hover:text-yellow-500 focus:outline-none transition-colors'
                    : 'text-gray-300 text-2xl hover:text-yellow-500 focus:outline-none transition-colors';
            });
            
            // Hide error message if shown
            ratingError.classList.add('hidden');
        });
    });
    
    // Set up form submission
    const form = container.querySelector('#review-form');
    form.addEventListener('submit', e => {
        e.preventDefault();
        
        // Validate rating
        const rating = parseInt(ratingValue.value);
        if (rating < 1 || rating > 5) {
            ratingError.classList.remove('hidden');
            return;
        }
        
        const comment = form.elements.comment.value;
        
        if (typeof onSubmit === 'function') {
            onSubmit(productId, targetUserId, rating, comment);
        }
    });
}
