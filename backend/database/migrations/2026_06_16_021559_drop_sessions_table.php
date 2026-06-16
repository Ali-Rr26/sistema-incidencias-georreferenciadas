<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('sessions');
    }

    public function down(): void
    {
        // No restoration — replaced by Sanctum personal_access_tokens
    }
};
