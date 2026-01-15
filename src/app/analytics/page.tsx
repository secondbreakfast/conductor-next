import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, DollarSign, Play, Zap } from 'lucide-react';
import { TOKEN_PRICING } from '@/types/database';

export default async function AnalyticsPage() {
  const supabase = await createClient();

  // Fetch aggregate data
  const { data: runs } = await supabase
    .from('runs')
    .select('id, status, created_at');

  const { data: promptRuns } = await supabase
    .from('prompt_runs')
    .select('id, input_tokens, output_tokens, total_tokens, model');

  // Calculate stats
  const totalRuns = runs?.length || 0;
  const completedRuns = runs?.filter((r) => r.status === 'completed').length || 0;
  const failedRuns = runs?.filter((r) => r.status === 'failed').length || 0;
  const pendingRuns = runs?.filter((r) => r.status === 'pending').length || 0;

  const totalTokens =
    promptRuns?.reduce((sum, pr) => sum + (pr.total_tokens || 0), 0) || 0;

  const totalCost =
    promptRuns?.reduce((sum, pr) => {
      const model = pr.model || '';
      const pricing = TOKEN_PRICING[model];
      if (pricing && pr.input_tokens && pr.output_tokens) {
        return (
          sum +
          (pr.input_tokens / 1000) * pricing.input +
          (pr.output_tokens / 1000) * pricing.output
        );
      }
      return sum;
    }, 0) || 0;

  // Calculate runs by day (last 7 days)
  const last7Days = [...Array(7)].map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  const runsByDay = last7Days.map((date) => ({
    date,
    count: runs?.filter(
      (r) => r.created_at.split('T')[0] === date
    ).length || 0,
  }));

  return (
    <div className="flex flex-col">
      <Header title="Analytics" />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <p className="text-muted-foreground">
            Usage statistics and cost tracking
          </p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRuns.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {completedRuns} completed, {failedRuns} failed, {pendingRuns} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalRuns > 0 ? ((completedRuns / totalRuns) * 100).toFixed(1) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                Based on {totalRuns} total runs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Across {promptRuns?.length || 0} prompt runs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Based on token pricing
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Runs (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-2">
              {runsByDay.map((day) => {
                const maxCount = Math.max(...runsByDay.map((d) => d.count), 1);
                const height = (day.count / maxCount) * 100;
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t bg-primary transition-all"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <div className="text-xs text-muted-foreground">
                      {new Date(day.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                      })}
                    </div>
                    <div className="text-xs font-medium">{day.count}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
