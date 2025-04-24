import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin: Showcases",
};

export default function AdminShowcasesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Showcase Management</h1>
      <p>Manage submitted showcases (Admin only).(Coming soon)</p>
    </div>
  );
}
