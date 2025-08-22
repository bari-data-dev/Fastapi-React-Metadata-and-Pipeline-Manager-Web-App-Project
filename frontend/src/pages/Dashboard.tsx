import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Activity,
  TrendingUp,
  Database,
  Zap
} from 'lucide-react';
import { mockFileAuditLogs, mockClients, getStatusColor } from '@/utils/mockData';

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    totalClients: 0,
    totalFiles: 0,
    successRate: 0,
    totalRecords: 0,
    validRecords: 0,
    errorRate: 0
  });

  useEffect(() => {
    // Calculate metrics from mock data
    const totalClients = mockClients.length;
    const totalFiles = mockFileAuditLogs.length;
    const totalRecords = mockFileAuditLogs.reduce((sum, log) => sum + (log.total_rows || 0), 0);
    const validRecords = mockFileAuditLogs.reduce((sum, log) => sum + (log.valid_rows || 0), 0);
    const successfulFiles = mockFileAuditLogs.filter(log => log.load_status === 'Loaded').length;
    const successRate = totalFiles > 0 ? (successfulFiles / totalFiles) * 100 : 0;
    const errorRate = totalRecords > 0 ? ((totalRecords - validRecords) / totalRecords) * 100 : 0;

    setMetrics({
      totalClients,
      totalFiles,
      successRate,
      totalRecords,
      validRecords,
      errorRate
    });
  }, []);

  const recentActivity = mockFileAuditLogs.slice(0, 5);

  const quickStats = [
    {
      title: 'Active Clients',
      value: metrics.totalClients,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Files Processed',
      value: metrics.totalFiles,
      icon: FileText,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Success Rate',
      value: `${metrics.successRate.toFixed(1)}%`,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100'
    },
    {
      title: 'Error Rate',
      value: `${metrics.errorRate.toFixed(1)}%`,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your data pipeline performance and key metrics
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat, index) => (
          <Card key={index} className="professional-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="professional-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Data Quality Metrics</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Data Accuracy</span>
                <span>{((metrics.validRecords / metrics.totalRecords) * 100 || 0).toFixed(1)}%</span>
              </div>
              <Progress 
                value={(metrics.validRecords / metrics.totalRecords) * 100 || 0} 
                className="h-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing Success Rate</span>
                <span>{metrics.successRate.toFixed(1)}%</span>
              </div>
              <Progress 
                value={metrics.successRate} 
                className="h-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{metrics.totalRecords.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Records</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">{metrics.validRecords.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Valid Records</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-primary" />
              <span>Recent Activity</span>
            </CardTitle>
            <CardDescription>Latest file processing activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.file_audit_id} className="flex items-center space-x-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {activity.logical_source_file}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.batch_id} • {activity.total_rows} rows
                    </p>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={getStatusColor(activity.load_status || '')}
                  >
                    {activity.load_status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="professional-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-primary" />
              <span>Storage Health</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Storage Used</span>
                <span>73%</span>
              </div>
              <Progress value={73} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              2.3 TB of 3.2 TB used
            </p>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-primary" />
              <span>Processing Speed</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156K</div>
            <p className="text-xs text-muted-foreground">
              Records per minute
            </p>
            <div className="flex items-center mt-2 text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12% from last week
            </div>
          </CardContent>
        </Card>

        <Card className="professional-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>System Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">API Services</span>
                <Badge className="bg-green-100 text-green-800">Healthy</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Data Pipeline</span>
                <Badge className="bg-green-100 text-green-800">Running</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Monitoring</span>
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;