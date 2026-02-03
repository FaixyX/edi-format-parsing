import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface UploadResult {
    filename: string;
    success: boolean;
    error?: string;
    task_id?: string;
    agency_name?: string;
    npi?: string;
}

interface FileMetadata {
    name: string;
    size: number;
    type: string;
    lastModified: number;
}

interface BillingFilesState {
    // Selected files (in memory only - File objects can't be serialized)
    selectedFiles: File[];

    // Upload results (persisted)
    uploadResults: UploadResult[];

    // Failed files for retry (in memory only - File objects can't be serialized)
    failedFiles: Map<string, File>;

    // Failed files metadata for retry (persisted)
    failedFilesMetadata: Map<string, FileMetadata>;

    // Actions
    setSelectedFiles: (files: File[]) => void;
    addSelectedFiles: (files: File[]) => void;
    removeSelectedFile: (index: number) => void;
    clearSelectedFiles: () => void;

    setUploadResults: (results: UploadResult[]) => void;
    addUploadResults: (results: UploadResult[]) => void;
    removeUploadResult: (index: number) => void;
    clearUploadResults: () => void;

    // Store failed file for retry
    storeFailedFile: (file: File) => void;
    getFailedFile: (filename: string) => File | undefined;
    removeFailedFile: (filename: string) => void;

    // Clear everything
    clearAll: () => void;
}

// Helper to convert Map to/from array for persistence
const mapToArray = (
    map: Map<string, FileMetadata>
): [string, FileMetadata][] => {
    return Array.from(map.entries());
};

const arrayToMap = (
    array: [string, FileMetadata][]
): Map<string, FileMetadata> => {
    return new Map(array);
};

export const useBillingFilesStore = create<BillingFilesState>()(
    persist(
        (set, get) => ({
            selectedFiles: [],
            uploadResults: [],
            failedFiles: new Map(),
            failedFilesMetadata: new Map(),

            setSelectedFiles: (files) => set({ selectedFiles: files }),

            addSelectedFiles: (files) =>
                set((state) => {
                    const existing = new Set(
                        state.selectedFiles.map((f) => `${f.name}-${f.size}`)
                    );
                    const newFiles = files.filter(
                        (f) => !existing.has(`${f.name}-${f.size}`)
                    );
                    return {
                        selectedFiles: [...state.selectedFiles, ...newFiles],
                    };
                }),

            removeSelectedFile: (index) =>
                set((state) => ({
                    selectedFiles: state.selectedFiles.filter(
                        (_, i) => i !== index
                    ),
                })),

            clearSelectedFiles: () => set({ selectedFiles: [] }),

            setUploadResults: (results) => set({ uploadResults: results }),

            addUploadResults: (results) =>
                set((state) => ({
                    uploadResults: [...state.uploadResults, ...results],
                })),

            removeUploadResult: (index) =>
                set((state) => ({
                    uploadResults: state.uploadResults.filter(
                        (_, i) => i !== index
                    ),
                })),

            clearUploadResults: () => set({ uploadResults: [] }),

            storeFailedFile: (file) =>
                set((state) => {
                    const metadata: FileMetadata = {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        lastModified: file.lastModified,
                    };
                    const newFilesMap = new Map(state.failedFiles);
                    newFilesMap.set(file.name, file);
                    const newMetadataMap = new Map(state.failedFilesMetadata);
                    newMetadataMap.set(file.name, metadata);
                    return {
                        failedFiles: newFilesMap,
                        failedFilesMetadata: newMetadataMap,
                    };
                }),

            getFailedFile: (filename) => {
                const state = get();
                return state.failedFiles.get(filename);
            },

            removeFailedFile: (filename) =>
                set((state) => {
                    const newFilesMap = new Map(state.failedFiles);
                    newFilesMap.delete(filename);
                    const newMetadataMap = new Map(state.failedFilesMetadata);
                    newMetadataMap.delete(filename);
                    return {
                        failedFiles: newFilesMap,
                        failedFilesMetadata: newMetadataMap,
                    };
                }),

            clearAll: () =>
                set({
                    selectedFiles: [],
                    uploadResults: [],
                    failedFiles: new Map(),
                    failedFilesMetadata: new Map(),
                }),
        }),
        {
            name: "billing-files-storage",
            // Using sessionStorage - persists only for current tab (clears when tab closes)
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({
                // Only persist upload results and failed files metadata
                // File objects can't be serialized, so selectedFiles and failedFiles are excluded
                uploadResults: state.uploadResults,
                failedFilesMetadata: mapToArray(state.failedFilesMetadata),
            }),
            // Custom merge function to handle Map deserialization
            merge: (persistedState: any, currentState) => {
                return {
                    ...currentState,
                    uploadResults:
                        persistedState?.uploadResults ||
                        currentState.uploadResults,
                    failedFilesMetadata: persistedState?.failedFilesMetadata
                        ? arrayToMap(persistedState.failedFilesMetadata)
                        : currentState.failedFilesMetadata,
                };
            },
        }
    )
);
