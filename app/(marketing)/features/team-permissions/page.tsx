import type { Metadata } from "next";
import { FeaturePageView } from "@/components/marketing/feature-page-view";

export const metadata: Metadata = {
  title: "Team & Permissions for Subcontractors | Subbie HQ",
  description:
    "Bring your whole team onto Subbie HQ, with each person seeing exactly what their role needs — never charged extra for adding another user."
};

export default function TeamPermissionsPage() {
  return (
    <FeaturePageView
      h1="The Right Access for the Right Person — Every Plan, No Extra Charge"
      problem="A site supervisor doesn't need to see your Contract Review or your commercial settings. Your office admin doesn't need to be logging Day Works from a truck. Most software makes you choose between one shared login for everyone, or paying per seat to tell them apart."
      consequence="Either everyone sees everything — including the parts that are none of their business — or you're stuck adding logins one at a time and watching the bill climb every time the crew grows."
      helps={[
        "Invite your whole team — unlimited users, on every plan, always. Nobody gets charged more for being busy or for growing.",
        "Give each person exactly the access their role needs: ready-made presets for Admin, Operations/Project Manager, Supervisor, or Health & Safety Only, or set it module by module yourself. A supervisor can get Site Instructions, Photos, and Health & Safety without ever seeing Contract Review or Settings.",
        "Real organisation-level accounts, not a shared password — every action is attributed to the person who actually took it."
      ]}
      outcome="Everyone on the job has exactly the access they need, and nobody's paying more for a bigger team."
    />
  );
}
