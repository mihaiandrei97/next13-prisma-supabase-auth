import Login from "@/app/_components/Login"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const supabase = createServerComponentClient({ cookies });
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    redirect('/');
  }
  
  return <main className="max-w-lg m-auto">
    <h1 className="text-2xl text-center mb-6">Login</h1>
    <Login />
  </main>
}
