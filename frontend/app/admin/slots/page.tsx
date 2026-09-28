import { redirect } from "next/navigation";

export default function AdminSlotsRedirectPage() {
  redirect("/admin/schedule");
}
