import { redirect } from "next/navigation";

import { getCurrent } from "@/features/auth/queries";

export default async function Home() {
  const user = await getCurrent();
  if (!user) redirect("/sign-in");
  
  return (
    <div>
      This is Home page
    </div>
  );
};
