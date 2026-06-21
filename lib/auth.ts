import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Role = "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";

export type Session = {
  userId: string;
  username: string;
  name: string;
  role: Role;
};

const SESSION_COOKIE = "sms_session";
const IMP_COOKIE = "sms_imp";
const SESSION_HOURS = 8;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET environment variable must be set in production");
  }
  return new TextEncoder().encode(secret ?? "insecure-dev-secret");
}

export async function createSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // No maxAge/expires — session cookie, cleared when the browser closes
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function startImpersonation(target: Session) {
  const jar = await cookies();
  const currentToken = jar.get(SESSION_COOKIE)?.value;
  if (currentToken) {
    jar.set(IMP_COOKIE, currentToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  await createSession(target);
}

export async function stopImpersonation() {
  const jar = await cookies();
  const origToken = jar.get(IMP_COOKIE)?.value;
  if (!origToken) return;
  jar.set(SESSION_COOKIE, origToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  jar.delete(IMP_COOKIE);
}

export async function getImpersonatorSession(): Promise<Session | null> {
  const token = (await cookies()).get(IMP_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

/** Where each role lands after login. */
export function homeFor(role: Role) {
  if (role === "STUDENT" || role === "PARENT") return "/portal";
  if (role === "SUPER_ADMIN") return "/super-admin";
  return "/";
}

export async function requireSession(): Promise<Session> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as Session;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "ERR_JWT_EXPIRED") {
      redirect("/login?expired=1");
    }
    redirect("/login");
  }
}

export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect(homeFor(session.role));
  return session;
}

export const requireStaff = () => requireRole("SUPER_ADMIN", "ADMIN", "TEACHER");
export const requireAdmin = () => requireRole("SUPER_ADMIN", "ADMIN");
export const requireSuperAdmin = () => requireRole("SUPER_ADMIN");
export const requirePortal = () => requireRole("STUDENT", "PARENT");
