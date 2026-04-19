import "azure-devops-ui/Components/Icon/Icon";

let initialized = false;

export function initializeIconSupport(): void {
  if (initialized) {
    return;
  }
  initialized = true;
}

