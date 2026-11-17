-- Dados sintéticos para organizações QA (Hub Açaí QA e Mundo do Sabor QA)
-- Cenários de teste para validação de funcionalidades

-- Provision QA tenants before inserting tenant-scoped fixtures.
-- Stable IDs/slugs are shared with the application workspace presets.
INSERT INTO public.organizations (id, legal_name, display_name, slug, status, created_at, updated_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Hub Açaí QA', 'Hub Açaí QA', 'hub_acai_qa', 'active', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'Mundo do Sabor QA', 'Mundo do Sabor QA', 'mundo_sabor_qa', 'active', NOW(), NOW())
ON CONFLICT (id) DO UPDATE
SET legal_name = EXCLUDED.legal_name,
    display_name = EXCLUDED.display_name,
    slug = EXCLUDED.slug,
    status = EXCLUDED.status,
    updated_at = NOW();


-- Hub Açaí QA: Contas bancárias
INSERT INTO financial_accounts (id, organization_id, name, institution, account_type, currency, is_active, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440101', '550e8400-e29b-41d4-a716-446655440001', 'Itaú Hub Açaí QA', 'Itaú', 'checking', 'BRL', true, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440102', '550e8400-e29b-41d4-a716-446655440001', 'Nubank Hub Açaí QA', 'Nubank', 'checking', 'BRL', true, NOW(), NOW());

-- Hub Açaí QA: Pedidos WhatsApp sintéticos
INSERT INTO whatsapp_orders (id, organization_id, raw_message, customer_name, delivery_date, payment_method, notes, items, total_boxes, total_amount_minor, confidence, unrecognized_lines, status, created_by, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440103', '550e8400-e29b-41d4-a716-446655440001', 'Pedido QA WhatsApp teste 1 - Supermercado Real QA', 'Supermercado Real QA', CURRENT_DATE + INTERVAL '1 day', 'pix', 'Pedido QA teste 1', '[{"item": "Açaí 1L", "quantity": 10, "unit_price": 45.00}, {"item": "Polpa 500g", "quantity": 5, "unit_price": 30.00}]'::jsonb, 15, 60000, 'alta', '[]'::jsonb, 'confirmado', 'd4bc4a75-8271-41d7-b992-543b4da7d502', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440104', '550e8400-e29b-41d4-a716-446655440001', 'Pedido QA WhatsApp teste 2 - Padaria Estrela QA', 'Padaria Estrela QA', CURRENT_DATE + INTERVAL '2 days', 'boleto_14d', 'Pedido QA teste 2', '[{"item": "Sorvete 2L", "quantity": 8, "unit_price": 35.00}, {"item": "Cobertura 1kg", "quantity": 3, "unit_price": 25.00}]'::jsonb, 11, 38000, 'media', '[]'::jsonb, 'rascunho', '5fd4549a-1419-4b2d-9e7d-efb6430ec97a', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440105', '550e8400-e29b-41d4-a716-446655440001', 'Pedido QA WhatsApp teste 3 - Mercado Bom Preço QA', 'Mercado Bom Preço QA', CURRENT_DATE + INTERVAL '3 days', 'pix', 'Pedido QA teste 3', '[{"item": "Açaí 500ml", "quantity": 20, "unit_price": 25.00}, {"item": "Açaí 1L", "quantity": 5, "unit_price": 45.00}]'::jsonb, 25, 72500, 'alta', '[]'::jsonb, 'rascunho', 'd4bc4a75-8271-41d7-b992-543b4da7d502', NOW(), NOW());

-- Hub Açaí QA: Registros financeiros (simulando entrada de vendas)
INSERT INTO financial_records (id, organization_id, account_id, direction, amount_minor, currency, transaction_date, description, status, created_by, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440106', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440101', 'entrada', 60000, 'BRL', CURRENT_DATE - INTERVAL '2 days', 'Venda WhatsApp - Supermercado Real QA', 'conciliado', 'd4bc4a75-8271-41d7-b992-543b4da7d502', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440107', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440101', 'entrada', 38000, 'BRL', CURRENT_DATE - INTERVAL '1 day', 'Venda WhatsApp - Padaria Estrela QA', 'pendente', '5fd4549a-1419-4b2d-9e7d-efb6430ec97a', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440108', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440101', 'saída', 15000, 'BRL', CURRENT_DATE - INTERVAL '3 days', 'Combustível entrega QA', 'conciliado', 'd4bc4a75-8271-41d7-b992-543b4da7d502', NOW(), NOW());

-- Hub Açaí QA: Provas de entrega
INSERT INTO delivery_proofs (id, organization_id, nfe_number, customer_name, customer_document, nfe_amount_minor, issue_date, delivery_date, status, driver_name, receiver_name, receiver_document, proof_file_url, notes, synced_to_omie, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440109', '550e8400-e29b-41d4-a716-446655440001', 'NFE-QA-001', 'Supermercado Real QA', '12345678900', 60000, CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE - INTERVAL '2 days', 'comprovado', 'João Entregador QA', 'Supermercado Real QA', '12345678900', 'https://via.placeholder.com/300', 'Entrega QA teste 1', false, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440110', '550e8400-e29b-41d4-a716-446655440001', 'NFE-QA-002', 'Padaria Estrela QA', '09876543210', 38000, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '1 day', 'comprovado', 'Maria Entregadora QA', 'Padaria Estrela QA', '09876543210', 'https://via.placeholder.com/300', 'Entrega QA teste 2', false, NOW(), NOW());

-- Mundo do Sabor QA: Contas bancárias
INSERT INTO financial_accounts (id, organization_id, name, institution, account_type, currency, is_active, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440111', '550e8400-e29b-41d4-a716-446655440002', 'Bradesco Mundo QA', 'Bradesco', 'checking', 'BRL', true, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440112', '550e8400-e29b-41d4-a716-446655440002', 'Santander Mundo QA', 'Santander', 'checking', 'BRL', true, NOW(), NOW());

-- Mundo do Sabor QA: Registros financeiros (simulando extrato bancário)
INSERT INTO financial_records (id, organization_id, account_id, direction, amount_minor, currency, transaction_date, description, status, created_by, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440113', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440111', 'entrada', 500000, 'BRL', CURRENT_DATE - INTERVAL '5 days', 'Venda Lote QA - Cliente A', 'conciliado', 'd4bc4a75-8271-41d7-b992-543b4da7d502', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440114', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440111', 'entrada', 320000, 'BRL', CURRENT_DATE - INTERVAL '4 days', 'Venda Lote QA - Cliente B', 'conciliado', '5fd4549a-1419-4b2d-9e7d-efb6430ec97a', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440115', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440111', 'saída', 85000, 'BRL', CURRENT_DATE - INTERVAL '3 days', 'Pagamento Fornecedor QA', 'conciliado', 'd4bc4a75-8271-41d7-b992-543b4da7d502', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440116', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440111', 'entrada', 410000, 'BRL', CURRENT_DATE - INTERVAL '2 days', 'Venda Lote QA - Cliente C', 'pendente', '5fd4549a-1419-4b2d-9e7d-efb6430ec97a', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440117', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440112', 'entrada', 280000, 'BRL', CURRENT_DATE - INTERVAL '1 day', 'Venda Lote QA - Cliente D', 'pendente', 'd4bc4a75-8271-41d7-b992-543b4da7d502', NOW(), NOW());

-- Mundo do Sabor QA: Títulos a receber
INSERT INTO receivable_titles (id, organization_id, document_number, customer_name, customer_doc, amount_minor, due_date, issue_date, status, category, created_by, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440118', '550e8400-e29b-41d4-a716-446655440002', 'NF-QA-001', 'Cliente A QA', '11111111000111', 500000, CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE - INTERVAL '5 days', 'pendente', 'sale', 'd4bc4a75-8271-41d7-b992-543b4da7d502', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440119', '550e8400-e29b-41d4-a716-446655440002', 'NF-QA-002', 'Cliente B QA', '22222222000122', 320000, CURRENT_DATE + INTERVAL '20 days', CURRENT_DATE - INTERVAL '4 days', 'pendente', 'sale', '5fd4549a-1419-4b2d-9e7d-efb6430ec97a', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440120', '550e8400-e29b-41d4-a716-446655440002', 'NF-QA-003', 'Cliente C QA', '33333333000133', 410000, CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE - INTERVAL '2 days', 'pendente', 'sale', 'd4bc4a75-8271-41d7-b992-543b4da7d502', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440121', '550e8400-e29b-41d4-a716-446655440002', 'NF-QA-004', 'Cliente D QA', '44444444000144', 280000, CURRENT_DATE + INTERVAL '25 days', CURRENT_DATE - INTERVAL '1 day', 'pendente', 'sale', '5fd4549a-1419-4b2d-9e7d-efb6430ec97a', NOW(), NOW());

-- Mundo do Sabor QA: Canhotos SEFAZ (simulados)
INSERT INTO delivery_proofs (id, organization_id, nfe_number, customer_name, customer_document, nfe_amount_minor, issue_date, delivery_date, status, driver_name, receiver_name, receiver_document, proof_file_url, notes, synced_to_omie, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440122', '550e8400-e29b-41d4-a716-446655440002', 'NF-QA-001', 'Cliente A QA', '11111111000111', 500000, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days', 'comprovado', 'Transportadora QA', 'Cliente A QA', '11111111000111', 'https://via.placeholder.com/300', 'Canhoto SEFAZ QA teste 1', false, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440123', '550e8400-e29b-41d4-a716-446655440002', 'NF-QA-002', 'Cliente B QA', '22222222000122', 320000, CURRENT_DATE - INTERVAL '4 days', CURRENT_DATE - INTERVAL '4 days', 'comprovado', 'Transportadora QA', 'Cliente B QA', '22222222000122', 'https://via.placeholder.com/300', 'Canhoto SEFAZ QA teste 2', false, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440124', '550e8400-e29b-41d4-a716-446655440002', 'NF-QA-003', 'Cliente C QA', '33333333000133', 410000, CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE - INTERVAL '2 days', 'comprovado', 'Transportadora QA', 'Cliente C QA', '33333333000133', 'https://via.placeholder.com/300', 'Canhoto SEFAZ QA teste 3', false, NOW(), NOW());

-- Eventos de auditoria para QA
INSERT INTO audit_events (organization_id, actor_id, event_type, entity_type, entity_id, occurred_at, correlation_id, metadata) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'd4bc4a75-8271-41d7-b992-543b4da7d502', 'order.created', 'whatsapp_order', '550e8400-e29b-41d4-a716-446655440103', NOW() - INTERVAL '2 days', '550e8400-e29b-41d4-a716-446655440201', '{"source": "whatsapp", "customer": "Supermercado Real QA"}'),
  ('550e8400-e29b-41d4-a716-446655440001', '5fd4549a-1419-4b2d-9e7d-efb6430ec97a', 'order.confirmed', 'whatsapp_order', '550e8400-e29b-41d4-a716-446655440104', NOW() - INTERVAL '1 day', '550e8400-e29b-41d4-a716-446655440202', '{"source": "whatsapp", "customer": "Padaria Estrela QA"}'),
  ('550e8400-e29b-41d4-a716-446655440002', 'd4bc4a75-8271-41d7-b992-543b4da7d502', 'invoice.issued', 'receivable_title', '550e8400-e29b-41d4-a716-446655440118', NOW() - INTERVAL '5 days', '550e8400-e29b-41d4-a716-446655440203', '{"customer": "Cliente A QA", "amount": 5000}'),
  ('550e8400-e29b-41d4-a716-446655440002', '5fd4549a-1419-4b2d-9e7d-efb6430ec97a', 'invoice.issued', 'receivable_title', '550e8400-e29b-41d4-a716-446655440119', NOW() - INTERVAL '4 days', '550e8400-e29b-41d4-a716-446655440204', '{"customer": "Cliente B QA", "amount": 3200}');
