import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Check if Firebase Admin is already initialized
if (!admin.apps.length) {
  // For production, you'll need to download service account JSON from Firebase Console
  // For development, we can use environment variables
  try {
    // If you have a service account JSON file, use:
    // admin.initializeApp({
    //   credential: admin.credential.cert(serviceAccount),
    // });
    
    // For now, we'll use a placeholder - you'll need to add actual credentials
    console.log('⚠️ Firebase Admin not configured. Google auth will not work.');
    console.log('📌 To enable Google auth, add Firebase service account credentials');
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

export const verifyFirebaseToken = async (idToken) => {
  try {
    if (!admin.apps.length) {
      throw new Error('Firebase Admin not initialized');
    }
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Firebase token verification error:', error);
    return null;
  }
};

export default admin;