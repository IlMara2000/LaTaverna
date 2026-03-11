import { storage, ID } from '../api/appwrite';

export const uploadAsset = async (file, bucketId) => {
    try {
        const response = await storage.createFile(bucketId, ID.unique(), file);
        
        // Genera URL per l'anteprima (ottimizzato per il web)
        const fileUrl = storage.getFileView(bucketId, response.$id);
        
        return { id: response.$id, url: fileUrl };
    } catch (error) {
        console.error("Errore upload:", error);
        throw error;
    }
};
