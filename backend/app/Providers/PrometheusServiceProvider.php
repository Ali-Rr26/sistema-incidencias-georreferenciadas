<?php

namespace App\Providers;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Users\Models\User;
use Illuminate\Support\ServiceProvider;
use Spatie\Prometheus\Collectors\Queue\QueueSizeCollector;
use Spatie\Prometheus\Facades\Prometheus;

class PrometheusServiceProvider extends ServiceProvider
{
    public function register()
    {
        Prometheus::addCounter('http_requests_total')
            ->help('Total HTTP requests')
            ->label('method', 'route', 'status')
            ->value(fn () => 0);

        Prometheus::addCounter('http_request_duration_seconds')
            ->help('HTTP request duration in seconds')
            ->label('method', 'route')
            ->value(fn () => 0);

        Prometheus::addGauge('users_active_total')
            ->help('Total registered users')
            ->value(fn () => User::count());

        Prometheus::addGauge('incidents_by_status')
            ->help('Incidents grouped by status')
            ->label('status')
            ->value(fn () => [
                ['pending', Incident::where('status', 'pending')->count()],
                ['in_progress', Incident::where('status', 'in_progress')->count()],
                ['resolved', Incident::where('status', 'resolved')->count()],
            ]);

        Prometheus::addGauge('incidents_total')
            ->help('Total incidents created')
            ->value(fn () => Incident::count());

        Prometheus::addGauge('app_version_info')
            ->help('Application version')
            ->label('version')
            ->value(fn () => [[config('app.version', '1.0'), 1]]);
    }
}
