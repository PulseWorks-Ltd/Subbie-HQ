import { AcceptInviteForm } from "@/components/invite/accept-invite-form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <AcceptInviteForm token={token} />
      </div>
    </div>
  );
}
