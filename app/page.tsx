import { Suspense } from "react";
import EnterpriseWorkspace from "./enterprise-workspace";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <EnterpriseWorkspace />
    </Suspense>
  );
}
