-- Grant HR payroll read + reports; manager reports (idempotent upsert).
-- Uses the default tenant id `t-default`.

INSERT INTO role_permissions (tenant_id, role, module_id, actions)
VALUES
  ('t-default', 'hr', 'payroll', '["read"]'),
  ('t-default', 'hr', 'reports', '["read","export"]'),
  ('t-default', 'manager', 'reports', '["read","export"]')
ON DUPLICATE KEY UPDATE actions = VALUES(actions);
