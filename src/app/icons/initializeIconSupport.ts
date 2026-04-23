import { Icon } from "azure-devops-ui/Icon";

let initialized = false;

export function initializeIconSupport(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  document.body.classList.add("fluent-icons-enabled");
}
