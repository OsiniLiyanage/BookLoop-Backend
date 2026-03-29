package lk.jiat.util;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.FirestoreClient;

import java.io.InputStream;

// FirebaseUtil — initializes the Firebase Admin SDK once when server starts.
// WHY Firebase Admin SDK (not MySQL):
//   Your Android app stores all data (books, users, orders) in Firebase Firestore.
//   The admin panel must connect to the SAME Firestore database so that books
//   added here appear in the Android app.
//
// SETUP REQUIRED (one time):
//   1. Go to Firebase Console → your BookLoop project
//   2. Click the gear icon → Project Settings → Service Accounts tab
//   3. Click "Generate new private key" → download the JSON file
//   4. Rename it to "serviceAccountKey.json"
//   5. Place it in: src/main/resources/serviceAccountKey.json
public class FirebaseUtil {

    // initialized = true after first init, prevents re-initializing
    private static boolean initialized = false;

    // Call this once from Main.java before starting Tomcat
    public static void initialize() {
        if (initialized) return;

        try {
            // Load service account key from resources folder
            InputStream serviceAccount = FirebaseUtil.class
                    .getClassLoader()
                    .getResourceAsStream("serviceAccountKey.json");

            if (serviceAccount == null) {
                throw new RuntimeException(
                        "serviceAccountKey.json not found in src/main/resources/\n" +
                                "Download it from Firebase Console → Project Settings → Service Accounts"
                );
            }

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .build();

            // Only initialize if not already done (avoids duplicate app error)
            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseApp.initializeApp(options);
            }

            initialized = true;
            System.out.println("✅ Firebase Admin SDK initialized successfully");

        } catch (Exception e) {
            throw new RuntimeException("Firebase initialization failed: " + e.getMessage(), e);
        }
    }

    // Returns a Firestore instance — use this in every controller to read/write data
    public static Firestore getFirestore() {
        if (!initialized) initialize();
        return FirestoreClient.getFirestore();
    }
}