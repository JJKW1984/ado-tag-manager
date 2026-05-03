export const CommonServiceIds = {
  ProjectPageService: "ms.vss-tfs-web.tfs-page-data-service",
  ExtensionDataService: "ms.vss-features.extension-data-service",
};

export interface IProjectPageService {
  getProject(): Promise<{ name: string } | null>;
}

export interface IExtensionDataManager {
  getValue<T>(key: string, documentId?: string): Promise<T>;
  setValue<T>(key: string, value: T, documentId?: string): Promise<T>;
}

export interface IExtensionDataService {
  getExtensionDataManager(extensionId: string, accessToken: string): Promise<IExtensionDataManager>;
}
