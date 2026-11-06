import test from "node:test";
import assert from "node:assert/strict";
import {
  HUB_ACAI_CATALOG,
  generateOmieSalesOrderCsv,
  parseWhatsAppOrderMessage
} from "../lib/orders";

test("ENG-HA-01: HUB_ACAI_CATALOG possui SKUs canônicos e fatores de caixa", () => {
  const trad = HUB_ACAI_CATALOG.find((p) => p.sku === "ACAI-TRAD-10L");
  assert.ok(trad);
  assert.equal(trad?.boxesCount, 1);
  assert.equal(trad?.unitVolumeLiters, 10);

  const balde5l = HUB_ACAI_CATALOG.find((p) => p.sku === "ACAI-TRAD-5L");
  assert.ok(balde5l);
  assert.equal(balde5l?.boxesCount, 0.5);
});

test("ENG-HA-01: parseWhatsAppOrderMessage decifra mensagem coloquial com múltiplos sabores e caixas", () => {
  const msg = [
    "Bom dia! Aqui é o Marcos do Açaí do Parque Salvador.",
    "Segue o nosso pedido para entregar amanhã cedo:",
    "- 10 caixas do tradicional 10L",
    "- 5 de banana",
    "- 2 de morango",
    "- 3 de cupuaçu",
    "Pagamento no boleto 7 dias como sempre. Valeu!"
  ].join("\n");

  const order = parseWhatsAppOrderMessage(msg);

  assert.match(order.customerName, /Marcos do Açaí do Parque/);
  assert.equal(order.paymentMethod, "boleto_7d");
  assert.equal(order.items.length, 4);

  // Tradicional
  const itemTrad = order.items.find((i) => i.flavor === "Tradicional");
  assert.ok(itemTrad);
  assert.equal(itemTrad?.quantity, 10);
  assert.equal(itemTrad?.boxesTotal, 10);

  // Banana
  const itemBan = order.items.find((i) => i.flavor === "Banana");
  assert.ok(itemBan);
  assert.equal(itemBan?.quantity, 5);

  // Morango
  const itemMor = order.items.find((i) => i.flavor === "Morango");
  assert.ok(itemMor);
  assert.equal(itemMor?.quantity, 2);

  // Cupuaçu
  const itemCupu = order.items.find((i) => i.flavor === "Cupuaçu");
  assert.ok(itemCupu);
  assert.equal(itemCupu?.quantity, 3);

  // Total de caixas: 10 + 5 + 2 + 3 = 20 caixas físicas
  assert.equal(order.totalBoxes, 20);
  assert.ok(order.totalAmount > 0);
  assert.equal(order.confidence, "alta");
});

test("ENG-HA-01: parseWhatsAppOrderMessage reconhece quantidades por extenso em português", () => {
  const msg = [
    "Cliente: Quiosque Orla Barra",
    "Manda duas de cupuaçu e cinco de trufado ninho",
    "Vou fazer o pix na entrega"
  ].join("\n");

  const order = parseWhatsAppOrderMessage(msg);

  assert.equal(order.customerName, "Quiosque Orla Barra");
  assert.equal(order.paymentMethod, "pix");

  const itemCupu = order.items.find((i) => i.flavor === "Cupuaçu");
  assert.equal(itemCupu?.quantity, 2);

  const itemTruf = order.items.find((i) => i.flavor === "Trufado Ninho");
  assert.equal(itemTruf?.quantity, 5);

  assert.equal(order.totalBoxes, 7);
});

test("ENG-HA-01: generateOmieSalesOrderCsv gera CSV compatível com importação de vendas no Omie", () => {
  const msg = "Cliente: Lanchonete Bahia\n10 cx açaí tradicional 10L\npix";
  const order = parseWhatsAppOrderMessage(msg);

  const csv = generateOmieSalesOrderCsv([order]);

  assert.match(csv, /Codigo_Pedido;Cliente;Data_Previsao/);
  assert.match(csv, /"Lanchonete Bahia"/);
  assert.match(csv, /"ACAI-TRAD-10L"/);
  assert.match(csv, /"Tradicional"/);
});

