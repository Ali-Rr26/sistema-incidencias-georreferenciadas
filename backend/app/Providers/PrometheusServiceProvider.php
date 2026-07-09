<?php

namespace App\Providers;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Users\Models\User;
use Illuminate\Support\ServiceProvider;
use Spatie\Prometheus\Facades\Prometheus;

class PrometheusServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        Prometheus::addGauge('users_active_total')
            ->helpText('Active users (last 5 minutes)')
            ->value(fn () => User::where('last_active_at', '>=', now()->subMinutes(5))->count());

        Prometheus::addGauge('incidents_by_status')
            ->helpText('Incidents grouped by status')
            ->labels(['status'])
            ->value(fn () => Incident::query()
                ->selectRaw('status, count(*) as count')
                ->groupBy('status')
                ->pluck('count', 'status')
                ->map(fn ($count, $status) => [$count, [$status]])
                ->values()
                ->toArray()
            );

        Prometheus::addGauge('incidents_total')
            ->helpText('Total incidents created')
            ->value(fn () => Incident::count());
    }
}
