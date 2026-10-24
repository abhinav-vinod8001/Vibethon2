import { WorkspaceEntry } from "@/features/language/WorkspaceEntry";
import { BootstrapProvider } from "@/features/workspace/useBootstrap";
export default function Home() {
  return (
    <BootstrapProvider>
      <WorkspaceEntry />
    </BootstrapProvider>
  );
}
