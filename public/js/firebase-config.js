// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA718r-KQGQ4MBt9ypMrwWTljyWUzlhWug",
  authDomain: "fir-uploadexample-34626.firebaseapp.com",
  databaseURL: "https://fir-uploadexample-34626-default-rtdb.firebaseio.com",
  projectId: "fir-uploadexample-34626",
  storageBucket: "fir-uploadexample-34626.appspot.com",
  messagingSenderId: "356561872250",
  appId: "1:356561872250:web:d5e200cf985236da42a2c3",
  measurementId: "G-GT43GT4EVR"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Enable offline capabilities with multi-tab support
db.enablePersistence({ synchronizeTabs: true })
    .catch(err => {
        if (err.code === 'failed-precondition') {
            console.log('Persistence failed: Multiple tabs open. Using default memory-only persistence.');
            // Continue with memory-only persistence when multiple tabs are open
        } else if (err.code === 'unimplemented') {
            console.log('Persistence not available in this browser');
        }
    });
