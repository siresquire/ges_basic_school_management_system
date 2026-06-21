import { cache } from "react";
import { prisma } from "@/lib/db";

export type SchoolConfig = {
  id: number;
  enabledLevels: string;
  feesEnabled: boolean;
  timetableEnabled: boolean;
  analyticsEnabled: boolean;
  portalEnabled: boolean;
  transcriptsEnabled: boolean;
  attendanceEnabled: boolean;
};

// All levels on — the safe default for databases that have no config row yet.
const DEFAULT_CONFIG: SchoolConfig = {
  id: 1,
  enabledLevels: "KG,PRIMARY,JHS",
  feesEnabled: true,
  timetableEnabled: true,
  analyticsEnabled: true,
  portalEnabled: true,
  transcriptsEnabled: true,
  attendanceEnabled: true,
};

export const getSchoolConfig = cache(async (): Promise<SchoolConfig> => {
  const cfg = await prisma.schoolConfig.findUnique({ where: { id: 1 } });
  return cfg ?? DEFAULT_CONFIG;
});

export async function getEnabledLevels(): Promise<string[]> {
  const cfg = await getSchoolConfig();
  return cfg.enabledLevels.split(",").filter(Boolean);
}

export async function isLevelEnabled(stage: string): Promise<boolean> {
  const levels = await getEnabledLevels();
  return levels.includes(stage);
}
