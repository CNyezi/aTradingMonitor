import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin: Blogs",
};

export default function AdminBlogsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Blog Management</h1>
      <p>Manage blog posts (Admin only).(Coming soon)</p>
    </div>
  );
}
