import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata = { title: "Me · IndiStream" };

export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  return (
    <section className="stub">
      <h1>Welcome.</h1>
      <p>
        Signed in as <strong>{user.email}</strong>.
      </p>
      <p style={{ fontSize: 14, color: "var(--ink-mute)" }}>
        Artist onboarding (creating your profile, listing works) ships in the
        next slice.
      </p>
      <SignOutButton />
    </section>
  );
}
