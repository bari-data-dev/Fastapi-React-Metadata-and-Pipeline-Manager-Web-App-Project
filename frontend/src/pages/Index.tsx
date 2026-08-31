import {
  ArrowRight,
  Database,
  ShieldCheck,
  TableProperties,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import dataAnalyticsBg from "@/assets/data-analytics-bg.png";

type HomeFeature = {
  icon: typeof TableProperties;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
};

const Index = () => {
  const { user } = useAuth();
  const canViewUsers =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    user?.role === "TEAM";
  const canViewMasterData = user?.role !== "INTERN";

  const features: HomeFeature[] = [
    {
      icon: TableProperties,
      title: "ODIST Parsing",
      description:
        "Review dan perbarui data ODIST langsung melalui grid dengan filter, choose value, dan audit perubahan.",
      actionLabel: "Buka ODIST Parsing",
      actionTo: "/metadata/odists-parsing",
    },
    ...(canViewMasterData
      ? [
          {
            icon: Database,
            title: "Produk Distributor",
            description:
              "Kelola master bronze_so.Produk_Distributor dengan filter, sorting, insert, edit, duplicate, dan delete langsung dari aplikasi.",
            actionLabel: "Buka Produk Distributor",
            actionTo: "/metadata/produk-distributor",
          } satisfies HomeFeature,
          {
            icon: TableProperties,
            title: "ARTBST",
            description:
              "Kelola product master bronze_so.ARTBST dengan filter, sorting, insert, edit, duplicate, dan delete langsung dari aplikasi.",
            actionLabel: "Buka ARTBST",
            actionTo: "/metadata/artbst",
          } satisfies HomeFeature,
        ]
      : []),
    ...(canViewUsers
      ? [
          {
            icon: Users,
            title: "User Management",
            description:
              user?.role === "ADMIN"
                ? "Tambah user, edit detail anggota, dan atur status akses."
                : user?.role === "MANAGER"
                  ? "Lihat daftar anggota dan atur status aktif atau nonaktif."
                  : "Lihat daftar anggota dan role yang tersedia.",
            actionLabel: "Buka User Management",
            actionTo: "/admin/users",
          } satisfies HomeFeature,
        ]
      : []),
    {
      icon: ShieldCheck,
      title: "Audit Perubahan",
      description:
        user?.role === "INTERN"
          ? "Lihat effective result dan activity history milik akun Anda sendiri."
          : "Setiap perubahan ODIST dicatat bersama user, field, nilai lama, nilai baru, dan waktu perubahan data.",
      actionLabel: "Buka Parsing Report",
      actionTo: "/reports/parsing",
    },
    {
      icon: Database,
      title: "Pipeline Integration",
      description:
        "Data parsing menggunakan tabel staging MySQL pipeline_bigdata.gold_odists_parsing_manual.",
    },
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <section className="relative overflow-hidden py-20 lg:py-32">
        <img
          src={dataAnalyticsBg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-950/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-4xl text-center text-white">
            <h1 className="text-3xl font-bold leading-tight tracking-tight drop-shadow-lg sm:text-4xl lg:text-6xl">
              Metadata & ODIST Parsing Manager
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-white/90 drop-shadow-md sm:text-lg lg:text-2xl lg:leading-8">
              Aplikasi internal untuk proses parsing ODIST, pengelolaan metadata,
              user, dan pencatatan audit perubahan data.
            </p>
            <p className="mt-5 text-sm font-medium text-white/75">
              Gunakan menu pada sidebar atau tombol fitur di bawah untuk membuka
              halaman.
            </p>
          </div>
        </div>

        <div className="absolute left-10 top-20 h-16 w-16 rounded-full bg-white/10 blur-sm" />
        <div className="absolute bottom-20 right-10 h-12 w-12 rounded-full bg-white/10 blur-sm" />
      </section>

      <section className="container mx-auto px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold">Fitur Aktif</h2>
          <p className="mt-2 text-muted-foreground">
            Menu ditampilkan sesuai hak akses akun yang sedang digunakan.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title} className="flex h-full flex-col">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <CardDescription className="text-base leading-relaxed">
                  {feature.description}
                </CardDescription>

                {feature.actionTo && feature.actionLabel && (
                  <Button asChild className="mt-5 w-full sm:w-fit">
                    <Link to={feature.actionTo}>
                      {feature.actionLabel}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Index;
