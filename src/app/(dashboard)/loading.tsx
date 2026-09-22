import { BrandMark } from "@/components/brand-mark";

// Without this, only the root src/app/loading.tsx boundary exists -- and since
// (dashboard)/layout.tsx (the sidebar) stays mounted across in-app navigation, that
// root boundary only ever fires on the very first load into the dashboard, never on
// page-to-page navigation within it. This one sits below the persistent sidebar layout
// so it actually catches those transitions.
export default function DashboardLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background sm:left-64">
      <BrandMark animated size={72} />
    </div>
  );
}
