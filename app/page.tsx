import { redirect } from "next/navigation";

/* Semua menu kini punya URL sendiri — root cukup melempar ke beranda.
 * Guard sesi ada di app/(app)/layout.tsx (belum login -> /login). */
export default function Page() {
  redirect("/beranda");
}
