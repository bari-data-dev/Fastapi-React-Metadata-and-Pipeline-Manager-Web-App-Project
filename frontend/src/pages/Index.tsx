import {
  ArrowRight,
  Database,
  BarChart3,
  Shield,
  Zap,
  Users,
  FileText,
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
import dataAnalyticsBg from "@/assets/data-analytics-bg.png";

const Index = () => {
  const features = [
    {
      icon: Database,
      title: "Metadata Management",
      description:
        "Comprehensive management of client configurations, mappings, and transformations with version control",
      link: "/metadata/clients",
    },
    {
      icon: FileText,
      title: "Data Audit & Reports",
      description:
        "Real-time monitoring and detailed audit logs for all data pipeline processes",
      link: "/audit/files",
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description:
        "Visual insights and performance metrics for your data operations",
      link: "/dashboard",
    },
    {
      icon: Shield,
      title: "Data Validation",
      description:
        "Automated validation and error detection with comprehensive reporting",
      link: "/audit/rows",
    },
  ];

  const stats = [
    { value: "150+", label: "Active Clients" },
    { value: "99.9%", label: "Data Accuracy" },
    { value: "10M+", label: "Records Processed" },
    { value: "24/7", label: "Monitoring" },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="hero-section relative py-20 lg:py-32">
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-white animate-fade-in">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight drop-shadow-lg">
              Data Pipeline Management Platform
            </h1>
            <p className="text-xl lg:text-2xl mb-8 opacity-95 leading-relaxed drop-shadow-md font-medium">
              Streamline your metadata management and data audit processes with
              our enterprise-grade platform designed for modern data operations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                size="lg"
                className="interactive-button text-lg px-8 py-3"
              >
                <Link to="/dashboard">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="text-lg px-8 py-3 bg-white/10 text-white border border-white/20 hover:bg-white/20"
              >
                <Link to="/metadata/clients">View Metadata</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Floating Elements */}
        <div className="absolute top-20 left-10 floating">
          <div className="w-16 h-16 bg-white/10 rounded-full"></div>
        </div>
        <div
          className="absolute bottom-20 right-10 floating"
          style={{ animationDelay: "1s" }}
        >
          <div className="w-12 h-12 bg-white/5 rounded-full"></div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-primary mb-2">
                  {stat.value}
                </div>
                <div className="text-muted-foreground font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Powerful Features for Data Management
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage, monitor, and optimize your data
              pipelines with enterprise-grade reliability and performance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="professional-card group cursor-pointer"
              >
                <Link to={feature.link}>
                  <CardHeader>
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <feature.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">
                          {feature.title}
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                    <div className="mt-4 flex items-center text-primary font-medium group-hover:translate-x-1 transition-transform">
                      Learn more
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            Ready to Transform Your Data Operations?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join leading organizations that trust our platform for their
            critical data management needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="interactive-button text-lg px-8 py-3"
            >
              <Link to="/metadata/clients">
                Start Managing Metadata
                <Database className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="text-lg px-8 py-3"
            >
              <Link to="/audit/files">
                View Audit Logs
                <FileText className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
