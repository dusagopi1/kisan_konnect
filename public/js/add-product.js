// DOM elements
const userNameElement = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const addProductForm = document.getElementById('add-product-form');
const submitBtn = document.getElementById('submit-btn');

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

// Form submission handler
addProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Disable submit button to prevent multiple submissions
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Adding Product...';
    
    try {
        // Get current user
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }
        
        // Collect form data
        const formData = {
            name: document.getElementById('product-name').value,
            category: document.getElementById('product-category').value,
            quantity: parseFloat(document.getElementById('product-quantity').value),
            unit: document.getElementById('product-unit').value,
            pricePerUnit: parseFloat(document.getElementById('price-per-unit').value),
            minimumBid: parseFloat(document.getElementById('minimum-bid').value),
            farmingMethod: document.getElementById('farming-method').value,
            harvestDate: new Date(document.getElementById('harvest-date').value),
            description: document.getElementById('product-description').value,
            phoneNumber: document.getElementById('phone-number').value,
            biddingDuration: parseInt(document.getElementById('bidding-duration').value),
            state: document.getElementById('state').value,
            district: document.getElementById('district').value,
            
            // Add timestamp and default values
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            biddingStartTime: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'available',
            farmerId: user.uid
        };
        
        // Add expiry date if provided
        const expiryDateInput = document.getElementById('expiry-date').value;
        if (expiryDateInput) {
            formData.expiryDate = new Date(expiryDateInput);
        }
        
        // Handle image upload
        const imageFile = document.getElementById('product-image').files[0];
        let imageUrl = '';
        
        if (imageFile) {
            // Create storage reference
            const storageRef = storage.ref(`product-images/${user.uid}/${Date.now()}_${imageFile.name}`);
            
            // Upload the file
            await storageRef.put(imageFile);
            
            // Get download URL
            imageUrl = await storageRef.getDownloadURL();
            formData.imageUrl = imageUrl;
        }
        
        // Add product to Firestore
        await db.collection('products').add(formData);
        
        // Show success message and redirect
        alert('Product added successfully!');
        window.location.href = 'farmer-dashboard.html';
    } catch (error) {
        console.error('Error adding product:', error);
        alert('Error adding product: ' + error.message);
        
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Add Product';
    }
});
