import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const tempDir = await mkdtemp(join(tmpdir(), "ytconv-ticket-store-"));
const storePath = join(tempDir, "tickets.json");
process.env.TICKET_STORE_PATH = storePath;
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

const {
  createTicket,
  deleteTicket,
  getTicket,
  getTicketStoreBackend,
  listTickets,
  updateTicket,
} = await import(`../ticket_store.js?test=${Date.now()}`);

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("ticket disimpan persisten dan ID dinormalisasi", async () => {
  assert.equal(getTicketStoreBackend(), "file");
  const created = await createTicket({
    ticketId: "tkt-persist-1",
    name: "User",
    status: "received",
    chatHistory: [],
  });

  assert.equal(created.ticketId, "TKT-PERSIST-1");
  assert.equal((await getTicket("tkt-persist-1")).name, "User");

  const disk = JSON.parse(await readFile(storePath, "utf8"));
  assert.equal(disk.tickets["TKT-PERSIST-1"].status, "received");
});

test("file fallback ditulis ke direktori dari TICKET_STORE_PATH", async () => {
  const disk = JSON.parse(await readFile(storePath, "utf8"));
  assert.ok(disk.tickets["TKT-PERSIST-1"]);
});

test("update concurrent tidak menghilangkan chat", async () => {
  await Promise.all([
    updateTicket("TKT-PERSIST-1", async (ticket) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      ticket.chatHistory.push({ id: "CHAT-1", sender: "user" });
      return ticket;
    }),
    updateTicket("TKT-PERSIST-1", (ticket) => {
      ticket.chatHistory.push({ id: "CHAT-2", sender: "admin" });
      return ticket;
    }),
  ]);

  const ticket = await getTicket("TKT-PERSIST-1");
  assert.deepEqual(ticket.chatHistory.map((entry) => entry.id), ["CHAT-1", "CHAT-2"]);
  assert.equal((await listTickets()).length, 1);
});

test("ticket duplikat ditolak dan ticket yang tidak ada tetap null", async () => {
  await assert.rejects(
    createTicket({ ticketId: "TKT-PERSIST-1" }),
    /ticket_already_exists/,
  );
  assert.equal(await getTicket("TKT-NOT-FOUND"), null);
  assert.equal(await updateTicket("TKT-NOT-FOUND", (ticket) => ticket), null);
});

test("ticket bisa dihapus dari store persisten", async () => {
  assert.equal(await deleteTicket("TKT-PERSIST-1"), true);
  assert.equal(await getTicket("TKT-PERSIST-1"), null);
  assert.equal(await deleteTicket("TKT-PERSIST-1"), false);
});
