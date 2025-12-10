import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/config/firebase";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

type Role = "admin" | "farmer" | "buyer";

interface ProfileRow {
  id: string;
  phone: string | null;
  name?: string | null;
  role?: Role | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  profileId: string | null;
  userRole: Role | null;
  needsProfile: boolean;
  saveProfile: (name: string, role: Role) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  profileId: null,
  userRole: null,
  needsProfile: false,
  saveProfile: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(true);

      if (!firebaseUser) {
        setProfileId(null);
        setUserRole(null);
        setNeedsProfile(false);
        setLoading(false);
        return;
      }

      try {
        const phone = firebaseUser.phoneNumber ?? "";
        if (!phone) {
          setNeedsProfile(true);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("phone", phone)
          .maybeSingle<ProfileRow>();

        if (error) {
          console.error("Profile fetch error:", error);
        }

        const profile = data as ProfileRow | null;

        if (profile) {
          setProfileId(profile.id);
          setUserRole((profile.role as Role) ?? null);
          // 👇 TypeScript-safe: profile?.name / profile?.role are allowed
          setNeedsProfile(!profile.name || !profile.role);
        } else {
          setProfileId(null);
          setUserRole(null);
          setNeedsProfile(true);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const saveProfile = async (name: string, role: Role) => {
    if (!user) throw new Error("User not logged in");
    const phone = user.phoneNumber ?? "";
    if (!phone) throw new Error("Phone number missing");

    let id = profileId ?? uuidv4();

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id,
          phone,
          name,
          role,
        },
        { onConflict: "id" }
      )
      .select()
      .single<ProfileRow>();

    if (error) throw error;

    const profile = data as ProfileRow;
    setProfileId(profile.id);
    setUserRole((profile.role as Role) ?? null);
    setNeedsProfile(false);
  };

  const logout = async () => {
    await auth.signOut();
    setUser(null);
    setProfileId(null);
    setUserRole(null);
    setNeedsProfile(false);
    window.location.href = "/auth";
  };

  const value: AuthContextValue = {
    user,
    loading,
    profileId,
    userRole,
    needsProfile,
    saveProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
