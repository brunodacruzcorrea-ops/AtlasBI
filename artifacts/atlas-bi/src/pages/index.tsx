import { useEffect } from "react";
import { useLocation } from "wouter";

export default function RootRedirect() {
  const [_, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation("/dashboard");
  }, [setLocation]);
  
  return null;
}
