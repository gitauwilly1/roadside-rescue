import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Check if we have service account credentials in environment
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // If credentials are stored as a JSON string in environment variable
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log(' Firebase Admin initialized with service account');
    } 
    // Alternative: Use individual environment variables
    else if (process.env.FIREBASE_PROJECT_ID && 
             process.env.FIREBASE_PRIVATE_KEY && 
             process.env.FIREBASE_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
      console.log(' Firebase Admin initialized with env variables');
    }
    else {
      console.log(' Firebase Admin not configured. Google auth will not work.');
      console.log(' Add FIREBASE_SERVICE_ACCOUNT JSON to Railway environment variables');
    }
  } catch (error) {
    console.error(' Firebase Admin initialization error:', error);
  }
}

export const verifyFirebaseToken = async (idToken) => {
  try {
    if (!admin.apps.length) {
      throw new Error('Firebase Admin not initialized');
    }
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log(' Firebase token verified for:', decodedToken.email);
    return decodedToken;
  } catch (error) {
    console.error(' Firebase token verification error:', error);
    return null;
  }
};

export default admin;