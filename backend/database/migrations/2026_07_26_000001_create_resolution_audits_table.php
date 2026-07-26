<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resolution_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('incident_id')->constrained()->cascadeOnDelete();
            $table->foreignId('resolved_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('resolved_at')->useCurrent();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['incident_id']);
            $table->index(['resolved_by_user_id']);
            $table->index(['resolved_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resolution_audits');
    }
};
