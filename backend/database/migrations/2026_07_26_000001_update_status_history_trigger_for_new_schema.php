<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Update the log_incident_status trigger to use the new schema:
     * - changed_by_user_id instead of user_id
     * - status_old instead of previous_status
     * - status_new instead of new_status
     * - Add notes, deleted_at, created_at, updated_at columns
     *
     * Note: The observer (IncidentStatusHistoryObserver) now handles the
     * logging on the PHP side, but we keep the trigger for backward
     * compatibility and database-level consistency.
     */
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        // Drop the old trigger
        DB::statement('DROP TRIGGER IF EXISTS trg_log_incident_status ON incidents');

        // Recreate the trigger function with the new schema
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

                    INSERT INTO status_history (incident_id, status_old, status_new, changed_by_user_id, changed_at, created_at, updated_at)
                    VALUES (
                        NEW.id,
                        OLD.status,
                        NEW.status,
                        v_actor_id,
                        NOW(),
                        NOW(),
                        NOW()
                    );
                END IF;
                RETURN NEW;
            END;
            \$\$ LANGUAGE plpgsql;
        ");

        // Recreate the trigger with the updated function
        DB::statement('
            CREATE TRIGGER trg_log_incident_status
            AFTER UPDATE ON incidents
            FOR EACH ROW
            EXECUTE FUNCTION log_incident_status();
        ');
    }

    /**
     * Revert to the previous trigger definition.
     */
    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP TRIGGER IF EXISTS trg_log_incident_status ON incidents');

        // Restore the old trigger function with old schema
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

                    -- Note: this will fail if you've already dropped the old column names
                    -- That's intentional - you need to run this down() during a specific migration state
                    INSERT INTO status_history (incident_id, user_id, previous_status, new_status, created_at)
                    VALUES (
                        NEW.id,
                        v_actor_id,
                        OLD.status,
                        NEW.status,
                        NOW()
                    );
                END IF;
                RETURN NEW;
            END;
            \$\$ LANGUAGE plpgsql;
        ");

        DB::statement('
            CREATE TRIGGER trg_log_incident_status
            AFTER UPDATE ON incidents
            FOR EACH ROW
            EXECUTE FUNCTION log_incident_status();
        ');
    }
};
