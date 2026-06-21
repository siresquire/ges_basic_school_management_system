import { redirect } from "next/navigation";

// Signature management moved to the account page (avatar at the bottom of the sidebar).
export default function ProfilePage() {
  redirect("/account");
}
