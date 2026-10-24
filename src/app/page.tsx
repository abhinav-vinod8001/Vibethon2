import { WorkspaceEntry } from "@/features/language/WorkspaceEntry";
import { BootstrapProvider } from "@/features/workspace/useBootstrap";
import { cookies } from "next/headers";
import { isEntryRole, ROLE_COOKIE } from "@/features/language/role";

export default async function Home() {
  const savedRole = (await cookies()).get(ROLE_COOKIE)?.value;
  const initialRole = isEntryRole(savedRole) ? savedRole : null;
  return (
    <BootstrapProvider>
      <WorkspaceEntry initialRole={initialRole} />
    </BootstrapProvider>
  );
}
