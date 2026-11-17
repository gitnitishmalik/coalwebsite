"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="email" name="email" type="email" required autoComplete="username" placeholder="you@gmail.com" defaultValue={state?.email} className="h-11 pl-9" autoFocus />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} required autoComplete="current-password" className="h-11 pr-11" />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-critical">
          {state.error}
        </p>
      )}
      <Button type="submit" className="h-11 w-full text-[15px]" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : <LogIn />} Sign in
      </Button>
    </form>
  );
}
