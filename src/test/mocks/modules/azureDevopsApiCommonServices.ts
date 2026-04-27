export const CommonServiceIds = {
  ProjectPageService: "ms.vss-tfs-web.tfs-page-data-service",
  ExtensionDataService: "ms.vss-features.extension-data-service",
};

export interface IProjectPageService {
  getProject(): Promise<{ name: string } | null>;
}

export interface IExtensionDataService {
  getExtensionDataManager(extensionId: string, accessToken: string): Promise<unknown>;
}
