import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  auth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "@/config/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, Loader2 } from "lucide-react";

type Role = "admin" | "farmer" | "buyer";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
  }
}

export default function PhoneAuth() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "profile">("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState<Role | "">("");

  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { saveProfile, loading } = useAuth();

  // Always start fresh: sign out any existing Firebase session
  useEffect(() => {
    auth.signOut().catch(() => {});
  }, []);

  // Initialize reCAPTCHA once
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!auth) return;

    if (!window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          "recaptcha-container",
          {
            size: "invisible",
            callback: () => {
              // reCAPTCHA solved automatically for invisible mode
            },
          }
        );
      } catch (err) {
        console.error("reCAPTCHA init error:", err);
      }
    }

    return () => {
      // optional: tear down on unmount
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    };
  }, []);

  const redirectBasedOnRole = (r: Role) => {
    switch (r) {
      case "admin":
        navigate("/admin");
        break;
      case "farmer":
        navigate("/farmer-dashboard");
        break;
      default:
        navigate("/marketplace");
    }
  };

  const sendOTP = async () => {
    if (!phone || phone.length < 10) {
      toast({ title: t("invalidPhone"), variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;

      if (!auth) throw new Error("Auth not available");
      const appVerifier = window.recaptchaVerifier;
      if (!appVerifier) throw new Error("reCAPTCHA not initialized");

      const result = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        appVerifier
      );

      setConfirmationResult(result);
      window.confirmationResult = result;
      setStep("otp");
      toast({ title: t("otpSent") });
    } catch (error: any) {
      console.error("Send OTP error:", error);
      toast({
        title: t("error"),
        description: error.message || "Failed to send OTP",
        variant: "destructive",
      });

      // Reset reCAPTCHA on error so it can be used again
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast({ title: t("invalidOtp"), variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const conf = confirmationResult || window.confirmationResult;
      if (!conf) throw new Error("No confirmation result");

      await conf.confirm(otp);
      toast({ title: t("loginSuccess") });
      setStep("profile");
    } catch (error: any) {
      console.error("Verify OTP error:", error);
      toast({
        title: t("error"),
        description: error.message || "Invalid OTP",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const submitProfile = async () => {
    if (!name.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!role) {
      toast({ title: "Please select a role", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      await saveProfile(name.trim(), role as Role);
      toast({ title: t("loginSuccess") });
      redirectBasedOnRole(role as Role);
    } catch (error: any) {
      console.error("Save profile error:", error);
      toast({
        title: t("error"),
        description: error.message || "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-warm">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-warm p-4">
      <Card className="w-full max-w-md shadow-medium">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <span className="text-6xl">🌾</span>
          </div>
          <CardTitle className="text-2xl bg-gradient-primary bg-clip-text text-transparent">
            {t("appName")}
          </CardTitle>
          <CardDescription>{t("tagline")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === "phone" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("phone")}</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 bg-muted rounded-l-md border border-r-0">
                    +91
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    className="rounded-l-none"
                  />
                </div>
              </div>
              <Button
                onClick={sendOTP}
                className="w-full bg-gradient-primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {t("sendOtp")} <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          )}

          {step === "otp" && (
            <>
              <div className="text-center text-sm text-muted-foreground mb-4">
                {t("otpSentTo")} +91{phone}
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp">{t("enterOtp")}</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                />
              </div>
              <Button
                onClick={verifyOTP}
                className="w-full bg-gradient-primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("verifyOtp")
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                }}
              >
                {t("changePhone")}
              </Button>
            </>
          )}

          {step === "profile" && (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={role === "buyer" ? "default" : "outline"}
                      onClick={() => setRole("buyer")}
                    >
                      Buyer
                    </Button>
                    <Button
                      type="button"
                      variant={role === "farmer" ? "default" : "outline"}
                      onClick={() => setRole("farmer")}
                    >
                      Farmer
                    </Button>
                    <Button
                      type="button"
                      variant={role === "admin" ? "default" : "outline"}
                      onClick={() => setRole("admin")}
                    >
                      Admin
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={submitProfile}
                  className="w-full bg-gradient-primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* reCAPTCHA container (must exist in DOM) */}
      <div id="recaptcha-container" />
    </div>
  );
}
