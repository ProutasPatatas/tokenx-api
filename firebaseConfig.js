// initializeFirebase.js

const admin = require('firebase-admin');
const { readFile } = require('fs/promises');
const path = require('path');

const initializeFirebase = async () => {
  try {
    // Check if Firebase has already been initialized
    if (admin.apps.length === 0) {
      try {
        // Resolve the correct path to the service account key
        const serviceAccountPath = path.resolve('service-account-key.json');

        // Read and parse the service account key JSON file
        const serviceAccount = JSON.parse(await readFile(serviceAccountPath));

        // Initialize Firebase Admin SDK with the service account credentials
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } catch (error) {
        if (error.code === 'ENOENT') {
          // Specific error for missing file
          console.error(`Error: Service account key file not found at path: ${error.path}`);
        } else if (error instanceof SyntaxError) {
          // Specific error for JSON parsing
          console.error("Error: Invalid JSON format in service account key file.");
        } else {
          // Generic error for any other issues
          console.error("Error initializing Firebase Admin SDK:", error.message);
        }
        throw new Error("Firebase initialization failed.");
      }
    } else {
      console.log("Firebase is already initialized.");
    }

    // Return the Firestore instance
    return admin.firestore();
  } catch (error) {
    console.error("Critical error in Firebase initialization:", error);
    throw new Error("Firebase initialization failed.");
  }
};

module.exports = initializeFirebase;
