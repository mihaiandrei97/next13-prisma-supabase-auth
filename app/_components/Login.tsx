"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });
    if (error) {
      setErrorMessage(error.message);
    } else {
      router.refresh();
    }
  };

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setErrorMessage(error.message);
    } else {
      router.refresh();
    }
  };

  return (
    <>
      {errorMessage && (
        <p className="bg-red-700 p-4">{errorMessage}</p>
      )}
      <form className="flex flex-col gap-4">
        <label className="grid">
          Email
          <input
            className="p-2 text-black"
            name="email"
            onChange={(e) => setEmail(e.target.value)}
            value={email}
          />
        </label>
        <label className="grid">
          Password
          <input
            className="p-2 text-black"
            type="password"
            name="password"
            onChange={(e) => setPassword(e.target.value)}
            value={password}
          />
        </label>
        <button
          className="bg-gray-800 p-2"
          type="button"
          onClick={handleSignUp}
        >
          Sign up
        </button>
        <button
          className="bg-gray-800 p-2"
          type="button"
          onClick={handleSignIn}
        >
          Sign in
        </button>
      </form>
    </>
  );
}
