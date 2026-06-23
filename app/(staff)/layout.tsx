import { requireStaff, getImpersonatorSession } from "@/lib/auth";
import { hasLogo } from "@/lib/images";
import { getSchoolInfo } from "@/lib/cached";
import { getSchoolConfig } from "@/lib/school-config";
import Sidebar from "@/components/sidebar";
import { ImpersonationBanner } from "@/components/impersonation-banner";

export const dynamic = "force-dynamic";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaff();
  const [school, showLogo, config, impersonator] = await Promise.all([
    getSchoolInfo(),
    hasLogo(),
    getSchoolConfig(),
    getImpersonatorSession(),
  ]);

  return (
    <>
      {impersonator && (
        <ImpersonationBanner impersonated={session} impersonator={impersonator} />
      )}
      <div className={`min-h-screen lg:flex${impersonator ? " pt-10" : ""}`}>
        <Sidebar
          role={session.role}
          userName={session.name}
          schoolName={school?.name ?? "School Management System"}
          showLogo={showLogo}
          features={{
            feesEnabled: config.feesEnabled,
            timetableEnabled: config.timetableEnabled,
            analyticsEnabled: config.analyticsEnabled,
            attendanceEnabled: config.attendanceEnabled,
          }}
        />
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </>
  );
}
