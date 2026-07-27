<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class IncidentResolutionAuditTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_stores_notes_in_status_history_when_updating_status(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $incident = Incident::factory()->create([
            'status' => IncidentStatus::Pending,
            'user_id' => $user->id,
        ]);

        $response = $this->putJson("/api/incidents/{$incident->id}", [
            'status' => IncidentStatus::Resolved->value,
            'notes' => 'Se reparó la fuga de agua en el sector.',
        ]);

        $response->assertOk();

        $history = DB::table('status_history')
            ->where('incident_id', $incident->id)
            ->where('new_status', IncidentStatus::Resolved->value)
            ->first();

        $this->assertNotNull($history);
        $this->assertEquals('Se reparó la fuga de agua en el sector.', $history->notes);
    }

    #[Test]
    public function it_includes_notes_in_status_history_in_incident_detail_response(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $incident = Incident::factory()->create([
            'status' => IncidentStatus::Pending,
            'user_id' => $user->id,
        ]);

        $this->putJson("/api/incidents/{$incident->id}", [
            'status' => IncidentStatus::Resolved->value,
            'notes' => 'Tubería reemplazada con éxito.',
        ]);

        $response = $this->getJson("/api/incidents/{$incident->id}");

        $response->assertOk();
        $response->assertJsonPath('data.status_history.0.notes', 'Tubería reemplazada con éxito.');
    }
}
