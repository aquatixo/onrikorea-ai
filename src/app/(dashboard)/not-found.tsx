import { NotFoundScreen } from "@/components/not-found-screen";

// notFound() from a dashboard page (deleted brand, bad id in the URL, ...) -- rendered
// inside the dashboard layout so the sidebar stays and the user can just click away.
export default function DashboardNotFound() {
  return <NotFoundScreen />;
}
