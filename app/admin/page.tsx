"use client";

import Dashboard from "./dashboard";
import LoginForm from "./login-form";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { markAdminSessionVerified, useAdminSession } from "./admin-session";

type Step = "login" | "otp";

export default function AdminPage() {
  const session = useAdminSession();
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  async function loginWithEmail() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Email veya şifre hatalı");
      return;
    }

    const userPhone = process.env.NEXT_PUBLIC_ADMIN_PHONE;

    if (!userPhone) {
      await supabase.auth.signOut({ scope: "local" });
      alert("NEXT_PUBLIC_ADMIN_PHONE .env.local içinde tanımlı değil.");
      return;
    }

    setPhone(userPhone);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: userPhone,
    });

    await supabase.auth.signOut({ scope: "local" });

    if (otpError) {
      alert("SMS gönderilemedi: " + otpError.message);
      return;
    }

    setStep("otp");
  }

  async function verifyOtpCode() {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });

    if (error) {
      return "Kod geçersiz veya süresi dolmuş. Lütfen tekrar deneyin.";
    }

    if (!data.session || !markAdminSessionVerified(data.session)) {
      await supabase.auth.signOut({ scope: "local" });
      setStep("login");
      alert("Yönetim oturumu başlatılamadı. Tekrar giriş yapın.");
      return;
    }
    setPassword("");
    setOtp("");
    setStep("login");
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) alert("Çıkış yapılamadı. Tekrar deneyin.");
  }

  if (session === "signedIn") {
    return <Dashboard onLogout={logout} />;
  }

  return step === "otp"
    ? <LoginForm key="otp" step="otp" code={otp} onCodeChange={setOtp} onSubmit={verifyOtpCode} />
    : <LoginForm key="login" step="login" email={email} password={password} onEmailChange={setEmail} onPasswordChange={setPassword} onSubmit={loginWithEmail} />;
}
