import { Database, ShieldCheck, TableProperties, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import dataAnalyticsBg from "@/assets/data-analytics-bg.png";

const Index = () => {
  const features = [
    {
      icon: TableProperties,
      title: "ODIST Parsing",
      description: "Review dan perbarui data ODIST langsung melalui grid dengan filter, choose value, dan audit perubahan.",
    },
    {
      icon: Users,
      title: "User Management",
      description: "Kelola akun ADMIN dan PARSER yang memiliki akses ke aplikasi.",
    },
    {
      icon: ShieldCheck,
      title: "Audit Perubahan",
      description: "Setiap perubahan ODIST dicatat bersama user, field, nilai lama, nilai baru, dan waktu perubahan.",
    },
    {
      icon: Database,
      title: "Pipeline Integration",
      description: "Data parsing menggunakan tabel staging MySQL pipeline_bigdata.gold_odists_parsing_manual.",
    },
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <section className="relative overflow-hidden py-16 lg:py-24">
        <img src={dataAnalyticsBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 to-primary/75" />
        <div className="container relative z-10 mx-auto px-6">
          <div className="max-w-3xl text-white">
            <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">Metadata & ODIST Parsing Manager</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/90">
              Aplikasi internal untuk proses parsing ODIST, pengelolaan user, dan pencatatan audit perubahan data.
            </p>
            <p className="mt-4 text-sm text-white/75">
              Gunakan menu pada sidebar untuk membuka fitur yang sedang aktif.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Fitur Aktif</h2>
          <p className="mt-2 text-muted-foreground">Kartu berikut bersifat informatif dan tidak membuka halaman lain.</p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title} className="cursor-default">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Index;
