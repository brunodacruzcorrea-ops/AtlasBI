import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/components/auth-provider";

// Admin abre o dashboard; vendedor abre o app de comissoes, que e a tela
// pensada para o celular.
export default function RootRedirect() {
  const [, setLocation] = useLocation();
  const { isLoading, user, isAdmin } = useAuth();

  useEffect(() => {
    if (isLoading || !user) return;
    setLocation(isAdmin ? "/dashboard" : "/comissoes");
  }, [isLoading, user, isAdmin, setLocation]);

  return null;
}
