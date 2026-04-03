export const CommonServiceIds = {
  ProjectPageService: "mock-project-page-service",
};

export interface IProjectPageService {
  getProject(): Promise<{ name: string } | null>;
}
