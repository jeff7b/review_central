import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64) {
    try {
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, falling back to default credentials:', e);
      admin.initializeApp();
    }
  } else {
    // In Firebase App Hosting, Cloud Run, or during Next.js build page collection,
    // initialize using Application Default Credentials (ADC) instead of crashing the build.
    try {
      admin.initializeApp();
    } catch (e) {
      console.warn('Firebase Admin initialized without credentials (build/fallback):', e);
    }
  }
}

const adminDb = getFirestore();
const adminAuth = getAuth();

export { adminDb, adminAuth };
