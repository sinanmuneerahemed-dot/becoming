import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function CheckinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
