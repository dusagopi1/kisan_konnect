// DOM elements
const loginContainer = document.getElementById('login-container');
const registerContainer = document.getElementById('register-container');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const signupBtn = document.getElementById('signup-btn');
const backToLoginBtn = document.getElementById('back-to-login');

// Toggle between login and registration forms
registerBtn.addEventListener('click', () => {
    loginContainer.classList.add('hidden');
    registerContainer.classList.remove('hidden');
});

backToLoginBtn.addEventListener('click', () => {
    registerContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
});

// User registration
signupBtn.addEventListener('click', () => {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const userType = document.getElementById('user-type').value;
    
    if (!name || !email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    // Create user in Firebase Authentication
    auth.createUserWithEmailAndPassword(email, password)
        .then(cred => {
            // Store additional user data in Firestore
            return db.collection('users').doc(cred.user.uid).set({
                name: name,
                email: email,
                userType: userType,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            // Reset form
            document.getElementById('reg-name').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            
            // Show success message and redirect
            alert('Registration successful! Please log in.');
            registerContainer.classList.add('hidden');
            loginContainer.classList.remove('hidden');
        })
        .catch(err => {
            console.error('Registration error:', err);
            alert('Registration error: ' + err.message);
        });
});

// User login
loginBtn.addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .then(cred => {
            // Clear inputs
            document.getElementById('email').value = '';
            document.getElementById('password').value = '';
            
            // Get user type and redirect accordingly
            return db.collection('users').doc(cred.user.uid).get();
        })
        .then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                // Store user type in localStorage for notifications system
                localStorage.setItem('userType', userData.userType);
                
                if (userData.userType === 'farmer') {
                    window.location.href = 'farmer-dashboard.html';
                } else {
                    window.location.href = 'wholesaler-dashboard.html';
                }
            } else {
                console.error('User document not found');
                auth.signOut();
                alert('Error: User data not found');
            }
        })
        .catch(err => {
            console.error('Login error:', err);
            alert('Login failed: ' + err.message);
        });
});

// Check auth state
auth.onAuthStateChanged(user => {
    if (user) {
        // User is already logged in, redirect based on user type
        db.collection('users').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    // Store user type in localStorage for notifications system
                    localStorage.setItem('userType', userData.userType);
                    
                    if (userData.userType === 'farmer') {
                        window.location.href = 'farmer-dashboard.html';
                    } else {
                        window.location.href = 'wholesaler-dashboard.html';
                    }
                }
            })
            .catch(err => {
                console.error('Error checking user data:', err);
            });
    }
});
