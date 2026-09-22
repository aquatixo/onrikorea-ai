"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  callbackUrl: string,
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: callbackUrl || "/",
    });
  } catch (error) {
    // signIn redirects internally on success by throwing a special Next.js redirect
    // signal -- only AuthError (a real failed sign-in) should be turned into a form
    // error here, everything else must be rethrown so that redirect actually happens.
    if (error instanceof AuthError) {
      return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
    }
    throw error;
  }
}
