import {pool} from '../db.js';
let schemaReady:Promise<void>|undefined;
export function ensurePageActivitySchema(){
  return schemaReady ||= pool.query(`CREATE TABLE IF NOT EXISTS app.page_activity (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,visitor_id uuid NOT NULL,session_id uuid NOT NULL,
    user_id varchar(255),path text NOT NULL,event text NOT NULL CHECK(event IN ('page_view','heartbeat')),
    created_at timestamptz NOT NULL DEFAULT now())`).then(async()=>{
      await pool.query('CREATE INDEX IF NOT EXISTS page_activity_user_time ON app.page_activity(user_id,created_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS page_activity_visitor_time ON app.page_activity(visitor_id,created_at)');
      await pool.query('CREATE INDEX IF NOT EXISTS page_activity_time ON app.page_activity(created_at)');
    }).catch(error=>{schemaReady=undefined;throw error;});
}
