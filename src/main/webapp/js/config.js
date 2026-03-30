// ═══════════════════════════════════════════════════════
// config.js — Central configuration for BookLoop Admin
// ═══════════════════════════════════════════════════════

// Java REST API base URL (your IntelliJ server)
const API = "http://localhost:8080/api/v1";

// Firebase project config — copied from your current index.html
const firebaseConfig = {
    apiKey:            "AIzaSyDDk2WGWyHD8liuUD5PadFO1des_EE3_4E",
    authDomain:        "bookloop-9facd.firebaseapp.com",
    projectId:         "bookloop-9facd",
    storageBucket:     "bookloop-9facd.firebasestorage.app",
    messagingSenderId: "395086011417",
    appId:             "1:395086011417:web:0f01f09e4cea032d689e88",
    measurementId:     "G-V0ZJKER8ZQ"
};

// Initialize Firebase (once, shared by all pages)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Shared Firebase services
const fbAuth    = firebase.auth();
const fbStorage = firebase.storage();
const fbDb      = firebase.firestore();   // used for banners only