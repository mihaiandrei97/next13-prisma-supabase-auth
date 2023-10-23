## Introduction

Authentication is a critical aspect of many web applications, and it can sometimes be a complex task. In this article, I will walk you through the process of implementing Supabase Auth in a NextJS 13 application while using Prisma for database interaction. I'll provide step-by-step instructions and explanations to help you understand the entire process.

If you want to skip the tutorial and jump right in the action, you can find the code [here](https://github.com/mihaiandrei97/next13-prisma-supabase-auth).

## The Challenge of Using Supabase Auth with Prisma

Supabase Auth is a powerful package that simplifies authentication in your web applications. However, it manages the user table in a database schema called `auth`, while Prisma typically uses the `public` schema. This difference makes it challenging to establish foreign key relations between your tables and the `auth.users` table. To address this issue, you might consider using Prisma's preview feature called `multiSchema`. But this approach has its drawbacks, such as pulling unnecessary tables and potential structural changes by Supabase in the future.

### The Solution: Creating a Custom `profile` Table with Database Triggers

To overcome these challenges, we will be creating a custom `profile` table and we will use database triggers. This approach allows us to manage user data efficiently while maintaining a flexible and scalable architecture.

Here is a diagram of the implementation:

![Authentication Flow](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/pc9xuxfn10a6zsjzuuu6.png)

Adding user auth to the application using supabase is pretty easy. We just use the `supabase-js` library, and we call a method to sign-in or sign-up. After that, supabase will handle everything:

- inserting the user in db;
- generating jwt tokens;
- merging the user if you use multiple auth providers with the same email etc.

In order to use the user in prisma, we will create a database trigger that will listen for inserts into `auth.users` and create an entry in our `profile` table. In reverse, when we want to delete a user, we will have a trigger on `profile` to delete the corresponding record from `auth.users`.

## Setting Up Your Next.js Project

Before we dive into the technical details, let's start by creating a new Next.js project. At the time of writing this article, Next.js had version 13.5.5. Begin by setting up your project using the following command:

```bash
npx create-next-app
```

![Create next app](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/swgv5xfgc4dhzt2bj1he.png)

## Gathering Supabase Environment Variables

For a successful integration with Supabase, you need to create a Supabase project and collect three essential environment variables. These variables will enable your Next.js application to communicate with Supabase.

- **NEXT_PUBLIC_SUPABASE_URL**: Your Supabase project's URL.
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Your Supabase project's anonymous key.
- **DATABASE_URL**: Your database connection URL.

From SETTINGS -> API: **NEXT_PUBLIC_SUPABASE_URL** and **NEXT_PUBLIC_SUPABASE_ANON_KEY**.

From SETTINGS -> DATABASE -> Connection string -> nodejs: **DATABASE_URL**.

![Connection string](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/04ejovi4rm0o0n5tter4.png)

Also, from the settings, **disable email confirmation** in order to make our login process easier for the purpose of this tutorial:
![Email confirmation](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/zeytgnhrn282o4wapnwj.png)

Don't worry, the same login flow will work for Github, Google or any other provider you choose.

## Installing Prisma and Configuring the Database

To use Prisma in your project, you need to install it and configure the database connection. Here's the step-by-step process:

1. Install Prisma and Prisma Client.

   ```bash
   npm install -D prisma
   npm install @prisma/client
   npx prisma init
   ```

2. Define your Prisma schema in the `schema.prisma` file.

   ```prisma
   generator client {
     provider = "prisma-client-js"
   }

   datasource db {
     provider = "postgresql"
     url = env("DATABASE_URL")
   }

   enum Role {
     admin
     user
   }

   model Profile {
     id    String @id @db.Uuid
     role  Role   @default(user)
     notes Note[]

     @@map("profile")
   }

   model Note {
     id   String @id @default(uuid()) @db.Uuid
     text String

     user   Profile @relation(fields: [userId], references: [id], onDelete: Cascade, onUpdate: Cascade)
     userId String  @db.Uuid

     @@map("note")
   }
   ```

   Then, as discussed in the diagram above, we need some DB triggers. Since we don't want to give prisma access to the `auth` schema, because we will need to pull all the tables ( and supabase has a lot of them), we will use another library to add our trigers.

3. Create a file for adding database triggers using Node.js.

   ```bash
   npm install dotenv postgres tsx
   ```

   ```tsx
   // File: /lib/seedTriggers.ts

   import postgres from "postgres";
   import "dotenv/config";

   const dbUrl = process.env.DATABASE_URL;

   if (!dbUrl) {
     throw new Error("Couldn't find db url");
   }
   const sql = postgres(dbUrl);

   async function main() {
     await sql`
        create or replace function public.handle_new_user()
        returns trigger as $$
        begin
            insert into public.profile (id)
            values (new.id);
            return new;
        end;
        $$ language plpgsql security definer;
        `;
     await sql`
        create or replace trigger on_auth_user_created
            after insert on auth.users
            for each row execute procedure public.handle_new_user();
      `;

     await sql`
        create or replace function public.handle_user_delete()
        returns trigger as $$
        begin
          delete from auth.users where id = old.id;
          return old;
        end;
        $$ language plpgsql security definer;
      `;

     await sql`
        create or replace trigger on_profile_user_deleted
          after delete on public.profile
          for each row execute procedure public.handle_user_delete()
      `;

     console.log(
       "Finished adding triggers and functions for profile handling."
     );
     process.exit();
   }

   main();
   ```

4. Update your `package.json` to include a script for running migrations and adding triggers.

   ```json
   "scripts": {
       "dev": "next dev",
       "build": "next build",
       "start": "next start",
       "lint": "next lint",
       "migrate-dev": "npx prisma migrate dev && npx tsx lib/seedTriggers.ts"
   }
   ```

   Run the migration using `npm run migrate-dev` and provide a name (e.g., "init") to create the tables in Supabase and add your triggers. After that, we can check supabase to see if the tables were created.

   ![table list](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/130le1avjpcky5lidw5s.png)

   Another thing that you will need to do is for each table that is created, manually enable RLS:

   ![Row level security](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/xsk71gmx32pfwuyq9swj.png)

## Setting Up Prisma Connection

Create a file called `lib/db.ts` and include the following code to set up your Prisma connection.

```tsx
import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
```

We will use this later on an admin page to get the profile of the user in order to see if he has the right role. Next, let's setup supabase login.

## Setting Up Supabase Login and Registration

We will now configure Supabase authentication in our Next.js application. This part is inspired by the official Supabase documentation, which you can find [here](https://supabase.com/docs/guides/auth/auth-helpers/nextjs). You can also watch a video tutorial by [Jon Meyers](https://twitter.com/jonmeyers_io) at the following [link](https://www.youtube.com/watch?v=-7K6DRWfEGM).

### Install Dependencies

```bash
npm install @supabase/auth-helpers-nextjs @supabase/supabase-js
```

### Create a Middleware for Supabase

Create a `middleware.ts` file in the root of your project to configure Supabase middleware.

```tsx
// File: middleware.ts

import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const res = NextResponse.next();

  // Create a Supabase client configured to use cookies
  const supabase = createMiddlewareClient({ req, res });

  // Refresh session if expired - required for Server Components
  await supabase.auth.getSession();

  return res;
}
```

### Implement Code Exchange Route

In your `app/auth/callback/route.ts`, set up the code exchange route.

```tsx
// File: app/auth/callback/route.ts

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(requestUrl.origin);
}
```

### Create Supabase Client Components

Now, let's create client components to interact with Supabase for authentication. You could also create server components instead, as explained in the supabase [docs](https://supabase.com/docs/guides/auth/auth-helpers/nextjs).

#### Create `app/_components/Login.tsx`

```tsx
// File: app/_components/Login.tsx

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
      {errorMessage && <p className="bg-red-700 p-4">{errorMessage}</p>}
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
```

#### Create `app/_components/Logout.tsx`

```tsx
// File: app/_components/Logout.tsx

"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

export default function Logout() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <>
      <button onClick={handleSignOut}>Sign out</button>
    </>
  );
}
```

## Creating the main application pages

Now, let's set up the pages of our application, starting with the home page.

### Create `app/page.tsx`

```tsx
// File: app/page.tsx
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function Home() {
  const supabase = createServerComponentClient({ cookies });
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) {
    redirect("/login");
  }

  const notes = await prisma.note.findMany({
    where: { userId: data.session.user.id },
  });
  return (
    <main>
      <h1 className="text-2xl text-center mb-8">Protected page</h1>
      <pre>{JSON.stringify({ session: data.session, notes }, null, 4)}</pre>
    </main>
  );
}
```

After you add this code, the `/` route cannot be accessed anymore. If you try going to it, you will be redirected to `/login`. But we don't have that page yet, so you will see a 404 error.

### Create `app/login/page.tsx`

```tsx
// File: app/login/page.tsx
import Login from "@/app/_components/Login";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const supabase = createServerComponentClient({ cookies });
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    redirect("/");
  }

  return (
    <main className="max-w-lg m-auto">
      <h1 className="text-2xl text-center mb-6">Login</h1>
      <Login />
    </main>
  );
}
```

Now, if you go to the login page, and sign-up, you will be redirected to `/` and you will be able to see your session.

The last thing we are going to implement is an admin route. This one is pretty similar with the root page, with just an extra check.

### Create `app/admin/page.tsx`

```tsx
// File: app/admin/page.tsx
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function Home() {
  const supabase = createServerComponentClient({ cookies });
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { id: data.session.user.id },
  });

  if (profile?.role !== "admin") {
    redirect("/");
  }

  return (
    <main>
      <h1 className="text-2xl text-center mb-8">Admin page</h1>
      <pre>{JSON.stringify({ profile }, null, 4)}</pre>
    </main>
  );
}
```

All we need to do is just get the profile based on the supabase user id, and check the role. Pretty easy right? :D

## Conclusion

In this guide, we learned the process of implementing Supabase Auth in a Next13 application while using Prisma for database interaction. We've covered the challenges of combining these technologies and provided solutions to create a flexible and efficient authentication system. With Supabase and Prisma, you can build robust web applications with ease.

**And that's it. 🎉🎉🎉**
If you have any questions, feel free to reach up in the comments section.

Code available on [GitHub](https://github.com/mihaiandrei97/next13-prisma-supabase-auth).
