import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface UploadResult277 {
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

interface BillingFiles277State {
    selectedFiles: File[];
    uploadResults: UploadResult277[];
    failedFiles: Map<string, File>;
    failedFilesMetadata: Map<string, FileMetadata>;

    setSelectedFiles: (files: File[]) => void;
    addSelectedFiles: (files: File[]) => void;
    removeSelectedFile: (index: number) => void;
    clearSelectedFiles: () => void;

    setUploadResults: (results: UploadResult277[]) => void;
    addUploadResults: (results: UploadResult277[]) => void;
    removeUploadResult: (index: number) => void;
    clearUploadResults: () => void;

    storeFailedFile: (file: File) => void;
    getFailedFile: (filename: string) => File | undefined;
    removeFailedFile: (filename: string) => void;

    clearAll: () => void;
}

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

export const useBillingFiles277Store = create<BillingFiles277State>()(
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
            name: "billing-files-277-storage",
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({
                uploadResults: state.uploadResults,
                failedFilesMetadata: mapToArray(state.failedFilesMetadata),
            }),
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
