import React, { createContext, useContext, useEffect } from "react";
import { useGetMe, getGetMeQueryKey, setAuthTokenGetter } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

// Configure the API client to always attach the bearer token from localStorage
setAuthTokenGetter(() => localStorage.getItem("atlas_token"));

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  // Centralizado aqui para que as telas nao repitam a comparacao de string —
  // era assim que a checagem de admin ficava espalhada e facil de esquecer.
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const token = localStorage.getItem("atlas_token");
  
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  useEffect(() => {
    if (!isLoading) {
      if ((isError || !token) && location !== "/login") {
        setLocation("/login");
      }
    }
  }, [isLoading, isError, token, location, setLocation]);

  // If loading and we have a token, show a loading state
  if (isLoading && token && location !== "/login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-accent animate-spin" />
          <p className="text-muted-foreground text-sm font-medium tracking-wide">INITIALIZING ATLAS BI...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        isLoading,
        user,
        isAdmin: user?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
