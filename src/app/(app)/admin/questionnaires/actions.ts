
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { requireAdminSession } from '@/lib/auth';
import type { Questionnaire } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';

/**
 * Fetches the latest version of each questionnaire template.
 * @returns A promise that resolves to an array of the latest Questionnaire objects.
 */
export async function getLatestQuestionnairesAction(): Promise<Questionnaire[]> {
  await requireAdminSession();
  try {
    const snapshot = await adminDb.collection('questionnaires').get();
    if (snapshot.empty) {
      return [];
    }

    // Firestore timestamps need to be converted to serializable format (ISO string)
    const allQuestionnaires: Questionnaire[] = snapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt as Timestamp | undefined;
      const updatedAt = data.updatedAt as Timestamp | undefined;
      return {
        ...data,
        createdAt: createdAt ? createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: updatedAt ? updatedAt.toDate().toISOString() : new Date().toISOString(),
      } as Questionnaire;
    });

    const latestVersions = new Map<string, Questionnaire>();

    for (const q of allQuestionnaires) {
      if (!latestVersions.has(q.templateId) || q.version > latestVersions.get(q.templateId)!.version) {
        latestVersions.set(q.templateId, q);
      }
    }

    return Array.from(latestVersions.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (error: any) {
    if (error.code === 5) { // 5 is NOT_FOUND
      console.error(
        "Firestore error (NOT_FOUND): Could not find the 'questionnaires' collection. " +
        "Please make sure you have created a Firestore database in your Firebase project. " +
        "Returning an empty array for now."
      );
      return []; // Gracefully return an empty array to prevent the page from crashing.
    }
    // For other errors, re-throw them.
    console.error("An unexpected error occurred while fetching questionnaires:", error);
    throw error;
  }
}

/**
 * Fetches all active questionnaires of a specific type.
 * @param type The type of questionnaire to fetch ('self' or 'peer').
 * @returns A promise that resolves to an array of active Questionnaire objects.
 */
export async function getActiveQuestionnairesAction(type: 'self' | 'peer'): Promise<Questionnaire[]> {
    await requireAdminSession();
    try {
      const snapshot = await adminDb.collection('questionnaires')
          .where('isActive', '==', true)
          .where('type', '==', type)
          .orderBy('name', 'asc')
          .get();

      if (snapshot.empty) {
          return [];
      }

      return snapshot.docs.map(doc => {
          const data = doc.data();
          const createdAt = data.createdAt as Timestamp | undefined;
          const updatedAt = data.updatedAt as Timestamp | undefined;
          return {
            ...data,
            createdAt: createdAt ? createdAt.toDate().toISOString() : new Date().toISOString(),
            updatedAt: updatedAt ? updatedAt.toDate().toISOString() : new Date().toISOString(),
          } as Questionnaire;
      });
    } catch (error: any) {
       if (error.code === 9) { // 9 is FAILED_PRECONDITION for missing index
        console.error(
          "Firestore error: The query for active questionnaires requires a composite index. " +
          "Please check the error details below for a link to create it in your Firebase console.",
          error
        );
        return [];
      }
       if (error.code === 5) { // 5 is NOT_FOUND
        console.error(
          "Firestore error (NOT_FOUND) while querying active questionnaires. " +
          "This might mean the 'questionnaires' collection does not exist. Returning an empty array."
        );
        return []; // Gracefully return an empty array.
      }
      // For other errors, re-throw them.
      console.error(`An unexpected error occurred while fetching active ${type} questionnaires:`, error);
      throw error;
    }
}


/**
 * Saves a questionnaire, handling versioning.
 * If it's a new questionnaire, it creates version 1.
 * If it's an existing one, it archives the old version and creates a new one.
 * @param data The questionnaire data to save.
 */
export async function saveQuestionnaireAction(
  data: Partial<Omit<Questionnaire, 'createdAt' | 'updatedAt'>> & Pick<Questionnaire, 'name' | 'type' | 'questions'>
) {
  await requireAdminSession();
  const questionnairesRef = adminDb.collection('questionnaires');
  const now = Timestamp.now();

  // If data.id exists, we are creating a new version of an existing questionnaire.
  if (data.id && data.templateId) {
    const oldDocRef = questionnairesRef.doc(data.id);
    const newDocRef = questionnairesRef.doc(); // Create a new document for the new version

    await adminDb.runTransaction(async (transaction) => {
      const oldDoc = await transaction.get(oldDocRef);
      if (!oldDoc.exists) {
        throw new Error("Document to update does not exist!");
      }
      
      // Archive the old version
      transaction.update(oldDocRef, { isActive: false, updatedAt: now });

      // Create the new version
      transaction.set(newDocRef, {
        ...data,
        id: newDocRef.id,
        version: (oldDoc.data()?.version || 0) + 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    });
  } else { // This is a brand new questionnaire template.
    const newDocRef = questionnairesRef.doc();
    const templateId = newDocRef.id; // Use the first document's ID as the templateId

    await newDocRef.set({
      ...data,
      id: newDocRef.id,
      templateId: templateId,
      version: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidatePath('/admin/questionnaires');
}


/**
 * Deactivates all versions of a questionnaire template.
 * @param templateId The templateId of the questionnaire to deactivate.
 */
export async function deactivateQuestionnaireTemplateAction(templateId: string) {
    await requireAdminSession();
    const batch = adminDb.batch();
    const snapshot = await adminDb.collection('questionnaires').where('templateId', '==', templateId).get();
    
    if (snapshot.empty) return;

    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isActive: false, updatedAt: Timestamp.now() });
    });
    
    await batch.commit();
    revalidatePath('/admin/questionnaires');
}
