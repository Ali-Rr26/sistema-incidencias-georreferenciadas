<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('status_history', function (Blueprint $table) {
            $table->text('comment')->nullable()->after('new_status');
        });

        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        // Update trigger to read comment from session config app.status_comment
        DB::statement("
            CREATE OR REPLACE FUNCTION log_incident_status()
            RETURNS TRIGGER AS \$\$
            DECLARE
                v_actor_id BIGINT;
                v_comment  TEXT;
            BEGIN
                IF OLD.status IS DISTINCT FROM NEW.status THEN
                    v_actor_id := NULLIF(current_setting('app.current_user_id', true), '')::BIGINT;
                    IF v_actor_id IS NULL THEN
                        v_actor_id := COALESCE(NEW.user_id, OLD.user_id);
                    END IF;

                    v_comment := NULLIF(current_setting('app.status_comment', true), '');

                    INSERT INTO status_history (incident_id, user_id, previous_status, new_status, comment, created_at)
                    VALUES (NEW.id, v_actor_id, OLD.status, NEW.status, v_comment, NOW());
                END IF;
                RETURN NEW;
            END;
            \$\$ LANGUAGE plpgsql;
        ");
    }

    public function down(): void
    {
        Schema::table('status_history', function (Blueprint $table) {
            $table->dropColumn('comment');
        });

        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement("
            CREATE OR REPLACE FUNCTION log_incident_status()
            RETURNS TRIGGER AS \$\$
            DECLARE
                v_actor_id BIGINT;
            BEGIN
                IF OLD.status IS DISTINCT FROM NEW.status THEN
                    v_actor_id := NULLIF(current_setting('app.current_user_id', true), '')::BIGINT;
                    IF v_actor_id IS NULL THEN
                        v_actor_id := COALESCE(NEW.user_id, OLD.user_id);
                    END IF;

                    INSERT INTO status_history (incident_id, user_id, previous_status, new_status, created_at)
                    VALUES (NEW.id, v_actor_id, OLD.status, NEW.status, NOW());
                END IF;
                RETURN NEW;
            END;
            \$\$ LANGUAGE plpgsql;
        ");
    }
};
