import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch user details for header
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
select: {
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      profileImage: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
   <div className="flex min-h-screen bg-stone-50 dark:bg-gray-950">
      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden lg:block sticky top-0 h-screen">
        <Sidebar role={user.role} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
<Header
          firstName={user.firstName}
          lastName={user.lastName}
          email={user.email}
          role={user.role}
          image={user.profileImage}
        />
    <main id="main-content" className="flex-1 p-4 lg:p-6 page-fade-in">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}